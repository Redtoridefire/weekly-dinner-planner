import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { meals, rankMeals, normalizeState, planResult } from "../model.js";
import { priceBook } from "../prices.js";
test("Postgres migration: household authorization, concurrency, finalization, invites, and isolation", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`,
  );
  const migrations = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  await db.exec(await readFile(`supabase/migrations/${migrations[0]}`, "utf8"));
  const owner = "00000000-0000-4000-8000-000000000001",
    member = "00000000-0000-4000-8000-000000000002",
    outsider = "00000000-0000-4000-8000-000000000003";
  await db.query("insert into auth.users values($1,$2),($3,$4),($5,$6)", [
    owner,
    "alex@example.test",
    member,
    "sam@example.test",
    outsider,
    "pat@example.test",
  ]);
  const as = async (id) => {
    await db.exec("reset role;set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  const scalar = async (sql, args = []) =>
    Object.values((await db.query(sql, args)).rows[0])[0];
  await as(owner);
  const home = await scalar(
    "select public.dinner_create_household('Our home','America/New_York')",
  );
  let snapshot = await scalar("select public.dinner_snapshot($1)", [home]);
  const mutate = (
    action,
    payload,
    revision = snapshot.state.revision,
    week = snapshot.week,
  ) =>
    scalar("select public.dinner_mutate($1,$2,$3,$4,$5)", [
      home,
      week,
      revision,
      action,
      JSON.stringify(payload),
    ]);
  await t.test(
    "additive upgrade preserves existing votes and finalized menus",
    async () => {
      snapshot = await mutate("vote", { id: "curry", enabled: true });
      snapshot = await mutate("finalize", {});
      const previous = snapshot.state;
      await db.exec("reset role");
      for (const file of migrations.slice(1))
        await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
      await as(owner);
      snapshot = await scalar("select public.dinner_snapshot($1)", [home]);
      assert.deepEqual(snapshot.state.locked, previous.locked);
      assert.deepEqual(snapshot.state.votes, previous.votes);
      assert.equal(snapshot.state.revision, previous.revision);
      snapshot = await mutate("reset", {});
    },
  );
  await t.test(
    "catalog matches shipped recipes and owner snapshot is initialized",
    async () => {
      assert.equal(snapshot.owner, true);
      assert.equal(snapshot.memberCount, 1);
      assert.equal(snapshot.schemaVersion, 2);
      const prices = (
        await db.query("select name,unit,offers from public.dinner_pricebook")
      ).rows;
      assert.deepEqual(
        Object.fromEntries(
          prices.map(({ name, unit, offers }) => [name, { unit, offers }]),
        ),
        priceBook,
      );
      const rows = (
        await db.query(
          "select recipe from public.dinner_catalog order by position",
        )
      ).rows;
      assert.deepEqual(
        rows.map((r) => r.recipe),
        meals,
      );
    },
  );
  const invitation = await scalar("select public.dinner_invite($1)", [home]);
  await t.test(
    "member joins once; votes belong to authenticated user",
    async () => {
      await as(member);
      assert.equal(
        await scalar("select public.dinner_join_household($1)", [invitation]),
        home,
      );
      assert.equal(
        await scalar("select public.dinner_join_household($1)", [invitation]),
        home,
      );
      snapshot = await scalar("select public.dinner_snapshot($1)", [home]);
      assert.equal(snapshot.owner, false);
      assert.equal(snapshot.memberCount, 2);
      snapshot = await mutate("vote", { id: "curry", enabled: true });
      assert.deepEqual(snapshot.state.votes[member], ["curry"]);
      assert.equal(snapshot.state.votes[owner], undefined);
    },
  );
  await t.test(
    "member cannot change settings, finalize, invite, delete or remove owner",
    async () => {
      await assert.rejects(
        mutate("prices", { name: "Eggs", offers: priceBook.Eggs.offers }),
        /owner/,
      );
      await assert.rejects(
        scalar("select public.dinner_mutate_v1($1,$2,$3,$4,$5)", [
          home,
          snapshot.week,
          snapshot.state.revision,
          "settings",
          "{}",
        ]),
        /permission denied/,
      );
      await assert.rejects(
        mutate("settings", {
          servings: 2,
          dinners: 3,
          preferences: { vegetarian: true, quick: true },
        }),
        /owner/,
      );
      await assert.rejects(mutate("finalize", {}), /owner/);
      await assert.rejects(
        scalar("select public.dinner_invite($1)", [home]),
        /owner/,
      );
      await assert.rejects(
        scalar("select public.dinner_delete_household($1)", [home]),
        /owner/,
      );
      await assert.rejects(
        scalar("select public.dinner_remove_member($1,$2)", [home, owner]),
        /owner/,
      );
      await assert.rejects(
        db.query("update public.dinner_weeks set servings=99"),
        /permission denied/,
      );
    },
  );
  await t.test(
    "outsider cannot read household state through RPC or tables",
    async () => {
      await as(outsider);
      await assert.rejects(
        scalar("select public.dinner_snapshot($1)", [home]),
        /belong/,
      );
      await assert.rejects(
        mutate("vote", { id: "tacos", enabled: true }),
        /belong/,
      );
      assert.equal(
        (await db.query("select * from public.dinner_homes")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.dinner_votes")).rows.length,
        0,
      );
      await assert.rejects(
        scalar("select public.dinner_members_list($1)", [home]),
        /belong/,
      );
      await assert.rejects(
        db.query("select * from public.dinner_invites"),
        /permission denied/,
      );
    },
  );
  await t.test(
    "server enforces revision and week instead of overwriting concurrent changes",
    async () => {
      await as(owner);
      await assert.rejects(
        mutate("vote", { id: "tacos", enabled: true }, 0),
        /changed/,
      );
      await assert.rejects(
        mutate(
          "vote",
          { id: "tacos", enabled: true },
          snapshot.state.revision,
          "2000-01-03",
        ),
        /new week/,
      );
      snapshot = await mutate("vote", { id: "tacos", enabled: true });
      assert.deepEqual(snapshot.state.votes[owner], ["tacos"]);
    },
  );
  await t.test(
    "server savings menus match the browser, reject incompatible votes and freeze selected recipes",
    async () => {
      await as(owner);
      snapshot = await scalar("select public.dinner_snapshot($1)", [home]);
      snapshot = await mutate("settings", {
        servings: 4,
        dinners: 7,
        preferences: { vegetarian: false, quick: false, keto: false },
        strategy: "cheapest",
        budget: 0,
      });
      for (const settings of [
        {
          strategy: "cheapest",
          dinners: 7,
          preferences: { vegetarian: false, quick: false, keto: false },
          budget: 0,
        },
        {
          strategy: "cheapest",
          dinners: 3,
          preferences: { vegetarian: false, quick: false, keto: true },
          budget: 0,
        },
        {
          strategy: "balanced",
          dinners: 2,
          preferences: { vegetarian: true, quick: true, keto: true },
          budget: 18,
        },
        {
          strategy: "balanced",
          dinners: 2,
          preferences: { vegetarian: true, quick: true, keto: true },
          budget: 1,
        },
      ]) {
        snapshot = await mutate("settings", { servings: 4, ...settings });
        const expected = planResult(normalizeState(snapshot.state));
        snapshot = await mutate("finalize", {});
        assert.deepEqual(
          snapshot.state.locked.ids,
          expected.meals.map((m) => m.id),
        );
        await assert.rejects(
          mutate("prices", { name: "Eggs", offers: priceBook.Eggs.offers }),
          /finalized/,
        );
        snapshot = await mutate("reopen", {});
      }
      await assert.rejects(
        mutate("vote", { id: "curry", enabled: true }),
        /preferences/,
      );
      const offers = [
        { label: "Store eggs", size: 12, price: 20 },
        { label: "Bulk eggs", size: 18, price: 28 },
      ];
      snapshot = await mutate("prices", { name: "Eggs", offers });
      assert.deepEqual(snapshot.state.prices.Eggs, offers);
      await db.exec("reset role");
      const future = await scalar(
        `insert into public.dinner_weeks(home_id,week_start,servings,dinners,preferences) select id,'2000-01-03',servings,dinners,preferences from public.dinner_homes where id=$1 returning planning`,
        [home],
      );
      assert.equal(future.strategy, snapshot.state.strategy);
      assert.equal(future.budget, snapshot.state.budget);
      assert.deepEqual(future.prices.Eggs, offers);
      await as(owner);
      const expected = planResult(normalizeState(snapshot.state));
      snapshot = await mutate("finalize", {});
      assert.deepEqual(
        snapshot.state.locked.ids,
        expected.meals.map((m) => m.id),
      );
      snapshot = await mutate("reopen", {});
      await assert.rejects(
        mutate("prices", {
          name: "Eggs",
          offers: offers.map((o) => ({ ...o, price: -1 })),
        }),
        /prices/,
      );
      snapshot = await mutate("settings", {
        servings: 4,
        dinners: 5,
        preferences: { vegetarian: false, quick: false, keto: false },
        strategy: "votes",
        budget: 0,
      });
    },
  );
  await t.test(
    "preference validation and canonical finalization match browser ranking",
    async () => {
      await assert.rejects(
        mutate("settings", {
          servings: 2.5,
          dinners: 3,
          preferences: { vegetarian: true, quick: true },
        }),
        /whole numbers/,
      );
      snapshot = await mutate("settings", {
        servings: 2,
        dinners: 7,
        preferences: { vegetarian: true, quick: true },
      });
      await assert.rejects(
        mutate("vote", { id: "chicken", enabled: true }),
        /preferences/,
      );
      snapshot = await mutate("finalize", {});
      assert.deepEqual(
        snapshot.state.locked.ids,
        rankMeals(snapshot.state.votes, 7, {
          vegetarian: true,
          quick: true,
        }).map((m) => m.id),
      );
      assert.equal(snapshot.state.locked.ids.length, 7);
      await assert.rejects(
        mutate("vote", { id: "curry", enabled: false }),
        /finalized/,
      );
      snapshot = await mutate("pantry", { name: "Rice", enabled: true });
      assert.ok(snapshot.state.pantry.includes("Rice"));
      await assert.rejects(
        mutate("pantry", { name: "Made up ingredient", enabled: true }),
        /current shopping list/,
      );
    },
  );
  await t.test(
    "grocery rate limit is enforced in Postgres and drafts cannot reserve",
    async () => {
      assert.equal(
        await scalar("select public.dinner_reserve_grocery($1,$2,$3)", [
          home,
          snapshot.week,
          snapshot.state.revision,
        ]),
        true,
      );
      assert.equal(
        await scalar("select public.dinner_reserve_grocery($1,$2,$3)", [
          home,
          snapshot.week,
          snapshot.state.revision,
        ]),
        false,
      );
      snapshot = await mutate("reopen", {});
      await assert.rejects(
        scalar("select public.dinner_reserve_grocery($1,$2,$3)", [
          home,
          snapshot.week,
          snapshot.state.revision,
        ]),
        /menu changed/,
      );
    },
  );
  await t.test("invitation rotation and expiry are enforced", async () => {
    const fresh = await scalar("select public.dinner_invite($1)", [home]);
    assert.notEqual(fresh, invitation);
    await as(outsider);
    await assert.rejects(
      scalar("select public.dinner_join_household($1)", [invitation]),
      /invalid or expired/,
    );
    await db.exec("reset role");
    await db.query(
      "update public.dinner_invites set expires_at=now()-interval '1 second'",
    );
    await as(outsider);
    await assert.rejects(
      scalar("select public.dinner_join_household($1)", [fresh]),
      /invalid or expired/,
    );
  });
  await t.test(
    "removing member revokes access and removes votes; owner can delete household",
    async () => {
      await as(owner);
      await scalar("select public.dinner_remove_member($1,$2)", [home, member]);
      snapshot = await scalar("select public.dinner_snapshot($1)", [home]);
      assert.equal(snapshot.memberCount, 1);
      assert.equal(snapshot.state.votes[member], undefined);
      await as(member);
      await assert.rejects(
        scalar("select public.dinner_snapshot($1)", [home]),
        /belong/,
      );
      await as(owner);
      await scalar("select public.dinner_delete_household($1)", [home]);
      assert.deepEqual(await scalar("select public.dinner_households()"), []);
    },
  );
  await t.test("anonymous role has no household RPC access", async () => {
    await db.exec("reset role;set role anon");
    await assert.rejects(
      scalar("select public.dinner_households()"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.dinner_homes"),
      /permission denied/,
    );
  });
  await db.close();
});
