import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

test("ChatGPT handoff previews the finalized menu, copies/downloads, and invalidates after changes", async ({
  page,
}) => {
  await page.route("**/config.json", (route) =>
    route.fulfill({ json: { supabaseUrl: "", supabaseKey: "" } }),
  );
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  const outbound = [];
  page.on("request", (request) => {
    if (/chatgpt\.com|instacart\./.test(request.url()))
      outbound.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#connection-state")).toHaveText("Local mode");
  await page.locator("#tab-shop").click();
  await expect(page.locator("#prepare-chatgpt")).toBeDisabled();
  await expect(page.locator("#chatgpt-state")).toContainText(
    "Finalize your menu",
  );
  await page.locator("#tab-vote").click();
  await page.locator("#vote .preferences summary").click();
  await page.locator("#keto-only").check();
  await page.locator("#vegetarian-only").check();
  await page.locator("#servings").fill("2");
  await page.locator("#servings").press("Tab");
  await page.locator("#dinners").selectOption("2");
  await page.locator("#tab-plan").click();
  await page.locator("#finalize").click();
  await page.locator("#tab-shop").click();
  await page.locator('[data-ingredient="Butter"]').check();
  await page.locator("#prepare-chatgpt").click();
  await expect(page.locator("#chatgpt-handoff")).toBeVisible();
  await expect(page.locator("#prepare-chatgpt")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  const text = await page.locator("#chatgpt-prompt").inputValue();
  expect(text).toContain("Cheesy cabbage & egg skillet — serves 2");
  expect(text).toContain("Eggs: 8 pieces required");
  expect(
    text.split("GROCERIES TO BUY")[1].split("PANTRY EXCLUSIONS")[0],
  ).not.toContain("Butter");
  expect(text).toContain(
    "explicit approval of that specific final cart and payable total",
  );
  await page.locator("#copy-chatgpt").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  const downloading = page.waitForEvent("download");
  await page.locator("#download-chatgpt").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^dinner-chatgpt-.*\.txt$/);
  expect(await readFile(await download.path(), "utf8")).toBe(text);
  expect(outbound).toEqual([]);
  await expect(page.locator("#open-chatgpt")).toHaveAttribute(
    "href",
    "https://chatgpt.com/",
  );
  await expect(page.locator("#open-chatgpt")).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.context().route("https://chatgpt.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>ChatGPT handoff test</title>",
    }),
  );
  const opening = page.waitForEvent("popup");
  await page.locator("#open-chatgpt").click();
  const popup = await opening;
  await popup.waitForLoadState();
  expect(popup.url()).toBe("https://chatgpt.com/");
  expect(outbound.every((url) => !url.includes("?"))).toBe(true);
  await popup.close();
  await page.locator('[data-ingredient="Eggs"]').check();
  await expect(page.locator("#chatgpt-handoff")).toBeHidden();
  await expect(page.locator("#chatgpt-prompt")).toHaveValue("");
  await page.locator("#prepare-chatgpt").click();
  expect(
    (await page.locator("#chatgpt-prompt").inputValue())
      .split("GROCERIES TO BUY")[1]
      .split("PANTRY EXCLUSIONS")[0],
  ).not.toContain("Eggs");
  await page.reload();
  await page.locator("#tab-shop").click();
  await expect(page.locator("#chatgpt-handoff")).toBeHidden();
  for (const name of await page
    .locator("[data-ingredient]")
    .evaluateAll((els) => els.map((el) => el.dataset.ingredient)))
    await page.locator(`[data-ingredient="${name}"]`).check();
  await expect(page.locator("#prepare-chatgpt")).toBeDisabled();
  await expect(page.locator("#chatgpt-state")).toContainText("nothing to shop");
  await page.locator("#tab-plan").click();
  await page.locator("#finalize").click();
  await page.locator('#confirm-dialog button[value="confirm"]').click();
  await page.locator("#tab-shop").click();
  await expect(page.locator("#prepare-chatgpt")).toBeDisabled();
  await expect(page.locator("#chatgpt-state")).toContainText(
    "Finalize your menu",
  );
});

