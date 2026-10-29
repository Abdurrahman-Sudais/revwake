# Revwake — setup

Complete Vite/React source, lockfile, original logo/favicon assets and the standalone review preview. The website remains unpublished.

## Run locally

1. Install Node.js 22.12+ (or Node 24 LTS), unzip the project and open a terminal inside `revwake`.
2. Run `npm ci`.
3. Run `npm run dev` and open the local address shown.
4. For the production version, run `npm run build`, then `npm run preview`.
5. To rebuild production and the corrected standalone preview and run all checks (JavaScript and the Python Lambda tests), use `npm run verify`. Python 3.10+ is needed for `npm run test:backend`; it uses only the standard library.

`vite preview` does not resolve clean URLs, so open `/app/` with a trailing slash there; Vercel and Cloudflare serve `/app`.

Do not open `dist/index.html` directly; use the preview command. `Revwake-review.html` is the self-contained review snapshot, with in-file route navigation.

## Deploy when approved

1. Push the source to your GitHub repository and import it into Vercel. Select `revwake` as Root Directory if it is a subfolder.
2. Set Install Command to `npm ci`, Build Command to `npm run build`, and Output Directory to `dist`. The included `vercel.json` supplies the build settings.
3. Deploy only after approval. Add `revwake.space` and follow the host's DNS instructions; verify HTTPS. No `www` subdomain is assumed.
4. Check Home, `/app`, `/privacy`, `/terms`, `/brand`, and a nonexistent URL. The host must serve `404.html` with HTTP status 404. Do not add an all-path SPA rewrite.

Only `dist` is public deployment output. Do not deploy the source folder or `internal`. Review deployments need host access protection if they must be private; noindex is not access control.

## Essential configuration

- No credentials or environment variables are required. Never put secrets in public `VITE_` variables.
- The home-page demo uses fictional data in page memory. The prototype at `/app` saves its fictional state in `localStorage` (key `revwake-prototype-v1`) and has a reset button. It does not call AWS, AI or ERP services, and acknowledgements do not implement production changes. AWS architecture is proposed.
- By default, Contact opens an email draft to `femi@revwake.space`; it does not send messages. Setting the HubSpot variables in `.env.example` makes it submit to HubSpot instead (see `docs/crm-plan.md`). Confirm the mailbox works before launch. A submission backend is optional future work.
- Before publication, confirm legal operator/contact details, email handling and hosting logs; review Privacy and Terms, which are draft policies.
- Real-browser desktop/mobile checks, actual downloads/email launch and host routing/HTTP status still require verification.

## Public indexing switch

Keep the current review restrictions until public launch is approved:

1. In `index.html`, change robots `noindex,nofollow` to `index,follow`. Keep the 404 page noindex through a route-specific override in `scripts/prerender.mjs`.
2. Change generated `robots.txt` in `scripts/prerender.mjs` to allow crawling and include `Sitemap: https://revwake.space/sitemap.xml`.
3. Remove `X-Robots-Tag: noindex, nofollow` from `public/_headers` and any equivalent host setting.
4. Rebuild/deploy and inspect the served metadata and headers. Update test assertions that intentionally enforce review noindex settings.

## Interactive prototype (`/app`)

A full specification-change workspace with fictional data. Use **Demo as** to switch person and role, and **Reset demo data** to restore the seed.

- **Change engineer** (Alex Morgan): dashboard with exposure (open units and purchase value); changes; **New change** (creates a new revision from typed attribute values); and per change, *Revision* (attribute diff), *Impact* (confirmed-link paths, superseded-value mentions, re-run), *Mapping* (confirm or reject unconfirmed dependencies, with labelled AI suggestions), *Review tasks* (assign, approve deviations), *Close* (checklist gate) and *Activity*. Exports a JSON impact report.
- **Department reviewers** (Kai Brennan for Production, Jo Taylor for Purchasing, Sam Ellis for Quality): see only their department's tasks; record dispositions with reasons, implementation evidence and notes.
- **Administrator** (Mei Tan): aggregates, roles and departments, policy (implementation evidence required, AI on/off), audit log with CSV export, permissions matrix.

Try this path: as Alex, open ECN-41 → Mapping → confirm WO-235, reject RT-12 with a reason. Assign the tasks, switch to each reviewer and record dispositions (QC-07 as a deviation). Back as Alex, approve the deviation, then close once evidence is in.

**Real:** the analysis engine (`src/app/engine.js`), permissions on every action, all gates, the audit log, exports and persistence. **Simulated:** PDF and ERP import (values are typed or seeded), AI (a word-overlap rule with the Bedrock output shape) and sign-in.

## Website additions, backend and docs

- Home page: prototype call to action, benefits, use cases, safeguards, plans (`#pricing`: “Pricing on request”, with no invented prices) and FAQ. Section labels are renumbered 01–13. The early-access form adds role and revision volume, consent, an optional updates box and a honeypot.
- `backend/lambdas/analyse_impact` and `suggest_mappings`, with `backend/tests/fixtures/cases.json` shared with `tests/engine.test.mjs`.
- `db/schema.sql`: PostgreSQL schema with row-level security and database-enforced gates. `db/test_rls.sql` verifies it on a scratch database: `createdb revwake_test && psql -v ON_ERROR_STOP=1 -d revwake_test -f db/schema.sql -f db/test_rls.sql`.
- `docs/architecture.md`, `docs/safeguards.md`, `docs/crm-plan.md`.

## Assets and optional internal QA

Logos, transparent PNGs, SVG/PNG favicons, touch icon and social image are in `public/brand/`; `/brand` provides their presentation and downloads. The included exports are ready to use. Optional regeneration: install Python 3/Cairo/CairoSVG and run `python3 scripts/brand.py`.

`internal/QA.md` is optional internal handover material. It has no public route or website link and is excluded from `dist`. No other handover document is required.
