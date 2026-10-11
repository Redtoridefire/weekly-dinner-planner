export function publicConfig(input) {
  if (!input || typeof input !== "object")
    throw new Error("The site configuration is invalid.");
  const supabaseUrl =
      typeof input.supabaseUrl === "string" ? input.supabaseUrl.trim() : "",
    supabaseKey =
      typeof input.supabaseKey === "string" ? input.supabaseKey.trim() : "";
  if (Boolean(supabaseUrl) !== Boolean(supabaseKey))
    throw new Error(
      "Set both the public Supabase URL and publishable key, or leave both empty for local mode.",
    );
  if (supabaseUrl) {
    let url;
    try {
      url = new URL(supabaseUrl);
    } catch {
      throw new Error("The Supabase URL is invalid.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "Use an HTTPS Supabase URL without credentials, query parameters, or a fragment.",
      );
  }
  if (supabaseKey.startsWith("sb_secret_"))
    throw new Error(
      "Secret keys must never be included in the browser configuration. Use a public publishable key.",
    );
  if (supabaseKey.split(".").length === 3) {
    let payload;
    try {
      payload = JSON.parse(
        atob(supabaseKey.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
    } catch {
      throw new Error("The public Supabase JWT key is invalid.");
    }
    if (payload.role !== "anon")
      throw new Error(
        "Only an anon JWT key may be published. Never use a service-role key.",
      );
  }
  return { supabaseUrl, supabaseKey };
}
