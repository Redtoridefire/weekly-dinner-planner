import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeState,
  applyAction,
  selectedMeals,
  listText,
  weekKey,
} from "../model.js";
test("malformed browser storage cannot inject recipes or invalid quantities", () => {
  const state = normalizeState({
    votes: { alex: ["curry", "curry", "fake"], sam: "curry" },
    pantry: [null, "Rice"],
    servings: Infinity,
    dinners: -1,
    locked: { ids: ["fake"] },
    voter: 42,
  });
  assert.deepEqual(state.votes.alex, ["curry"]);
  assert.equal(state.votes.sam, undefined);
  assert.equal(state.servings, 4);
  assert.equal(state.dinners, 5);
  assert.equal(state.locked, null);
  assert.deepEqual(state.pantry, ["Rice"]);
  assert.equal(normalizeState(null).servings, 4);
});
test("finalized menu prevents votes and settings; pantry, reopening and reset remain available", () => {
  let state = applyAction(
    normalizeState(),
    "vote",
    { id: "curry", enabled: true },
    "alex",
  );
  state = applyAction(state, "finalize", {}, "alex");
  const ids = selectedMeals(state).map((m) => m.id);
  assert.throws(
    () => applyAction(state, "vote", { id: "tacos", enabled: true }, "alex"),
    /Reopen/,
  );
  assert.throws(
    () => applyAction(state, "settings", { servings: 2, dinners: 3 }, "alex"),
    /Reopen/,
  );
  state = applyAction(state, "pantry", { name: "Rice", enabled: true }, "alex");
  assert.ok(!listText(state, "2026-10-05").includes("Rice:"));
  assert.deepEqual(
    selectedMeals(state).map((m) => m.id),
    ids,
  );
  state = applyAction(state, "reopen", {}, "alex");
  assert.equal(state.locked, null);
  state = applyAction(state, "reset", {}, "alex");
  assert.equal(Object.keys(state.votes).length, 0);
  assert.equal(state.pantry.length, 0);
});
test("whole servings, known ingredients, and compatible votes are enforced", () => {
  let state = normalizeState({
    preferences: { vegetarian: true, quick: true },
  });
  assert.throws(
    () => applyAction(state, "vote", { id: "chicken", enabled: true }, "alex"),
    /preferences/,
  );
  assert.throws(
    () => applyAction(state, "settings", { servings: 2.5, dinners: 5 }, "alex"),
    /whole|Choose/,
  );
  assert.throws(
    () =>
      applyAction(
        state,
        "pantry",
        { name: "Unlisted ingredient", enabled: true },
        "alex",
      ),
    /current list/,
  );
  state = applyAction(
    state,
    "vote",
    { id: "curry", enabled: true },
    "__proto__",
  );
  assert.deepEqual(state.votes.__proto__, ["curry"]);
  assert.equal({}.polluted, undefined);
});
test("household timezone uses Monday even when devices are in different dates", () => {
  const now = new Date("2026-10-12T01:00:00Z");
  assert.equal(weekKey(now, "America/New_York"), "2026-10-05");
  assert.equal(weekKey(now, "Asia/Tokyo"), "2026-10-12");
});