test("ChatGPT instructions remain manually copyable when clipboard access is blocked", async ({
  page,
}) => {
  await page.route("**/config.json", (route) =>
    route.fulfill({ json: { supabaseUrl: "", supabaseKey: "" } }),
  );
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("blocked");
        },
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator("#connection-state")).toHaveText("Local mode");
  await page.locator("#tab-plan").click();
  await page.locator("#finalize").click();
  await page.locator("#tab-shop").click();
  await page.locator("#prepare-chatgpt").click();
  await page.locator("#copy-chatgpt").click();
  await expect(page.locator("#chatgpt-prompt")).toBeFocused();
  await expect(page.locator("#status")).toContainText(
    "highlighted ChatGPT instructions",
  );
  expect(
    await page
      .locator("#chatgpt-prompt")
      .evaluate((el) => el.selectionEnd - el.selectionStart),
  ).toBe((await page.locator("#chatgpt-prompt").inputValue()).length);
  await expect(page.locator("#copy-fallback-label")).toBeHidden();
});

test("keto savings, price editing, budget shortfalls, and package downloads work on mobile", async ({
  page,
}) => {
  await page.route("**/config.json", (r) =>
    r.fulfill({ json: { supabaseUrl: "", supabaseKey: "" } }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#vote .preferences summary").click();
  await page.locator("#keto-only").check();
  await expect(page.locator(".card")).toHaveCount(7);
  await page.locator("#vegetarian-only").check();
  await expect(page.locator(".card")).toHaveCount(3);
  await page.locator("#savings-controls summary").click();
  await page.locator("#strategy").selectOption("cheapest");
  await page.locator("#dinners").selectOption("2");
  await page.locator("#budget").fill("1");
  await page.locator("#budget").press("Tab");
  await expect(page.locator("#budget-summary")).toContainText(
    "No eligible menu fits",
  );
  await expect(page.locator("#budget-summary")).toContainText("$16.65");
  await page.locator("#tab-shop").click();
  await page.locator("#price-editor > summary").click();
  await page.locator("#price-search").fill("Eggs");
  await page.locator("#price-forms summary").click();
  const form = page.locator("#price-forms form");
  await form.locator('[name="price-0"]').fill("40");
  await form.locator('[name="price-1"]').fill("60");
  await form.locator("button").click();
  await expect(form.locator('[name="price-0"]')).toHaveValue("40");
  await expect(page.locator("#budget-summary")).toContainText("$64.00");
  await page.locator("#tab-plan").click();
  await page.locator("#finalize").click();
  await page.locator("#tab-shop").click();
  await expect(form.locator("button")).toBeDisabled();
  await expect(page.locator(".package-choice").first()).toContainText(
    "estimated",
  );
  const downloaded = page.waitForEvent("download");
  await page.locator("#download").click();
  const download = await downloaded;
  const text = await readFile(await download.path(), "utf8");
  expect(text).toContain("Buy ");
  expect(text).toContain("Estimated grocery subtotal");
  const analysis = await new AxeBuilder({ page }).analyze();
  expect(analysis.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await page.locator("#savings-controls summary").click();
  await expect(page.locator("#strategy")).toHaveValue("cheapest");
  await expect(page.locator("#budget")).toHaveValue("1");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (/^dinner-table:\d{4}/.test(key)) localStorage.removeItem(key);
  });
  await page.reload();
  await expect(page.locator("#dinners")).toHaveValue("2");
  await expect(page.locator("#budget-summary")).toContainText("$64.00");
  expect(errors).toEqual([]);
});

test("configured sign-in submits an email link request and gives delivery feedback", async ({
  page,
}) => {
  await page.route("**/config.json", (r) =>
    r.fulfill({
      json: {
        supabaseUrl: "https://project.supabase.co",
        supabaseKey: "public-test-key",
      },
    }),
  );
  let submitted;
  await page.route("https://project.supabase.co/auth/v1/**", async (route) => {
    submitted = {
      url: route.request().url(),
      body: route.request().postDataJSON(),
    };
    await route.fulfill({
      json: {},
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/");
  await expect(page.locator("#sign-in-form")).toBeVisible();
  await page.locator("#email").fill("alex@example.test");
  await page.locator("#sign-in-form button").click();
  await expect(page.locator("#status")).toContainText("Check your email");
  expect(submitted.body.email).toBe("alex@example.test");
  expect(submitted.url).toContain("/auth/v1/otp");
  expect(new URL(submitted.url).searchParams.get("redirect_to")).toBe(
    new URL("/", page.url()).href,
  );
});

test("late changes cancel a menu confirmation instead of acting on a different version", async ({
  page,
}) => {
  await page.route("**/config.json", (r) =>
    r.fulfill({ json: { supabaseUrl: "", supabaseKey: "" } }),
  );
  await page.goto("/");
  await expect(page.locator("#connection-state")).toHaveText("Local mode");
  await page.locator("#tab-plan").click();
  await page.locator("#finalize").click();
  await expect(page.locator("#finalize")).toHaveText("Reopen voting");
  await page.locator("#finalize").click();
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      /^dinner-table:\d{4}/.test(k),
    );
    const state = JSON.parse(localStorage.getItem(key));
    state.revision++;
    state.pantry = ["Rice"];
    localStorage.setItem(key, JSON.stringify(state));
    dispatchEvent(new StorageEvent("storage", { key }));
  });
  await page.locator('#confirm-dialog button[value="confirm"]').click();
  await expect(page.locator("#error")).toContainText(
    "changed while you were deciding",
  );
  await expect(page.locator("#finalize")).toHaveText("Reopen voting");
});
test("local household flow, pantry, finalized persistence, keyboard tabs, and mobile accessibility", async ({
  page,
}) => {
  await page.route("**/config.json", (r) =>
    r.fulfill({ json: { supabaseUrl: "", supabaseKey: "" } }),
  );
  await page.goto("/");
  await expect(page.locator("#connection-state")).toHaveText("Local mode");
  await page.locator("#voter").fill("Alex");
  await page.locator('[data-meal="curry"]').click();
  await expect(page.locator('[data-meal="curry"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#voter").fill("Sam");
  await page.locator('[data-meal="curry"]').click();
  await page.locator("#vote .preferences summary").click();
  await page.locator("#vegetarian-only").check();
  await page.locator("#quick-only").check();
  await expect(page.locator(".card")).toHaveCount(7);
  await page.locator("#tab-vote").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tab-plan")).toBeFocused();
  await expect(page.locator("#tab-plan")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".plan-row h3").first()).toContainText("curry");
  await expect(page.locator(".plan-row")).toHaveCount(5);
  await page.locator("#finalize").click();
  await expect(page.locator("#servings")).toBeDisabled();
  await page.reload();
  await page.locator("#tab-plan").click();
  await expect(page.locator("#finalize")).toHaveText("Reopen voting");
  await page.locator("#tab-shop").click();
  await page.locator('[data-ingredient="Rice"]').check();
  await expect(page.locator('[data-ingredient="Rice"]')).toBeChecked();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#copy").click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).not.toContain("Rice:");
  expect(text).not.toContain("(draft menu)");
  const downloaded = page.waitForEvent("download");
  await page.locator("#download").click();
  expect((await downloaded).suggestedFilename()).toMatch(/dinner-shopping/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  let result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
  await page.locator("#tab-plan").click();
  await page.locator("#finalize").click();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
  await page.locator('#confirm-dialog button[value="confirm"]').click();
  await expect(page.locator("#servings")).toBeEnabled();
  await page.locator("#tab-vote").click();
  result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
test("malformed storage, clipboard fallback, invalid servings, and backup restoration recover safely", async ({
  page,
}) => {
  await page.route("**/config.json", (r) =>
    r.fulfill({ json: { supabaseUrl: "", supabaseKey: "" } }),
  );
  await page.addInitScript(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const week = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem(
      `dinner-table:${week}`,
      JSON.stringify({
        votes: { alex: "invalid" },
        servings: -99,
        locked: { ids: ["fake"] },
        pantry: null,
      }),
    );
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("unavailable");
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("#servings")).toHaveValue("4");
  await page.locator("#servings").fill("2.5");
  await page.locator("#servings").dispatchEvent("change");
  await expect(page.locator("#error")).toContainText("whole number");
  await expect(page.locator("#servings")).toHaveValue("4");
  await page.locator("#tab-shop").click();
  await page.locator("#copy").click();
  await expect(page.locator("#copy-fallback")).toBeVisible();
  await expect(page.locator("#copy-fallback")).toContainText("");
  expect(await page.locator("#copy-fallback").inputValue()).toContain(
    "Black beans",
  );
  await page.locator("#import").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        week: "2026-10-05",
        state: {
          votes: { alex: ["curry"] },
          servings: 2,
          dinners: 3,
          pantry: [],
          locked: null,
        },
      }),
    ),
  });
  await page.locator('#confirm-dialog button[value="confirm"]').click();
  await expect(page.locator("#servings")).toHaveValue("2");
  await page.locator("#tab-plan").click();
  await expect(page.locator(".plan-row h3").first()).toContainText("curry");
});
test("shared household works between two authenticated devices with real Postgres RPCs", async ({
  browser,
}) => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  const owner = "00000000-0000-4000-8000-000000000001",
    member = "00000000-0000-4000-8000-000000000002";
  await db.query("insert into auth.users values($1,$2),($3,$4)", [
    owner,
    "alex@example.test",
    member,
    "sam@example.test",
  ]);
  const rpcArgs = {
    dinner_households: [],
    dinner_create_household: ["household_name", "household_timezone"],
    dinner_snapshot: ["household_id"],
    dinner_invite: ["household_id"],
    dinner_join_household: ["invite_token"],
    dinner_mutate: [
      "household_id",
      "expected_week",
      "expected_revision",
      "action_name",
      "action_payload",
    ],
    dinner_members_list: ["household_id"],
    dinner_remove_member: ["household_id", "member_id"],
    dinner_delete_household: ["household_id"],
  };
  async function device(id, email) {
    const context = await browser.newContext();
    const session = {
      access_token: `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test`,
      refresh_token: "test-refresh",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id,
        email,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    };
    await context.addInitScript(
      (s) => localStorage.setItem("sb-project-auth-token", JSON.stringify(s)),
      session,
    );
    const page = await context.newPage();
    await page.route("**/config.json", (r) =>
      r.fulfill({
        json: {
          supabaseUrl: "https://project.supabase.co",
          supabaseKey: "public-test-key",
        },
      }),
    );
    await page.route("https://project.supabase.co/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      const name = url.pathname.split("/").at(-1);
      if (req.method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
          },
        });
        return;
      }
      if (url.pathname.includes("/functions/")) {
        await route.fulfill({
          json: { url: "https://www.instacart.com/store/shopping_lists/test" },
        });
        return;
      }
      if (url.pathname.includes("/auth/")) {
        await route.fulfill({ json: {} });
        return;
      }
      try {
        if (!Object.hasOwn(rpcArgs, name)) throw Error("Unknown RPC");
        const args = req.postDataJSON() || {};
        const values = rpcArgs[name].map((k) =>
          typeof args[k] === "object" ? JSON.stringify(args[k]) : args[k],
        );
        const data = await db.transaction(async (tx) => {
          await tx.exec("set local role authenticated");
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
            id,
          ]);
          const result = await tx.query(
            `select public.${name}(${values.map((_, i) => "$" + (i + 1)).join(",")})`,
            values,
          );
          return Object.values(result.rows[0])[0];
        });
        await route.fulfill({
          json: data,
          headers: { "access-control-allow-origin": "*" },
        });
      } catch (e) {
        await route.fulfill({
          status: 400,
          json: { message: e.message, code: "P0001" },
          headers: { "access-control-allow-origin": "*" },
        });
      }
    });
    await page.goto("/");
    await expect(page.locator("#connection-state")).toHaveText("Local trial");
    return { context, page };
  }
  const a = await device(owner, "alex@example.test"),
    b = await device(member, "sam@example.test");
  try {
    await a.page.locator("#show-create").click();
    await a.page.locator("#home-name").fill("Our <table>");
    await a.page.locator("#home-timezone").selectOption("America/New_York");
    await a.page.locator("#create-form button").click();
    await expect(a.page.locator("#connection-state")).toHaveText(
      "Shared household",
    );
    await expect(a.page.locator("#connection-description")).toContainText(
      "Our <table>",
    );
    await a.page.locator("#invite").click();
    await a.page.locator('#confirm-dialog button[value="confirm"]').click();
    await expect(a.page.locator("#new-invite")).not.toHaveValue("");
    const code = await a.page.locator("#new-invite").inputValue();
    await b.page.locator("#show-join").click();
    await b.page.locator("#invite-code").fill(code);
    await b.page.locator("#join-form button").click();
    await expect(b.page.locator("#connection-state")).toHaveText(
      "Shared household",
    );
    await expect(b.page.locator("#servings")).toBeDisabled();
    await a.page.locator("#vote .preferences summary").click();
    await a.page.locator("#keto-only").check();
    await b.page.locator("#refresh").click();
    await expect(b.page.locator(".card")).toHaveCount(7);
    await expect(b.page.locator("#keto-only")).toBeDisabled();
    await a.page.locator("#keto-only").uncheck();
    await a.page.locator("#savings-controls > summary").click();
    await a.page.locator("#strategy").selectOption("balanced");
    await a.page.locator("#tab-shop").click();
    await a.page.locator("#price-editor > summary").click();
    await a.page.locator("#price-search").fill("Olive oil");
    await a.page.locator("#price-forms summary").click();
    await a.page.locator('#price-forms [name="price-0"]').fill("4");
    await a.page.locator("#price-forms button").click();
    await b.page.locator("#refresh").click();
    await expect(b.page.locator(".card")).toHaveCount(15);
    await expect(b.page.locator("#strategy")).toHaveValue("balanced");
    await b.page.locator("#tab-shop").click();
    await b.page.locator("#price-editor > summary").click();
    await b.page.locator("#price-search").fill("Olive oil");
    await b.page.locator("#price-forms summary").click();
    await expect(b.page.locator('#price-forms [name="price-0"]')).toHaveValue(
      "4",
    );
    await expect(b.page.locator("#price-forms button")).toBeDisabled();
    await b.page.locator("#tab-vote").click();
    await b.page.locator('[data-meal="curry"]').click();
    await expect(b.page.locator('[data-meal="curry"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await a.page.locator("#refresh").click();
    await a.page.locator("#tab-plan").click();
    await expect(a.page.locator(".plan-row h3").first()).toContainText("curry");
    await a.page.locator("#finalize").click();
    await b.page.locator("#refresh").click();
    await expect(b.page.locator('[data-meal="curry"]')).toBeDisabled();
    await b.page.locator("#tab-shop").click();
    await b.page.locator('[data-ingredient="Rice"]').check();
    await a.page.locator("#refresh").click();
    await a.page.locator("#tab-shop").click();
    await expect(a.page.locator('[data-ingredient="Rice"]')).toBeChecked();
    await a.page.locator("#grocery").click();
    await expect(a.page.locator("#grocery-link")).toHaveAttribute(
      "href",
      "https://www.instacart.com/store/shopping_lists/test",
    );
    await a.page.locator("#price-search").focus();
    const changed = b.page.locator("[data-ingredient]:not(:checked)").first();
    const changedName = await changed.getAttribute("data-ingredient");
    await b.page.locator(`[data-ingredient="${changedName}"]`).check();
    await a.page.locator("#prepare-chatgpt").click();
    await expect(a.page.locator("#chatgpt-handoff")).toBeVisible();
    const prompt = await a.page.locator("#chatgpt-prompt").inputValue();
    expect(prompt).toContain(`${changedName}:`);
    expect(
      prompt.split("GROCERIES TO BUY")[1].split("PANTRY EXCLUSIONS")[0],
    ).not.toContain(`${changedName}:`);
    expect(prompt).not.toContain("alex@example.test");
    expect(prompt).not.toContain("sam@example.test");
    await b.page.locator(`[data-ingredient="${changedName}"]`).uncheck();
    await a.page.locator("#refresh").click();
    await expect(a.page.locator("#chatgpt-handoff")).toBeHidden();
    await a.page.route(
      "https://project.supabase.co/rest/v1/rpc/dinner_snapshot",
      (route) =>
        route.fulfill({
          status: 503,
          json: { message: "Snapshot temporarily unavailable" },
        }),
    );
    await a.page.locator("#prepare-chatgpt").click();
    await expect(a.page.locator("#error")).toContainText(
      "Snapshot temporarily unavailable",
    );
    await expect(a.page.locator("#chatgpt-prompt")).toHaveValue("");
    await a.page.unroute(
      "https://project.supabase.co/rest/v1/rpc/dinner_snapshot",
    );
    await a.page.locator("#prepare-chatgpt").click();
    await expect(a.page.locator("#chatgpt-handoff")).toBeVisible();
    const accessibility = await new AxeBuilder({ page: a.page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await a.page.locator("#manage-members").click();
    await expect(a.page.locator(".member-row")).toHaveCount(2);
    await a.page.locator(`[data-remove-member="${member}"]`).click();
    await a.page.locator('#confirm-dialog button[value="confirm"]').click();
    await b.page.locator("#prepare-chatgpt").click();
    await expect(b.page.locator("#error")).toContainText("belong");
    await expect(b.page.locator("#chatgpt-handoff")).toBeHidden();
    await b.page.locator("#refresh").click();
    await expect(b.page.locator("#connection-state")).toHaveText("Local trial");
  } finally {
    await a.context.close();
    await b.context.close();
    await db.close();
  }
});
