# Release verification

## Automated checks

Run `npm test`, `npm run build`, and `npm run test:browser` (install Playwright Chromium first, or select an existing browser through `PLAYWRIGHT_CHROMIUM_EXECUTABLE`). The GitHub workflow runs the same checks before Pages deployment.

The Node suite covers ranking, package-size mixtures, shared-ingredient costs, pantry savings, budget feasibility/fallback, keto eligibility, custom prices, browser/server menu parity, aggregation, week/timezone boundaries, malformed saved data, finalized state transitions, preferences, public-key validation, database migrations and RLS, owner/member/outsider permissions, stale revisions, invitations, membership removal, grocery limits, and the Edge Function contract/error paths.

Browser tests exercise local voting, keto/vegetarian combinations, editable package prices, budget shortfalls, price persistence, package recommendations in downloads, preference shortfalls, keyboard tab navigation, finalized persistence, pantry exclusions in the clipboard, downloads, import recovery, mobile overflow, and axe accessibility analysis. A two-device flow uses the actual SQL migration in embedded Postgres, with simulated Supabase Auth sessions and REST transport, to test creation, joining, shared votes, finalization, pantry sync, grocery link display, and membership revocation.

These are real browser and Postgres checks. They do not prove real email delivery, Supabase project configuration, a deployed Edge Function, or current Instacart provider access. Provider responses are simulated. Automated accessibility checks do not replace human screen-reader and usability testing.

## Live owner checklist after account activation

- Open the deployed HTTPS site on a phone and a computer. Confirm there are no missing scripts or configuration errors, including at the repository path if using Pages.
- Send sign-in links to two different real household email accounts; open each link on its corresponding device.
- Create a household with the correct timezone. Join from the other device with an invitation code. Confirm both devices see the same week.
- Vote from both devices and use Refresh household. Check the total and menu ordering. Try simultaneous changes and confirm a conflicting edit asks for a retry instead of losing a vote.
- Check that a member cannot change servings, preferences, package prices, budget, planning priority, finalize, reset, or invite. Confirm the owner can.
- Enable keto, choose Lowest grocery estimate, and enter two real package prices for an ingredient. Refresh the other device and confirm both show the same settings, menu, and estimated subtotal. Set an infeasible budget and check that the shortfall is explicit.
- Finalize, reload, and check that voting is paused and the menu remains stable. Mark a pantry ingredient and confirm its exclusion from the copied list and grocery handoff.
- Create a development Instacart shopping link. Confirm products and quantities are represented sensibly for canned and whole-item ingredients. Check package recommendation notes and verify actual product sizes and prices at checkout. No particular SKU or lowest retailer total is guaranteed. Check that no address, payment, or purchase is submitted automatically.
- Confirm a second rapid link attempt is rate-limited. Confirm the copy/download route works with the provider unavailable.
- After provider approval, switch to production credentials / `INSTACART_ENV=production` and validate a live shopping link. Review final prices, substitutions, delivery location and slot, and payment within Instacart before any order.
- Rotate an invite and check that the previous one no longer joins a new account. Remove a test member and confirm household access disappears on refresh.
- Export a private backup. Test restore in local mode with nonessential data before relying on it. Review your Supabase backup settings.
- Try keyboard-only use and your phone's screen reader: sign-in fields, tabs, vote buttons, pantry checkboxes, confirmation dialog, and errors. Zoom text to 200% and confirm controls remain usable.

## Publication status

The repository and build are prepared locally. Supabase/Instacart account creation, credential configuration, deployed email auth, production grocery links, live hosting, and cloud environment publication must be recorded separately when they actually happen. Passing local tests is not a claim that those steps have been performed.
