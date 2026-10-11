import test from "node:test";
import assert from "node:assert/strict";
import {
  meals,
  rankMeals,
  shoppingList,
  weekKey,
  eligibleMeals,
} from "./model.js";
test("household votes rank meals and ties preserve suggestion order", () => {
  assert.deepEqual(
    rankMeals({ alex: ["curry", "tacos"], sam: ["curry", "pasta"] }, 3).map(
      (m) => m.id,
    ),
    ["curry", "tacos", "pasta"],
  );
});
test("shopping list combines shared ingredients and scales servings", () => {
  const list = shoppingList(
    meals.filter((m) => ["salmon", "curry"].includes(m.id)),
    2,
  );
  assert.equal(list.find((i) => i.name === "Rice").amount, 300);
  assert.equal(list.find((i) => i.name === "Salmon").amount, 300);
});
test("week rolls over on Monday including Sunday and year boundaries", () => {
  assert.equal(weekKey(new Date(2026, 9, 11)), "2026-10-05");
  assert.equal(weekKey(new Date(2026, 9, 12)), "2026-10-12");
  assert.equal(weekKey(new Date(2027, 0, 1)), "2026-12-28");
});
test("household preferences exclude incompatible meals even with winning votes", () => {
  const preferences = { vegetarian: true, quick: true };
  assert.equal(eligibleMeals(preferences).length, 7);
  const selected = rankMeals(
    { alex: ["chicken", "soup", "curry"], sam: ["chicken"] },
    7,
    preferences,
  );
  assert.equal(selected[0].id, "curry");
  assert.equal(selected.length, 7);
  assert.ok(selected.every((m) => m.vegetarian && m.time <= 30));
});
test("duplicate votes from a household member only count once", () => {
  assert.equal(
    rankMeals(
      { alex: ["curry", "curry", "curry"], sam: ["tacos"], pat: ["tacos"] },
      1,
    )[0].id,
    "tacos",
  );
});
