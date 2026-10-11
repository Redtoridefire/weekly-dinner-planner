import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "./public-config.js";
export class Cloud {
  constructor(input) {
    const config = publicConfig(input);
    this.client = createClient(config.supabaseUrl, config.supabaseKey, {
      global: {
        fetch: (url, options = {}) => {
          const timeout = AbortSignal.timeout(
            String(url).includes("/functions/") ? 60000 : 15000,
          );
          return fetch(url, {
            ...options,
            signal: options.signal
              ? AbortSignal.any([options.signal, timeout])
              : timeout,
          });
        },
      },
    });
  }
  async rpc(name, args = {}) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  }
  async session() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return data.session;
  }
  async signIn(email) {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
  }
  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }
  households() {
    return this.rpc("dinner_households");
  }
  create(name, timeZone) {
    return this.rpc("dinner_create_household", {
      household_name: name,
      household_timezone: timeZone,
    });
  }
  join(token) {
    return this.rpc("dinner_join_household", { invite_token: token });
  }
  invite(id) {
    return this.rpc("dinner_invite", { household_id: id });
  }
  snapshot(id) {
    return this.rpc("dinner_snapshot", { household_id: id });
  }
  mutate(id, week, revision, action, payload) {
    return this.rpc("dinner_mutate", {
      household_id: id,
      expected_week: week,
      expected_revision: revision,
      action_name: action,
      action_payload: payload,
    });
  }
  async grocery(id, week, revision) {
    const { data, error } = await this.client.functions.invoke("grocery-link", {
      body: { householdId: id, week, revision },
    });
    if (error) {
      let message = "Grocery handoff failed. Retry or use Copy shopping list.";
      try {
        const body = await error.context?.json();
        if (body?.error) message = body.error;
      } catch {}
      throw new Error(message);
    }
    return data;
  }
}
