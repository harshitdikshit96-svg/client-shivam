# Notes for Claude: context for picking this project up again

Read `README.md` (how to run, how it works) and the end of `docs/CHANGES.md` (latest change requests, CR-1 … CR-20)
first. This file holds what those don't: how the owner likes to work, the gotchas, and what's still open.
Last updated 20 Nov 2026.

## What this is
- **One Next.js 15 app, two halves.**
  - **Public marketing website** at `/`: the route group `app/(site)/`, Shivanji Group of Companies.
  - **ERP portal** at `/admin`: contract-labour firms, work orders, workmen, wages, dispatch register. It has its own
    login, and the navbar "Login" links to it.
- **Hosting:** Vercel, with Neon Postgres in production. Locally it uses PGlite in `.data/`, so `npm run dev` needs no
  database server.
- **Pushing to `main` deploys to production.** The Vercel build runs `node scripts/db-migrate.mjs --deploy && next build`,
  which migrates Neon too.

## How the owner works (follow these)
- **Keep it simple.** Don't over-engineer or add things that weren't asked for. When asked a question, answer it.
- **Don't commit or push unless explicitly asked.** The owner commits the work themselves, usually as "final commit".
- **Website content is the client's text, word for word** (`lib/site.js`).
  - Don't reword it.
  - New text you write gets marked "for the client to confirm" (e.g. Shivanji HR Solutions).
- **The website forms email every submission.** They used to be "shown, not sent"; that changed in CR-20.
- **Verify UI changes across screen sizes before reporting.** The owner caught a hidden mobile menu once. Use Playwright
  screenshots at 320 / 390 / 768 / 1024 / 1101 / 1440 / 1920 and look at them.
  - The Chrome extension was refused on localhost.
  - Import Playwright as `/Users/aaa/Desktop/client-shivam/node_modules/@playwright/test/index.mjs` from scratch scripts.
- **Dates:** everything shown or typed is dd/mm/yyyy (`components/DateInput.js`, `lib/forms.js`). The database keeps
  real `date` columns; that was the owner's choice.
- **Reports:** short, with plain words and real results. Say what wasn't verified.

## Where things live
- **Website**
  - **Content:** `lib/site.js`. It holds `EMAIL`, the nav lists (`NAV` is shared by the desktop navbar and the phone
    menu), `COMPANIES` (8; the group card is number 9), and `HERO_SLIDES`.
  - **Pages:** `app/(site)/*`.
  - **Shared pieces:** `components/site/*` (SiteHeader, SiteFooter, parts, HeroCarousel, SiteForm).
  - **Styles:** `app/home.css`, everything scoped under `.hp`. Reset rules use `:where()` so they have no specificity.
    A plain `.hp a{}` beat button colours once.
- **Website forms**
  - `lib/site-forms.js` holds the fields and checks, shared by browser and server.
  - `app/api/site-form/route.js` re-checks, drops bots (hidden `website` field, 5 per 10 min per IP) and sends.
  - `lib/mailer.js` sends through the Resend REST API, with no SDK.
- **Partners (CR-16):** portal screen → `partners` table → tiles on `/partners`. Logos are stored as data URLs and
  served by `/api/partner-logo/[id]`, because the CSP `img-src` is `'self' data: blob:`. Fonts are self-hosted.
- **Portal**
  - The portal is driven by `lib/schema.js` (MENU, SCREENS), with controllers in `components/screens.js`, rendered by
    `components/PageView.js`.
  - Data goes through `/api/data` (`lib/ops.js`, `lib/data.js`).
  - `tests/unit/spec.test.js` pins the portal to the client spec, so record any addition there.
- **Backups:** daily cron to private Vercel Blob, kept 21 days (`lib/backup*.js`, `docs/DEPLOY.md` §6). They hold
  Aadhaar and bank data, so they stay private only.

## Email (website forms)
- **Provider:** a Resend free account (owner's own, not the Vercel Marketplace one, which only has paid plans). The
  domain `shivanjigroup.in` is verified for **sending only**; receiving is off. Mail goes to
  `EMAIL` = contact@shivanjigroup.in, with reply-to set to the visitor.
- **Vercel Production env:**
  - `RESEND_API_KEY` is a secret and can't be pulled locally.
  - `MAIL_FROM` = `Shivanji Group Website <website@shivanjigroup.in>`.
  - `MAIL_TO` is optional and overrides `EMAIL`.
- **Without a key:** dev logs "would email …" and returns OK; production returns 503. E2E runs `next start`, which is
  production mode, so form tests intercept `/api/site-form` with `page.route`.
- **Real-send test:** only possible from the deployed site.

## Testing and sanity
- **Unit, db and UI tests:** `npx vitest run` (426 tests). A run under load can flake once; re-run before chasing it.
- **Browser tests:** `npx playwright test` (49 tests). It builds into `.next-e2e` on port 3210 with its own PGlite DB.
  The website ones are in `e2e/website.spec.js`: menu, sideways scroll, carousel, all 4 forms, the HR firm.
- **Sanity sweeps on a production build:**
  - Build and start:
    `NEXT_DIST_DIR=.next-sanity npm run build && NEXT_DIST_DIR=.next-sanity ALLOW_PGLITE=true DATABASE_URL=pglite:./.data/e2e npx next start -p 3300`.
  - A long-running `next dev` can serve stale chunks (404 / "MIME type text/plain" console errors); that's not a real bug.
  - Expected off-screen items: the hero photos (they zoom to 106%) and the hidden `.hp-hp` anti-spam field.
- **Local DB:** stop `npm run dev` before `db:migrate` / `db:reset`, because only one process can open PGlite.

## Gotchas already hit
- **`backdrop-filter` on `.hp-hdr`** makes the header the containing block for `position:fixed` children. The phone
  menu therefore hangs off the header (`position:absolute; top:100%` with an explicit height). Don't make it `fixed`
  again.
- **Grid with a lone last card:** the group card goes full-width when it's alone on the last row (`nth-child` rules in
  `home.css`). Re-check this when companies are added or removed.
- **Production DB reads were denied earlier;** don't work around that.
- **Never print values** from `.env.local`, `.env.neon` or `.vercel/prod-tokens.env`.
- **Client sample PDFs** contain real workers' bank details; never commit them.
- **Backups and migrations:** a backup only restores into a database at the same migration count. Take a fresh backup
  after any migration is deployed.

## Open items (as of 20 Nov 2026)
- The client should confirm the Shivanji HR Solutions text (`lib/site.js`). It's on the website only, not the ERP.
- After the next deploy, check that the live form emails arrive at contact@shivanjigroup.in. Resend's "Emails" log
  shows each send.
- The carousel has no Consumer & Lifestyle slide (6 slides: group + 5 verticals). Add one if asked.
- On company pages, the "Our Companies" link list (7 others in 3 columns) leaves a single last item; it's fine, but
  it's an option to tidy.
