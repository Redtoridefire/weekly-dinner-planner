# Release 1.2.0 — October 15, 2026

Adds a finalized-menu shopping handoff to ChatGPT with an accessible preview, copy/download actions, and a plain link to ChatGPT. Exported instructions cover meals, portions, combined groceries, pantry exclusions, dietary preferences, package estimates, and budget. They request live cart pricing, an itemized review, and explicit purchase approval before checkout.

Shared preparation refreshes household data first. Prepared text is cleared after source changes and stops on refresh/access errors; clipboard fallback and all-owned/draft guards are included. No new API keys, database migration, or Edge Function deployment is required. The feature does not connect to a ChatGPT account, invoke MCP tools, create a cart, or place orders itself. Instacart availability and checkout capabilities in ChatGPT require account-level verification. The existing direct Instacart endpoint remains optional.

# Release 1.1.0 — October 11, 2026

Adds seven keto-style dinners and dietary combinations, exact weekly menu/package cost comparisons, budget-aware voting and lowest-estimate priorities, editable store package prices, pantry purchase savings, and package recommendations in shopping lists and Instacart display notes. Default prices are illustrative USD estimates; live retailer quotes, SKU selection, and coupons are not connected.

Includes an additive Supabase migration that preserves existing finalized menus, browser/server selection parity checks, and mobile accessibility coverage for the price editor. Apply the savings/keto migration and redeploy the grocery-link function if upgrading an already configured backend; see `docs/RELEASE_SETUP.md`.

# Release 1.0.0 — October 11, 2026

Initial household release: local and authenticated shared voting, private household invitations, owner-managed finalized menus, ingredient aggregation, pantry exclusions, accessible mobile controls, downloads and backups, and an authenticated Instacart shopping-list link endpoint.

Includes the Supabase migration, Edge Function, Vercel configuration, GitHub Pages workflow, and automated Postgres/browser/accessibility checks. Account activation and live grocery-provider verification are documented in `docs/RELEASE_SETUP.md` and remain required before using the shared production release. Checkout, payment, and delivery are handled in Instacart.
