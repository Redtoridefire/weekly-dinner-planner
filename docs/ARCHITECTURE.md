# Architecture and privacy

## Runtime

The site is a vanilla JavaScript frontend bundled with esbuild. The Supabase browser SDK manages email-link sign-in and session refresh. The build contains no privileged credentials. `model.js` owns local ranking, ingredient aggregation, data normalization, exact weekly menu selection, and action validation. `prices.js` contains illustrative USD package prices; the package optimizer in `supabase/functions/_shared/pricing.js` is shared with the Edge Function. `cloud.js` connects the same UI to authenticated database RPCs. `public-config.js` restricts emitted frontend configuration to public Supabase fields.

`app.js` separates local mode from shared mode. Shared state is fetched on entry, after a write, on manual refresh, and every 15 seconds while visible. It does not depend on Realtime configuration. An in-flight write pauses controls. Background updates cannot overwrite a newer local snapshot. Household weeks are calculated on the server in the household's timezone, so devices with different timezone settings vote on the same week. A stale-week write is rejected.

## Database trust boundary

All planner tables have RLS enabled. Anonymous users cannot access households or planner RPCs. Authenticated reads are membership-scoped. Browser roles have no direct table write permissions. Private invitation hashes and grocery limits have no browser read permission.

Mutation functions run with an empty search path, validate `auth.uid()`, lock the week's row, and verify its revision before changing state. All writes increment the revision. Votes are assigned to the authenticated user, not a client-supplied identity. Only the owner can change package prices, planning settings, finalize, reopen, reset, invite, remove another member, or delete the household. Any member may vote, update pantry choices, and leave. The owner must delete rather than leave an ownerless household.

Menu finalization uses the database recipe catalog, recorded votes, dietary preferences, pantry exclusions, and saved package prices. Lowest-price mode minimizes full-package spend across all eligible menu combinations. Budget mode maximizes votes among feasible combinations, then cost; an impossible target falls back to minimum cost. The two-package optimizer enumerates package mixtures, rather than assuming the lowest unit price minimizes checkout spend. Monetary prices use cents in JavaScript and exact numeric arithmetic in SQL. Browser/Postgres parity is covered by tests. The new migration retains older implementations as private helpers, with direct RPC access revoked. Meal preferences are enforced on votes and ranking. Ties follow the catalog position. Removing a member deletes their votes, increments affected revisions, and revokes membership. A finalized menu remains the owner's selected snapshot until reopened.

Invitations contain 64 hexadecimal characters generated from two random UUIDs. Only their SHA-256 hashes are stored. Each expires after seven days or ten joins, and generating a fresh invitation invalidates the previous code. Joining is transactional. Each account is limited to ten households; each household to twenty members. This is intended for household use rather than a public social platform.

## Grocery boundary

The Edge Function verifies the caller with Supabase Auth, fetches the membership-scoped current snapshot and canonical catalog, checks finalization and the expected revision, and reserves a database-backed rate-limit slot. It aggregates and scales ingredients, excludes pantry selections, adds package recommendations from the canonical pricebook and household overrides, and calls the fixed Instacart development or production host. It validates returned HTTPS links and does not expose upstream errors or API credentials. Configured origins govern browser CORS access; authorization still relies on authenticated household membership.

The app creates shopping-list links only. It does not purchase, store cards, handle delivery addresses, or promise product availability. Product matching, package sizes, substitutions, price, scheduling, address, and payment are reviewed in Instacart. The live account/API contract remains an owner activation check.

## Stored data

Local mode stores the current week, member names, votes, menu, servings, preferences, budget, package price overrides, and pantry selections in this browser. Default planning settings and prices carry into new weeks. Storage failures keep the current session usable and warn the user to export. Backups are JSON snapshots without auth tokens. Imported data is size-limited and normalized; imports cannot write to a shared household.

Shared mode stores households, authenticated membership IDs, weekly votes and plans, preferences, budget, package prices, pantry selections, invitation hashes, and grocery attempt metadata in Supabase. Supabase Auth stores email/account data. Members can see votes grouped by membership ID and a member list using the email part before `@`; full emails are not exposed through planner RPCs. The user's own email is displayed in their signed-in account controls.

Supabase sign-in sessions are stored by its SDK in the browser. Use trusted household devices and sign out on shared computers. Signing out returns to the separate local planner and does not erase its prior data. Removing a member blocks household access. Deleting a household cascades its planner data and invitations; deleting Auth accounts is an administrator operation through Supabase.

No app analytics, advertising, third-party fonts, or location tracking are included. Instacart receives ingredient/quantity data and estimated package-label notes only when a member asks for a shopping link. Its own policies and checkout apply after navigating there. A web manifest supports adding the site to a home screen, but there is no offline service worker or background purchase job.

## Maintenance

Commit dependency lockfiles and run `npm ci`. CI runs Node tests, a production build, browser flows, and axe accessibility checks. When changing starter recipes, update the browser catalog and add a new migration for an already deployed backend; do not edit an applied production migration. The parity test prevents shipping divergent initial catalogs. Before destructive resets or household deletion, download a private backup. For production backend backup/retention, use your Supabase project's supported backup options.
