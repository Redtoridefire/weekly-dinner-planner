import test from "node:test";
import assert from "node:assert/strict";
import { priceBook, cheapestPurchase, normalizePrices } from "../prices.js";
import {
  meals,
  normalizeState,
  planResult,
  estimateCart,
  applyAction,
  listText,
} from "../model.js";
const offers = [
  { label: "Small", size: 3, price: 2 },
  { label: "Large", size: 5, price: 3 },
];
test("package optimizer minimizes checkout spend, can mix sizes, and covers all required food", () => {
  assert.deepEqual(cheapestPurchase(7, offers), {
    counts: [1, 1],
    quantity: 8,
    cents: 500,
    cost: 5,
  });
  assert.equal(cheapestPurchase(3, offers).cost, 2); // Lower bulk unit price is not lower checkout spend.
  assert.equal(cheapestPurchase(0, offers).cost, 0);
  assert.deepEqual(cheapestPurchase(7, [...offers].reverse()).counts, [1, 1]);
  const fractional = [
    { label: "A", size: 1.5, price: 1 },
    { label: "B", size: 2.5, price: 1.6 },
  ];
  assert.equal(cheapestPurchase(3.00001, fractional).cost, 2.6);
  for (const recipe of meals)
    for (const [name, unit] of recipe.ingredients) {
      assert.ok(priceBook[name]);
      assert.equal(priceBook[name].unit, unit);
    }
});
test("weekly cart shares purchases and excludes owned ingredients", () => {
  const selected = meals.filter((m) =>
    ["keto-eggs", "keto-frittata"].includes(m.id),
  );
  const total = estimateCart(selected);
  assert.ok(
    total.total <
      selected.reduce((cost, m) => cost + estimateCart([m]).total, 0),
  );
  assert.equal(total.items.find((i) => i.name === "Eggs").amount, 16);
  assert.deepEqual(total.items.find((i) => i.name === "Eggs").counts, [0, 1]);
  const owned = estimateCart(selected, 4, ["Eggs"]);
  assert.equal(owned.total, total.total - 4.2);
  assert.equal(owned.pantrySavings, 4.2);
});
test("lowest grocery estimate compares whole weekly menus and honors keto and vegetarian together", () => {
  const state = normalizeState({
    preferences: { keto: true, vegetarian: true },
    dinners: 2,
    strategy: "cheapest",
    votes: { alex: ["keto-tofu"] },
  });
  const plan = planResult(state);
  assert.deepEqual(
    plan.meals.map((m) => m.id),
    ["keto-eggs", "keto-frittata"],
  );
  assert.equal(plan.estimate.total, 16.65);
  assert.ok(plan.meals.every((m) => m.keto && m.vegetarian));
  const short = planResult(normalizeState({ ...state, dinners: 7 }));
  assert.equal(short.meals.length, 3);
  assert.throws(
    () => applyAction(state, "vote", { id: "curry", enabled: true }, "alex"),
    /preferences/,
  );
});
test("budget mode keeps most votes within a feasible target and falls back honestly when impossible", () => {
  const state = normalizeState({
    preferences: { keto: true },
    dinners: 1,
    strategy: "balanced",
    budget: 12,
    votes: { alex: ["keto-salmon"], sam: ["keto-salmon"], pat: ["keto-eggs"] },
  });
  let result = planResult(state);
  assert.deepEqual(
    result.meals.map((m) => m.id),
    ["keto-eggs"],
  );
  assert.ok(result.estimate.total <= 12);
  result = planResult(normalizeState({ ...state, budget: 1 }));
  const cheapest = planResult(
    normalizeState({ ...state, strategy: "cheapest" }),
  );
  assert.equal(result.estimate.total, cheapest.estimate.total);
  assert.equal(result.overBudget, true);
  assert.equal(
    planResult(normalizeState({ ...state, budget: 0 })).meals[0].id,
    "keto-salmon",
  );
});
test("custom package prices affect choices, survive backups, and are frozen with finalized menus", () => {
  let state = normalizeState({
    preferences: { keto: true, vegetarian: true },
    dinners: 1,
    strategy: "cheapest",
  });
  const initial = planResult(state).meals[0].id;
  state = applyAction(state, "prices", {
    name: "Eggs",
    offers: offers.map((o) => ({ ...o, price: 100 })),
  });
  assert.notEqual(planResult(state).meals[0].id, initial);
  state = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(state.prices.Eggs[0].price, 100);
  state = applyAction(state, "finalize", {});
  assert.throws(
    () => applyAction(state, "prices", { name: "Eggs", offers }),
    /Reopen/,
  );
  assert.match(listText(state, "2026-10-05"), /Buy .*estimated \$/);
  assert.match(listText(state, "2026-10-05"), /Estimated grocery subtotal/);
  assert.deepEqual(
    Object.keys(
      normalizePrices({
        Unknown: offers,
        Eggs: [...offers, { label: "Extra", size: 2, price: 1 }],
      }),
    ),
    [],
  );
  assert.throws(
    () =>
      applyAction(normalizeState(), "prices", {
        name: "Eggs",
        offers: offers.map((o) => ({ ...o, price: 0.001 })),
      }),
    /valid/,
  );
});
