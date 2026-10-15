# Release setup — owner actions

The repository contains the frontend, database migrations, Edge Function, tests, and hosting configuration. These steps connect your accounts; no secret values belong in chat or in Git.

## 1. Create the Supabase project

Create a project in your Supabase account, or use your existing project. The SQL Editor needs the **complete SQL contents**, not a filename or file path. For each file below, open it in GitHub, click **Raw** or **Copy raw file**, and copy all the code. Paste it into a new Supabase SQL Editor query and click **Run**. Run the first file successfully before the second:

1. [Initial database SQL](https://github.com/Redtoridefire/weekly-dinner-planner/blob/main/supabase/migrations/202610110001_dinner_table.sql)
2. [Savings and keto SQL](https://github.com/Redtoridefire/weekly-dinner-planner/blob/main/supabase/migrations/202610110002_savings_keto.sql)

If you see `syntax error at or near "supabase"` after entering a path, clear the query and paste the file's SQL contents instead. That failed path-only query did not change the database.

After both files succeed, run this separate SQL query:

```sql
select
  (select count(*) from public.dinner_catalog) as recipes,
  (select count(*) from public.dinner_pricebook) as priced_ingredients;
```

Expect **15 recipes** and **41 priced ingredients**.

Alternatively, link the Supabase CLI to your project and run `supabase db push`. If the first migration is already installed, apply only the new savings/keto migration and redeploy the updated grocery-link Edge Function. The upgrade preserves existing votes and finalized menus. Do not rerun an installed migration. The frontend reports a setup error when connected to a backend missing the savings/keto migration.

The migrations create the recipe catalog, households, members, week plans, votes, private invitations, grocery rate limits, RLS policies, and authenticated RPC functions, the package price catalog, savings settings, and keto recipes. It uses Supabase's existing `auth.users` and `auth.uid()`; do not create substitutes for those in your real project. The test suite creates substitutes only inside its isolated test database.

Copy the **project URL** and **public publishable key** from project settings. A legacy `anon` JWT key also works. These two values are public browser configuration. Service-role keys, `sb_secret_` keys, and database passwords must never be used here.

## 2. Deploy the frontend

Choose one host.

### Vercel (recommended)

1. Push this repository to GitHub and import it into Vercel.
2. Choose **Other** for framework, build command `npm run build`, and output directory `dist` (also provided by `vercel.json`). Select Node 22 or newer.
3. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in Vercel's production environment. Set them in preview environments only if preview URLs are intended to access your household's backend.
4. Deploy. Record the stable HTTPS site URL. Rebuild after changing frontend variables.

For a Pages deployment, set repository Actions variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, set Settings → Pages → Source to **GitHub Actions**, and push `main` or run the provided workflow. It runs automated checks before deploying. The site path is normally `https://OWNER.github.io/REPOSITORY/`.

You can instead enter the two public fields in `config.json` and build; default empty fields deliberately enable local mode. Do not point Pages at the source branch root: deploy the bundled `dist/` output through the workflow. For manual static hosting, upload only `dist/`.

## 3. Configure Supabase sign-in email

In Supabase Auth URL Configuration, set the Site URL to your stable site URL and add that exact URL to allowed Redirect URLs. Include the trailing repository path for GitHub Pages. The app redirects email links back to `location.origin + location.pathname`. For local cloud testing add `http://localhost:4173/` or your chosen local development origin explicitly.

Keep email authentication and new-user signups enabled so invited household members can sign in. Configure a production SMTP provider in Supabase Auth settings. Supabase's built-in test mailer may restrict recipients and delivery rates; do not assume it can deliver to every household member. You can use your preferred mail provider, including Resend, with the credentials entered securely into Supabase. No email provider key belongs in this app.

Test with two real household email addresses. Check spam folders and provider delivery logs if links do not arrive. Clicking a link should return to the deployed page and show your email plus create/join actions.

## 4. Use the ChatGPT shopping handoff

This path requires no Instacart developer key or OpenAI API key. Existing deployments need only the updated frontend; there are no new database migrations or grocery-function changes for release 1.2.0.

Finalize your menu, open **Shopping list**, and click **Shop with ChatGPT**. Review the prepared instructions, click **Copy ChatGPT instructions**, then **Open ChatGPT**. Select/connect Instacart in ChatGPT if it is available in your account and paste the text. Download or manually copy the preview if clipboard access is unavailable.

The instructions include the finalized meals, household portions, combined ingredient quantities, pantry exclusions, keto/vegetarian preferences, budget, package suggestions, and clearly labelled price estimates. They request a review of actual products, prices, substitutions, delivery details, fees, taxes, tip, and final total, followed by explicit purchase approval. The website does not submit purchases. It cannot guarantee another service's behavior or access to Instacart tools/cart/checkout. If Instacart is unavailable in ChatGPT, use the ordinary copied list for manual shopping.

Preparation refreshes a shared household before export; it needs a connection and current membership. Finalize again if the owner reopened the menu. No handoff is prepared when all groceries are marked as owned. Prepare new instructions after changing the plan or pantry and replace any text already shared. ChatGPT account setup and live checkout behavior remain manual verification steps.

## 5. Optional: deploy the direct grocery Edge Function

Obtain an **Instacart Developer Platform** API key with shopping-list link access. Development credentials and production approval are separate. Verify current access and the product-link API contract in your Instacart developer account before switching to production. This environment could not access Instacart's documentation host and has no provider credentials, so live compatibility is not yet proven.

Using an authenticated Supabase CLI:

```sh
supabase functions deploy grocery-link --project-ref YOUR_PROJECT_REF
```

The supplied `supabase/config.toml` disables legacy gateway JWT checks for this function. The function itself verifies every bearer session with Supabase Auth and then calls membership-protected database functions. It never uses service-role access.

In Supabase Edge Function Secrets, set:

| Name                | Value / purpose                                                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSTACART_API_KEY` | Your private Developer Platform key. Enter securely in Supabase, never in a file or frontend environment.                                                                                                 |
| `INSTACART_ENV`     | `development` for initial tests; `production` after provider approval.                                                                                                                                    |
| `APP_ORIGINS`       | Comma-separated exact frontend origins, e.g. `https://your-project.vercel.app`. Origins have no path or trailing slash. For Pages, use `https://OWNER.github.io` even when the app has a repository path. |

Supabase supplies `SUPABASE_URL` and `SUPABASE_ANON_KEY` automatically to hosted Edge Functions. Do not replace these with a service-role key. If testing functions locally, supply the equivalent local public URL and anon key through the CLI's supported local configuration.

The development destination is `connect.dev.instacart.tools`; production is `connect.instacart.com`. The handler sends `POST /idp/v1/products/products_link` with a `shopping_list` payload and expects `products_link_url`. It sends canonical recipe ingredients, quantities, and estimated package recommendations (including your package-label notes), without automatically adding member email addresses, a delivery address, or payment details. Whole produce and packaged items are rounded up to whole quantities; grocery product matching remains a checkout review step. Package recommendations do not select a retailer SKU or guarantee the lowest checkout price.

Missing secrets, invalid sessions, unfinalized menus, stale revisions, provider failures, and exhausted limits have visible recovery messages. Each household is limited to one attempt per 30 seconds and 20 per UTC day. Failed provider attempts count toward that limit. Copy / download / print remain usable without any Instacart integration.

## 6. Finish the live acceptance checks

Use [Release checks](RELEASE_CHECKS.md). Do not call the release live until those checks pass on the deployed URL. API key entry, email delivery, Instacart account approval, production checkout, and publication cannot be validated by the local simulated-provider tests.

If you only want local use initially, deploy the default empty configuration and skip Supabase / Instacart. The local feature set remains usable, and the complete shared connections are ready to activate later.
