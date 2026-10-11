# The Dinner Table

A private household dinner planner: suggest meals, vote together, finalize the week's winners, and review one combined grocery list. Works locally without accounts; shared mode connects to Supabase. Deploy the static build on Vercel or GitHub Pages.

## Run locally

Requires Node 22+ and Python 3.

```sh
npm ci
npm start
```

`npm start` builds the site and serves `dist/` on port 4173. `npm run build` creates the production static files. Source files use bundled dependencies, so serve `dist/`, not the repository root. The app uses relative asset URLs and works at a GitHub Pages repository path.

```sh
npm test
npx playwright install chromium
npm run build
npm run test:browser
```

In the Codex environment, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser` to use the installed browser. Browser tests exercise the compiled build and use an embedded Postgres engine for shared household RPCs. Production keys are not required for these tests.

## What is implemented

- Eight complete starter recipes, time and vegetarian filters, and 1–20 servings.
- Weekly household voting, deterministic tie breaking, and 1–7 planned dinners.
- Household timezone controls Monday rollover in shared mode. The browser's local timezone controls local mode.
- Persistent preferences, combined ingredient quantities, and shared pantry checkboxes.
- Owner-only menu finalization, reopening, resetting, and settings in shared mode.
- Supabase email-link sign-in, household creation, private invitation codes, membership removal, leaving, and household deletion.
- Row-level security, validated atomic mutations, version conflict detection, and server-calculated winners.
- Authenticated, rate-limited Instacart shopping-list endpoint; the API key stays on the server.
- Clipboard fallback, text downloads, printable menu and list, and private JSON backups. Backups restore into local mode only.
- Keyboard tabs, focus recovery, labelled controls, live feedback, error handling, mobile layout, and automated accessibility checks.
- Vercel configuration and GitHub Actions checks / Pages deployment.

## Activate shared voting and grocery handoff

Follow [Release setup](docs/RELEASE_SETUP.md). The code and connections are prepared, but a real Supabase project, email delivery, hosting, and Instacart developer credentials still need to be configured by the owner. No live site or external project has been deployed from this checkout.

Keep public project configuration in `config.json`, Vercel environment variables, or GitHub Actions repository variables. Never add an Instacart key, Supabase service-role key, or database password to browser configuration. The build rejects known secret key formats and only emits its two public configuration fields.

## Household use

Sign in, create a household, and share its invitation code privately. Members sign in on their own phones and join with the code. Each member can vote once per meal. The owner adjusts servings, dinner count, and preferences, then finalizes the menu. Everyone can mark pantry ingredients; finalization prevents votes or settings from changing shopping quantities. Reopening resumes voting. Shortfalls are shown when fewer recipes match than requested; the planner does not substitute incompatible meals.

Shared changes are checked every 15 seconds while the page is visible. Refresh household fetches immediately. Conflicting writes are rejected and the latest state is loaded for review. Shared edits require a connection and are not queued offline. Local mode saves in this browser only and is separate from signed-in household data; local votes are not automatically uploaded.

Copy, download, or print the grocery list at any time. After finalizing a shared menu, Create Instacart shopping link uses the server's current menu and excludes pantry ingredients. The resulting link opens Instacart for product matching, substitutions, prices, address, payment, and checkout. The app never purchases groceries or stores delivery/payment details. The Instacart endpoint has been tested with simulated provider responses; live provider compatibility and production approval must be verified with your API account.

Recipes are estimates. Round up to available package sizes, review food allergens, and use vegetarian-certified cheeses and sauces where needed. Salt, pepper, water, and kitchen equipment are assumed. This is a small curated catalog, not an AI recipe generator or a nutrition service.

## Data and maintenance

[Architecture and privacy](docs/ARCHITECTURE.md) explains what is stored and how permissions work. [Release verification](docs/RELEASE_CHECKS.md) distinguishes automated checks from required live-account checks. Export a backup before resetting or deleting a household. Household members can see each other's votes and account email names (the part before `@`). Private invitation codes grant access; rotate them if shared accidentally and remove any unwanted members.

The app supports current Chrome, Edge, Firefox, and Safari 17.4+ (including mobile). A network connection is needed to load the site and use shared features. There is no service worker storing old versions of the app. Adding the site to a phone's home screen uses the included web manifest.
