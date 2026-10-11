import { build } from "esbuild";
import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { publicConfig } from "./public-config.js";
const source = JSON.parse(await readFile("config.json", "utf8"));
const config = publicConfig({
  supabaseUrl: process.env.SUPABASE_URL || source.supabaseUrl,
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || source.supabaseKey,
});
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["app.js"],
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2022"],
  outfile: "dist/app.js",
  legalComments: "none",
});
for (const file of [
  "index.html",
  "style.css",
  "icon.svg",
  "manifest.webmanifest",
])
  await copyFile(file, `dist/${file}`);
await writeFile("dist/config.json", JSON.stringify(config));
console.log(
  "Built static site in dist/. Supabase:",
  config.supabaseUrl ? "configured" : "local mode",
);
