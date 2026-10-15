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

- Fifteen complete starter recipes, including seven keto-style dinners; keto, time, and vegetarian filters; 1–20 servings.
- Weekly household voting, deterministic tie breaking, and 1–7 planned dinners.
- Votes-first, votes-within-budget, and lowest-grocery-estimate planning priorities.
- Weekly package cost optimization across entire menus, shared ingredients, and pantry items.
- Editable two-package USD price comparisons for every ingredient, with shopping recommendations and subtotal estimates.
- Household timezone controls Monday rollover in shared mode. The browser's local timezone controls local mode.
- Persistent preferences, combined ingredient quantities, and shared pantry checkboxes.
- Owner-only menu finalization, reopening, resetting, and settings in shared mode.
- Supabase email-link sign-in, household creation, private invitation codes, membership removal, leaving, and household deletion.
- Row-level security, validated atomic mutations, version conflict detection, and server-calculated winners.
- Finalized-menu handoff to ChatGPT: preview, copy/download shopping instructions, and open ChatGPT with an explicit cart-review and purchase-approval request.
- Optional authenticated, rate-limited Instacart shopping-list endpoint; the API key stays on the server.
- Clipboard fallback, text downloads, printable menu and list, and private JSON backups. Backups restore into local mode only.
- Keyboard tabs, focus recovery, labelled controls, live feedback, error handling, mobile layout, and automated accessibility checks.
- Vercel configuration and GitHub Actions checks / Pages deployment.

## Activate shared voting and grocery handoff

Follow [Release setup](docs/RELEASE_SETUP.md). Shared mode needs your Supabase project, email delivery, and hosting. The ChatGPT handoff needs no OpenAI API key, Instacart developer key, new migration, or Edge Function deployment; access to Instacart within ChatGPT depends on your account. The optional direct Instacart endpoint requires separate developer credentials. Deployment and live-account behavior must be verified in your own accounts.

Keep public project configuration in `config.json`, Vercel environment variables, or GitHub Actions repository variables. Never add an Instacart key, Supabase service-role key, or database password to browser configuration. The build rejects known secret key formats and only emits its two public configuration fields.

## Household use

Sign in, create a household, and share its invitation code privately. Members sign in on their own phones and join with the code. Each member can vote once per meal. The owner adjusts servings, dinner count, preferences, plan priority, package prices, and budget, then finalizes the menu. Everyone can mark pantry ingredients; finalization prevents votes or settings from changing shopping quantities. Reopening resumes voting. Shortfalls are shown when fewer recipes match than requested; the planner does not substitute incompatible meals.

Shared changes are checked every 15 seconds while the page is visible. Refresh household fetches immediately. Conflicting writes are rejected and the latest state is loaded for review. Shared edits require a connection and are not queued offline. Local mode saves in this browser only and is separate from signed-in household data; local votes are not automatically uploaded.

Copy, download, or print the grocery list at any time. After finalizing a shared menu, Create Instacart shopping link uses the server's current menu and excludes pantry ingredients. The resulting link opens Instacart for product matching, substitutions, prices, address, payment, and checkout. The app never purchases groceries or stores delivery/payment details. The Instacart endpoint has been tested with simulated provider responses; live provider compatibility and production approval must be verified with your API account.

Recipes are estimates. Review food allergens and use vegetarian-certified cheeses and sauces where needed. Keto-style recipes omit major starches and sweetened sauces; nutrition is not calculated or verified. Check product labels and your daily carbohydrate target. Salt, pepper, water, and kitchen equipment are assumed. This is a small curated catalog, not an AI recipe generator or a nutrition service.

## Shop with ChatGPT

1. Finalize your menu, then open **Shopping list → Shop with ChatGPT**.
2. Review the prepared text. It includes meal names, servings, combined grocery quantities, pantry exclusions, package recommendations, estimated costs, dietary preferences, and your item budget.
3. Choose **Copy ChatGPT instructions** or **Download instructions**. If clipboard access is blocked, the text is selected for manual copying.
4. Choose **Open ChatGPT**, select/connect Instacart if it is available in your account, and paste the instructions into the conversation. Nothing is automatically sent to ChatGPT or Instacart.
5. Review the actual cart, quantities, substitutions, delivery/pickup details, fees, taxes, tip, and payable total. Approve any purchase through the checkout flow supported by your ChatGPT/Instacart account. If that integration is unavailable, use the ordinary grocery list for manual shopping.

The generated instructions request explicit approval before any order/payment, and fresh approval if the cart or payable total changes. This website does not place orders or enforce another service's checkout behavior. Preparing instructions is not purchase approval. Actual product matching, prices, availability, cart creation, and checkout depend on the external integration; those capabilities have not been verified with a live account here.

Shared preparation first refreshes the household from Supabase and stops on a failed refresh, revoked access, a reopened menu, or an all-owned grocery list. Prepared text is cleared when the app receives a changed household/week/revision, changes accounts, or reloads. Already copied/downloaded text is a snapshot; replace it manually after plan changes. The export excludes votes, member names, account IDs, emails, invitation codes, and authentication credentials. It includes ingredient/package-label notes and is only shared when you copy/paste or otherwise send it yourself. The link opens the ChatGPT home page without putting your plan in its URL. No custom planner MCP server or automatic background shopping is implemented.

## Saving money and choosing keto

Open **Save on this week’s groceries** and choose **Lowest grocery estimate** to minimize the weekly grocery subtotal, or **Votes within budget** to maximize total votes among menus within your target. A target of $0 means no budget constraint. Votes first preserves the original voting rule; a budget alone does not override that rule. Savings modes compare every eligible combination of the requested dinner count and choose each ingredient's lowest-cost package mix, counting shared ingredients once. Votes break cost ties, and catalog order breaks any remaining ties. Each recipe appears at most once in a week.

In **Household meal preferences**, enable **Keto-style meals only**. It can be combined with vegetarian and quick preferences. If fewer matching recipes exist than requested, the app shows the shortfall and never substitutes incompatible meals. If no eligible menu meets your budget, savings modes show the lowest estimated total and the amount over your target; they do not reduce portions or silently drop dinners.

In **Shopping list → Your store’s package prices**, compare two offers per ingredient, such as store brand and bulk. Enter package sizes in the displayed units and the price of each complete package. Defaults are illustrative USD prices, not live retailer quotes. Estimates include full packages required to buy, excluding ingredients marked as already owned. Mark pantry items only when you have enough for the displayed quantity. Discounts, taxes, delivery/service fees, tips, and verified retailer availability are excluded. Reopen a finalized menu before changing package prices or settings. Prices and planning preferences carry forward to new weeks and are included in backups.

Copy/download lists include package recommendations. Instacart receives those recommendations as display notes with the canonical ingredient quantities. Package labels are notes, not product IDs: the integration cannot enforce a particular SKU, sale, coupon, retailer, or cheapest cart. Review actual products, prices, and package sizes at checkout. Live retailer price comparison requires a separate provider integration; it is not implemented by these estimates.

## Data and maintenance

[Architecture and privacy](docs/ARCHITECTURE.md) explains what is stored and how permissions work. [Release verification](docs/RELEASE_CHECKS.md) distinguishes automated checks from required live-account checks. Export a backup before resetting or deleting a household. Household members can see each other's votes and account email names (the part before `@`). Private invitation codes grant access; rotate them if shared accidentally and remove any unwanted members.

The app supports current Chrome, Edge, Firefox, and Safari 17.4+ (including mobile). A network connection is needed to load the site and use shared features. There is no service worker storing old versions of the app. Adding the site to a phone's home screen uses the included web manifest.
