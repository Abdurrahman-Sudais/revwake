# Revwake — setup

Complete Vite/React source, lockfile, original logo/favicon assets and the standalone review preview. The website remains unpublished.

## Run locally

1. Install Node.js 22.12+ (or Node 24 LTS), unzip the project and open a terminal inside `revwake`.
2. Run `npm ci`.
3. Run `npm run dev` and open the local address shown.
4. For the production version, run `npm run build`, then `npm run preview`.
5. To rebuild production and the corrected standalone preview and run all checks, use `npm run verify`.

Do not open `dist/index.html` directly; use the preview command. `Revwake-review.html` is the self-contained review snapshot, with in-file route navigation.

## Deploy when approved

1. Push the source to your GitHub repository and import it into Vercel. Select `revwake` as Root Directory if it is a subfolder.
2. Set Install Command to `npm ci`, Build Command to `npm run build`, and Output Directory to `dist`. The included `vercel.json` supplies the build settings.
3. Deploy only after approval. Add `revwake.space` and follow the host's DNS instructions; verify HTTPS. No `www` subdomain is assumed.
4. Check Home, `/privacy`, `/terms`, `/brand`, and a nonexistent URL. The host must serve `404.html` with HTTP status 404. Do not add an all-path SPA rewrite.

Only `dist` is public deployment output. Do not deploy the source folder or `internal`. Review deployments need host access protection if they must be private; noindex is not access control.

## Essential configuration

- No credentials or environment variables are required. Never put secrets in public `VITE_` variables.
- The demo uses fictional data in page memory. It does not call AWS, AI or ERP services, and acknowledgements do not implement production changes. AWS architecture is proposed.
- Contact opens an email draft to `femi@revwake.space`; it does not send messages. Confirm the mailbox works before launch. A submission backend is optional future work.
- Before publication, confirm legal operator/contact details, email handling and hosting logs; review Privacy and Terms, which are draft policies.
- Real-browser desktop/mobile checks, actual downloads/email launch and host routing/HTTP status still require verification.

## Public indexing switch

Keep the current review restrictions until public launch is approved:

1. In `index.html`, change robots `noindex,nofollow` to `index,follow`. Keep the 404 page noindex through a route-specific override in `scripts/prerender.mjs`.
2. Change generated `robots.txt` in `scripts/prerender.mjs` to allow crawling and include `Sitemap: https://revwake.space/sitemap.xml`.
3. Remove `X-Robots-Tag: noindex, nofollow` from `public/_headers` and any equivalent host setting.
4. Rebuild/deploy and inspect the served metadata and headers. Update test assertions that intentionally enforce review noindex settings.

## Assets and optional internal QA

Logos, transparent PNGs, SVG/PNG favicons, touch icon and social image are in `public/brand/`; `/brand` provides their presentation and downloads. The included exports are ready to use. Optional regeneration: install Python 3/Cairo/CairoSVG and run `python3 scripts/brand.py`.

`internal/QA.md` is optional internal handover material. It has no public route or website link and is excluded from `dist`. No other handover document is required.
