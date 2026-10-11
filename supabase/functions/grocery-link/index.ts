import { createHandler } from "./handler.js";
Deno.serve(createHandler((name: string) => Deno.env.get(name)));
