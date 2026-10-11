# Release 1.1.0 — October 11, 2026

Adds seven keto-style dinners and dietary combinations, exact weekly menu/package cost comparisons, budget-aware voting and lowest-estimate priorities, editable store package prices, pantry purchase savings, and package recommendations in shopping lists and Instacart display notes. Default prices are illustrative USD estimates; live retailer quotes, SKU selection, and coupons are not connected.

Includes an additive Supabase migration that preserves existing finalized menus, browser/server selection parity checks, and mobile accessibility coverage for the price editor. Apply the savings/keto migration and redeploy the grocery-link function if upgrading an already configured backend; see `docs/RELEASE_SETUP.md`.

# Release 1.0.0 — October 11, 2026

Initial household release: local and authenticated shared voting, private household invitations, owner-managed finalized menus, ingredient aggregation, pantry exclusions, accessible mobile controls, downloads and backups, and an authenticated Instacart shopping-list link endpoint.

Includes the Supabase migration, Edge Function, Vercel configuration, GitHub Pages workflow, and automated Postgres/browser/accessibility checks. Account activation and live grocery-provider verification are documented in `docs/RELEASE_SETUP.md` and remain required before using the shared production release. Checkout, payment, and delivery are handled in Instacart.
