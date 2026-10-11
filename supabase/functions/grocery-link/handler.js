import { cheapestPurchase, validOffers } from "../_shared/pricing.js";
const units = {
  pieces: "each",
  heads: "each",
  loaves: "each",
  cans: "each",
  g: "g",
  ml: "ml",
  tbsp: "tbsp",
  tsp: "tsp",
};
export function groceryItems(snapshot, catalog, priceRows = []) {
  const state = snapshot?.state;
  if (!state?.locked?.ids?.length)
    throw new Error("Finalize your menu before creating a grocery link.");
  if (
    !Number.isInteger(state.servings) ||
    state.servings < 1 ||
    state.servings > 20
  )
    throw new Error("Invalid serving count.");
  const totals = new Map();
  for (const id of state.locked.ids) {
    const recipe = catalog.find((row) => row.id === id)?.recipe;
    if (!recipe)
      throw new Error("A recipe is missing. Refresh your household.");
    for (const [name, unit, amount] of recipe.ingredients) {
      const key = `${name}|${unit}`;
      const item = totals.get(key) || { name, unit, quantity: 0 };
      item.quantity += (amount * state.servings) / 4;
      totals.set(key, item);
    }
  }
  return [...totals.values()]
    .filter((i) => !state.pantry.includes(i.name))
    .map((i) => {
      const unit = units[i.unit] || i.unit,
        quantity =
          unit === "each"
            ? Math.ceil(i.quantity)
            : Number(i.quantity.toFixed(2));
      const name =
        i.unit === "cans"
          ? `${i.name}, ${i.name === "Coconut milk" ? "13.5" : i.name === "Crushed tomatoes" ? "28" : "15"} oz can`
          : i.name;
      const offers =
        state.prices?.[i.name] ||
        priceRows.find((row) => row.name === i.name)?.offers;
      let recommendation = "";
      if (validOffers(offers)) {
        const quote = cheapestPurchase(i.quantity, offers);
        recommendation = `; estimated package choice: ${quote.counts
          .map((n, j) =>
            n ? `${n} x ${offers[j].label} (${offers[j].size} ${i.unit})` : "",
          )
          .filter(Boolean)
          .join(" + ")}`;
      }
      return {
        name,
        display_text: `${i.name} — ${quantity} ${i.unit}${recommendation}`,
        measurements: [{ quantity, unit }],
      };
    });
}
export function createHandler(env, request = fetch) {
  return async (req) => {
    const origin = req.headers.get("origin") || "";
    const origins = (env("APP_ORIGINS") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    if (origins.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Headers"] =
        "authorization, apikey, content-type, x-client-info";
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    }
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers });
    if (!origins.length)
      return reply(503, {
        error:
          "Grocery handoff needs APP_ORIGINS configured by the household owner. Use Copy shopping list for now.",
      });
    if (!origins.includes(origin))
      return reply(403, {
        error: "This site is not allowed to use the grocery integration.",
      });
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return reply(405, { error: "Use POST for this operation." });
    const authorization = req.headers.get("authorization") || "";
    if (!/^Bearer \S+$/i.test(authorization))
      return reply(401, { error: "Sign in before creating a grocery link." });
    const base = env("SUPABASE_URL"),
      key = env("SUPABASE_ANON_KEY");
    if (!base || !key)
      return reply(503, {
        error:
          "Shared grocery configuration is incomplete. Use Copy shopping list for now.",
      });
    const apiHeaders = {
      apikey: key,
      Authorization: authorization,
      "Content-Type": "application/json",
    };
    try {
      const user = await request(`${base}/auth/v1/user`, {
        headers: apiHeaders,
        signal: AbortSignal.timeout(10000),
      });
      if (!user.ok)
        return reply(401, { error: "Your session expired. Sign in again." });
      const length = Number(req.headers.get("content-length") || 0);
      if (length > 4096) return reply(413, { error: "Request is too large." });
      const text = await req.text();
      if (text.length > 4096)
        return reply(413, { error: "Request is too large." });
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return reply(400, { error: "Invalid request." });
      }
      if (
        !/^[0-9a-f-]{36}$/i.test(body.householdId || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.week || "") ||
        !Number.isInteger(body.revision)
      )
        return reply(400, { error: "Invalid household or menu version." });
      const response = await request(`${base}/rest/v1/rpc/dinner_snapshot`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ household_id: body.householdId }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        return reply(403, {
          error:
            "You do not have access to this household. Refresh or sign in again.",
        });
      const snapshot = await response.json();
      if (
        snapshot.week !== body.week ||
        snapshot.state.revision !== body.revision
      )
        return reply(409, {
          error:
            "Your household menu changed. Refresh before creating a shopping link.",
        });
      if (!snapshot.state.locked)
        return reply(409, {
          error: "Finalize your menu before creating a grocery link.",
        });
      const catalogResponse = await request(
        `${base}/rest/v1/dinner_catalog?select=id,recipe`,
        { headers: apiHeaders, signal: AbortSignal.timeout(10000) },
      );
      if (!catalogResponse.ok)
        return reply(503, {
          error: "Recipes could not be loaded. Try again or copy your list.",
        });
      const priceResponse = await request(
        `${base}/rest/v1/dinner_pricebook?select=name,offers`,
        { headers: apiHeaders, signal: AbortSignal.timeout(10000) },
      );
      if (!priceResponse.ok)
        return reply(503, {
          error:
            "Package estimates could not be loaded. Apply the latest database migration or copy your shopping list.",
        });
      const items = groceryItems(
        snapshot,
        await catalogResponse.json(),
        await priceResponse.json(),
      );
      if (!items.length)
        return reply(400, {
          error:
            "Everything is marked as already in your pantry. There is nothing to order.",
        });
      const token = env("INSTACART_API_KEY");
      if (!token)
        return reply(503, {
          error:
            "The owner needs to configure an Instacart Developer Platform API key. Use Copy shopping list for now.",
        });
      const mode = env("INSTACART_ENV") || "development";
      if (!["development", "production"].includes(mode))
        return reply(503, {
          error: "The grocery integration environment is invalid.",
        });
      const reservation = await request(
        `${base}/rest/v1/rpc/dinner_reserve_grocery`,
        {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({
            household_id: body.householdId,
            expected_week: body.week,
            expected_revision: body.revision,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!reservation.ok)
        return reply(409, {
          error:
            "The household menu changed or access was revoked. Refresh before trying again.",
        });
      if ((await reservation.json()) !== true)
        return reply(429, {
          error:
            "Wait 30 seconds between grocery links. Each household can create up to 20 links per day. You can still copy your list.",
        });
      const host =
        mode === "production"
          ? "connect.instacart.com"
          : "connect.dev.instacart.tools";
      const upstream = await request(
        `https://${host}/idp/v1/products/products_link`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            title: `Dinner Table — week of ${body.week}`,
            link_type: "shopping_list",
            expires_in: 7,
            line_items: items,
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!upstream.ok)
        return reply(upstream.status === 429 ? 429 : 502, {
          error:
            upstream.status === 429
              ? "Instacart is busy. Wait a moment, then retry."
              : "Instacart could not create the shopping link. The owner should check API access and environment. You can still copy the shopping list.",
        });
      const result = await upstream.json();
      let url;
      try {
        url = new URL(result.products_link_url);
      } catch {
        return reply(502, {
          error:
            "Instacart returned an incomplete link. Use Copy shopping list.",
        });
      }
      if (
        url.protocol !== "https:" ||
        !/(^|\.)instacart\.(com|tools)$/.test(url.hostname)
      )
        return reply(502, {
          error:
            "Instacart returned an unexpected link. Use Copy shopping list.",
        });
      return reply(200, { url: url.href });
    } catch {
      return reply(503, {
        error:
          "The grocery connection timed out or is unavailable. Retry or use Copy shopping list.",
      });
    }
  };
}
