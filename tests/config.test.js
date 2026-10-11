import test from "node:test";
import assert from "node:assert/strict";
import { publicConfig } from "../public-config.js";
test("public config accepts local, publishable, and legacy anon keys only", () => {
  assert.deepEqual(publicConfig({}), { supabaseUrl: "", supabaseKey: "" });
  assert.equal(
    publicConfig({
      supabaseUrl: "https://project.supabase.co",
      supabaseKey: "sb_publishable_example",
    }).supabaseKey,
    "sb_publishable_example",
  );
  const token = (role) =>
    `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  assert.ok(
    publicConfig({
      supabaseUrl: "https://project.supabase.co",
      supabaseKey: token("anon"),
    }),
  );
  assert.throws(
    () =>
      publicConfig({
        supabaseUrl: "https://project.supabase.co",
        supabaseKey: token("service_role"),
      }),
    /service-role/,
  );
  assert.throws(
    () =>
      publicConfig({
        supabaseUrl: "https://project.supabase.co",
        supabaseKey: "sb_secret_private",
      }),
    /Secret keys/,
  );
  assert.throws(
    () => publicConfig({ supabaseUrl: "https://project.supabase.co" }),
    /both/,
  );
  assert.throws(
    () =>
      publicConfig({
        supabaseUrl: "http://project.supabase.co",
        supabaseKey: "sb_publishable_example",
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      publicConfig({
        supabaseUrl: "https://user:password@project.supabase.co",
        supabaseKey: "sb_publishable_example",
      }),
    /credentials/,
  );
});
