import test from "node:test";
import assert from "node:assert/strict";
import { chatgptShoppingText } from "../chatgpt-handoff.js";
import { normalizeState, planResult } from "../model.js";

const week = "2026-10-12";
const finalized = (extra = {}) =>
  normalizeState({
    servings: 2,
    dinners: 2,
    locked: { ids: ["keto-eggs", "keto-frittata"] },
    preferences: { keto: true, vegetarian: true, quick: true },
    ...extra,
  });

test("ChatGPT handoff requires a finalized menu, a valid week, and something to buy", () => {
  assert.throws(() => chatgptShoppingText(normalizeState(), week), /Finalize/);
  assert.throws(
    () => chatgptShoppingText(finalized(), "2026-02-31"),
    /Refresh/,
  );
  const state = finalized();
  state.pantry = planResult(state).estimate.items.map((item) => item.name);
  assert.throws(() => chatgptShoppingText(state, week), /nothing to shop/);
});

test("handoff preserves finalized meals, combines scaled groceries once, and separates pantry exclusions", () => {
  const text = chatgptShoppingText(finalized({ pantry: ["Butter"] }), week);
  assert.match(text, /Cheesy cabbage & egg skillet — serves 2/);
  assert.match(text, /Broccoli cheddar frittata — serves 2/);
  const [shopping, pantry] = text
    .split("GROCERIES TO BUY")[1]
    .split("PANTRY EXCLUSIONS");
  assert.equal(shopping.match(/- Eggs:/g).length, 1);
  assert.match(shopping, /Eggs: 8 pieces required/);
  assert.match(shopping, /Cabbage: 0.25 heads required/);
  assert.doesNotMatch(shopping, /Butter/);
  assert.match(pantry, /Butter: 25 g already owned/);
  assert.match(
    text,
    /Do not multiply them by the servings or meal count again/,
  );
  assert.match(
    text,
    /Keto-style meals only; Vegetarian meals only; Meals take 30 minutes or less/,
  );
});

test("handoff labels estimates, carries custom package offers and budget overages, and specifies can sizes", () => {
  const text = chatgptShoppingText(
    finalized({
      budget: 1,
      prices: {
        Eggs: [
          { label: "Small", size: 6, price: 2 },
          { label: "Bulk", size: 12, price: 3 },
        ],
      },
    }),
    week,
  );
  assert.match(text, /Grocery ITEM subtotal target: \$1.00 USD/);
  assert.match(text, /already above the item budget target/);
  assert.match(
    text,
    /1 x "Bulk" \(12 pieces per package; \$3.00 USD per package\)/,
  );
  assert.match(text, /household-entered estimate/);
  assert.match(text, /illustrative default estimate/);
  assert.match(text, /not live retailer quotes/);
  const cans = chatgptShoppingText(
    finalized({ locked: { ids: ["curry", "pasta"] } }),
    week,
  );
  assert.match(cans, /Coconut milk: .*13.5 oz \/ 400 ml per can/);
  assert.match(cans, /Crushed tomatoes: .*28 oz \/ 800 g per can/);
});

test("handoff requests an actual cart review and fresh purchase approval, without exporting account or vote data", () => {
  const state = finalized({
    voter: "private-voter",
    votes: { "private-member": ["keto-eggs"] },
  });
  state.email = "private@example.test";
  state.access_token = "private-access-token";
  state.householdId = "private-household";
  const label = 'Budget\n"package"';
  state.prices.Eggs = [
    { label, size: 12, price: 3 },
    { label: "Bulk", size: 18, price: 4.2 },
  ];
  const text = chatgptShoppingText(state, week);
  assert.ok(text.includes(JSON.stringify(label)));
  assert.doesNotMatch(
    text,
    /private-voter|private-member|private@example.test|private-access-token|private-household/,
  );
  assert.match(text, /Do not place an order or initiate payment yet/);
  assert.match(
    text,
    /brand, package size, number of packages, actual item price/,
  );
  assert.match(
    text,
    /taxes, delivery\/service fees, tip, and final payable total/,
  );
  assert.match(
    text,
    /explicit approval of that specific final cart and payable total/,
  );
  assert.match(text, /get fresh approval before purchase/);
  assert.match(text, /not purchase approval/);
  assert.match(text, /If Instacart tools or checkout are unavailable/);
});
