import test from "node:test";
import assert from "node:assert/strict";
import {
  createHandler,
  groceryItems,
} from "../supabase/functions/grocery-link/handler.js";
import { meals, normalizeState, applyAction } from "../model.js";
import { priceBook } from "../prices.js";
const priceRows = Object.entries(priceBook).map(([name, { offers }]) => ({
  name,
  offers,
}));
const origin = "https://dinner.example.test",
  home = "00000000-0000-4000-8000-000000000001";
const catalog = meals.map((recipe) => ({ id: recipe.id, recipe }));
const snapshot = {
  week: "2026-10-05",
  state: applyAction(normalizeState(), "finalize", {}),
};
const environment = {
  APP_ORIGINS: origin,
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "public-test-key",
  INSTACART_API_KEY: "server-only-test-key",
  INSTACART_ENV: "development",
};
const request = (
  body = {
    householdId: home,
    week: snapshot.week,
    revision: snapshot.state.revision,
  },
  headers = {},
) =>
  new Request("https://project.supabase.co/functions/v1/grocery-link", {
    method: "POST",
    headers: {
      origin,
      authorization: "Bearer user-test-session",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function setup(
  overrides = {},
  snapshotOverride = snapshot,
  upstreamResponse = {
    products_link_url: "https://www.instacart.com/store/shopping_lists/test",
  },
) {
  const calls = [];
  const handler = createHandler(
    (name) => ({ ...environment, ...overrides })[name],
    async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/auth/v1/user")) return json({ id: home });
      if (url.includes("dinner_snapshot")) return json(snapshotOverride);
      if (url.includes("dinner_catalog")) return json(catalog);
      if (url.includes("dinner_pricebook")) return json(priceRows);
      if (url.includes("dinner_reserve_grocery")) return json(true);
      return json(upstreamResponse);
    },
  );
  return { handler, calls };
}
test("grocery payload uses finalized canonical recipes and excludes pantry items", () => {
  const current = {
    ...snapshot,
    state: { ...snapshot.state, pantry: ["Rice"], servings: 2 },
  };
  const items = groceryItems(current, catalog);
  assert.ok(!items.some((i) => i.name === "Rice"));
  assert.equal(
    items.find((i) => i.name === "Black beans, 15 oz can").measurements[0]
      .quantity,
    1,
  );
  assert.equal(
    items.find((i) => i.name === "Cabbage").measurements[0].quantity,
    1,
  );
  assert.throws(
    () => groceryItems({ state: normalizeState() }, catalog),
    /Finalize/,
  );
});
test("authenticated handoff returns a vetted link and keeps API key server-side", async () => {
  const { handler, calls } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(
    result.url,
    "https://www.instacart.com/store/shopping_lists/test",
  );
  assert.ok(!JSON.stringify(result).includes("server-only"));
  const call = calls.at(-1);
  assert.ok(call.url.startsWith("https://connect.dev.instacart.tools/"));
  assert.equal(
    call.options.headers.Authorization,
    "Bearer server-only-test-key",
  );
  const body = JSON.parse(call.options.body);
  assert.equal(body.link_type, "shopping_list");
  assert.ok(body.line_items.length > 0);
  assert.match(body.line_items[0].display_text, /estimated package choice/);
  assert.ok(
    !calls
      .slice(0, -1)
      .some((c) => JSON.stringify(c).includes("server-only-test-key")),
  );
});
test("grocery handoff includes canonical package recommendations and household price overrides", () => {
  const current = {
    ...snapshot,
    state: {
      ...snapshot.state,
      locked: { ids: ["keto-eggs", "keto-frittata"] },
      pantry: ["Butter"],
      prices: {
        Eggs: [
          { label: "Store brand", size: 12, price: 1 },
          { label: "Bulk", size: 18, price: 5 },
        ],
      },
    },
  };
  const items = groceryItems(current, catalog, priceRows);
  const eggs = items.find((item) => item.name === "Eggs");
  assert.match(eggs.display_text, /2 x Store brand \(12 pieces\)/);
  assert.equal(eggs.measurements[0].quantity, 16);
  assert.ok(!items.some((item) => item.name === "Butter"));
});
test("origin and missing auth are rejected before upstream requests", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (await handler(request(undefined, { origin: "https://evil.test" }))).status,
    403,
  );
  assert.equal(
    (await handler(request(undefined, { authorization: "" }))).status,
    401,
  );
  assert.equal(calls.length, 0);
});
test("stale menu, draft menu, missing key and invalid response have usable failures", async () => {
  assert.equal(
    (
      await setup().handler(
        request({ householdId: home, week: snapshot.week, revision: 0 }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await setup({}, { ...snapshot, state: normalizeState() }).handler(
        request({ householdId: home, week: snapshot.week, revision: 0 }),
      )
    ).status,
    409,
  );
  assert.equal(
    (await setup({ INSTACART_API_KEY: "" }).handler(request())).status,
    503,
  );
  assert.equal(
    (
      await setup({}, snapshot, {
        products_link_url: "https://evil.test/steal",
      }).handler(request())
    ).status,
    502,
  );
});
test("preflight only allows configured origins and production uses fixed host", async () => {
  const { handler, calls } = setup({ INSTACART_ENV: "production" });
  const preflight = await handler(
    new Request("https://project.supabase.co/functions/v1/grocery-link", {
      method: "OPTIONS",
      headers: { origin },
    }),
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  await handler(request());
  assert.ok(calls.at(-1).url.startsWith("https://connect.instacart.com/"));
});
test("unauthorized membership and network failures do not leak credentials", async () => {
  const denied = createHandler(
    (name) => environment[name],
    async (url) =>
      url.endsWith("/auth/v1/user") ? json({}, 200) : json({}, 403),
  );
  assert.equal((await denied(request())).status, 403);
  const broken = createHandler(
    (name) => environment[name],
    async () => {
      throw Error("server-only-test-key");
    },
  );
  const response = await broken(request());
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("server-only-test-key"));
});
