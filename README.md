# client-shivam — Contractor ERP (Secure Eye Security and Manpower Suppliers)

A contractor portal for firms, work orders, workmen, engagements, monthly wages and the dispatch register (bills).
Next.js 15 (App Router) + React 19, Drizzle ORM on PostgreSQL. Production runs on **Vercel + Neon**; local development
uses an embedded PostgreSQL (PGlite) in `.data/`, so no database server is needed.

| Doc | What's in it |
|---|---|
| `README.md` | how to run it, how it works, how to change and upgrade it |
| `docs/DEPLOY.md` | step-by-step production deployment (Vercel + Neon) |
| `docs/CHANGES.md` | every change request since the client's spec v1 (CR-1 … CR-10) |
| `docs/TEST-PLAN.md` | test plan, results, security audit, defects and their fixes |
| `docs/client-spec-v1.json` | the client's frozen spec v1 (12 Oct 2026); the tests compare the screens to it |

---

## 1. Run it locally
```bash
npm install
npm run db:migrate                                                    # creates the tables in .data/pglite
ADMIN_USERNAME=owner ADMIN_PASSWORD='a-long-password' npm run db:seed # the login + a first firm
npm run dev                                                           # http://localhost:3000
```
Or use the login from `.env.local` (scripts don't read that file by themselves):
`node --env-file=.env.local scripts/db-login.mjs`.

### Dummy data, and wiping it
```bash
npm run db:demo              # 2 demo firms, 7 work orders, 11 workmen, May–Sep wages, 4 bills; prints 20 PASS/FAIL checks
npm run db:reset -- --yes && node --env-file=.env.local scripts/db-login.mjs   # empty database + the login again
```
- Stop `npm run dev` before `db:reset` / `db:migrate`. The local database is a folder that only one process can open.
- `db:demo` fills every screen; demo firms have a `DEMO-` CUIN. Re-running it replaces the demo data. It refuses if a real firm exists.
- `db:reset` deletes **everything, including the login**. It refuses without `--yes`, and with `NODE_ENV=production`
  it also needs `--force`. Never run it (or `db:demo`) against the production database.

### npm scripts
| Script | Does |
|---|---|
| `dev` / `build` / `start` | Next.js dev server / production build / production server |
| `db:migrate` | applies `drizzle/*.sql` to `DATABASE_URL_UNPOOLED` → `DATABASE_URL` → local PGlite (Vercel runs it on every deploy, see `vercel.json`) |
| `db:generate` | writes a new migration from changes in `db/schema.js` |
| `db:seed` | creates the login (from `ADMIN_USERNAME` / `ADMIN_PASSWORD`) and a first firm |
| `db:login` | creates or replaces the single login (logs everyone out) |
| `db:demo` / `db:reset` | dummy data / wipe everything (see above) |
| `test`, `test:unit`, `test:db`, `test:ui`, `test:e2e`, `test:coverage` | see §7 |

---

## 2. Environment variables
Where the values live: `.env.local` (your machine, git-ignored), `.vercel/` (Vercel CLI link, git-ignored), the
**Vercel dashboard** (Project → Settings → Environment Variables; the only place production reads), and `.env.example`
(the template in git, placeholders only).

| Variable | Needed | Read by | Notes |
|---|---|---|---|
| `DATABASE_URL` | production | `db/index.js`, scripts | `postgres://…`. Neon: the **pooled** address. Unset locally → `.data/pglite` |
| `DATABASE_URL_UNPOOLED` | production (Neon) | `scripts/db-migrate.mjs` | Neon's **direct** address. Migrations use it when set |
| `TRUST_PROXY` | `true` on Vercel / behind nginx | `lib/http.js` | believe `X-Forwarded-For` / `-Host`. Without it all visitors share one wrong-password counter |
| `COOKIE_SECURE` | only `false` on plain HTTP | `app/api/session/route.js` | login cookie is `Secure` in production by default |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | when running `db:seed` / `db:login` | those scripts | not read by the running app |
| `ALLOW_PGLITE` | tests only | `db/index.js` | lets a production server use PGlite (the e2e tests). Never set on Vercel |
| `NEXT_PUBLIC_APP_MODE` | no | `App.js`, `lib/http.js` | `prototype` brings back the old field-selection tool |
| `CLIENT_TOKEN`, `ADMIN_TOKEN`, `BLOB_READ_WRITE_TOKEN` | no | `lib/auth.js`, `lib/store.js` | prototype mode only; remove from production |
| `NEXT_DIST_DIR` | no | `next.config.mjs` | build folder. The e2e tests use `.next-e2e` so they don't break a running dev server |
| `PW_CHROMIUM_PATH` | no | `playwright.config.mjs` | a Chromium binary for the e2e tests |

A production server with no `postgres://` `DATABASE_URL` stops with
*"DATABASE_URL is not set to a postgres:// address"* instead of falling back to PGlite.

---

## 3. How it works

### Folder map
```
app/
  page.js, layout.js, globals.css     the single page and all styles
  api/session/route.js                GET who's logged in · POST log in · DELETE log out
  api/data/route.js                   GET a firm's data · POST run one operation (the only write path)
  api/config, api/submit, review/     old prototype; 404 unless NEXT_PUBLIC_APP_MODE=prototype
components/
  App.js         session gate (Landing ↔ portal), hash navigation (#s=screen&wo=1), top bar, firm switcher
  Landing.js     full-screen home + login form (logged out)
  Sidebar.js     the menu (from lib/schema.js MENU)
  PageView.js    renders any screen from its spec: forms, tables, wage grid, dialogs, field checks, Combo drop-down
  screens.js     per-screen behaviour (CONTROLLERS): what rows a table shows, what each button does
  Data.js        DataProvider: loads data, runs operations, toasts / errors / confirm dialogs, file download, date & money format
  ErrorBoundary.js   a screen that crashes shows a recovery panel instead of a blank page
  Forms.js       the print view of Form D and FORM VIII-C (Print / Save as PDF prints only the document)
lib/
  schema.js      THE SPEC: menu, screens, blocks, fields/columns, required marks, options, FIELD_FORMATS
  ops.js         every server operation (create/update/delete …), firm-scoped, with the integrity checks
  data.js        firmSnapshot(): everything one firm's screens show, with the links resolved
  rules.js       business rules that can be switched on/off (RULES)
  validate.js    field formats (FORMATS): what may be typed, length, pattern, message
  districts.js   districts per State (suggestions for Work Location (District))
  bill.js        Dispatch Register amounts: tax, GST and total from the rates (same formula on screen and server)
  forms.js       statutory documents: Form D wage statement and FORM VIII-C wage slip (headings + values, Excel layout)
  xlsx.js        minimal .xlsx writer (text cells keep bank / UAN digits; no dependency)
  wages.js, payroll.js   wage maths (paise arithmetic) and saving / recalculating a month
  session.js     the single login, sessions, wrong-password limit
  http.js        CSRF / content-type / body-size checks, client address, prototype gate
  demo.js        the dummy data for db:demo
db/schema.js     tables (Drizzle) · db/index.js connection · drizzle/ SQL migrations
scripts/         db-migrate / seed / login / demo / reset
tests/, e2e/     see §7
```

### A request, end to end
1. **Logged out:** `App.js` asks `GET /api/session`; not logged in → `Landing.js`. Logging in sends `POST /api/session`, which
   sets the `cp_session` cookie (httpOnly, SameSite=Lax, Secure in production, 7 days; only its SHA-256 is stored in `sessions`).
2. **Load:** the portal calls `GET /api/data?firm=ID`, which runs `firmSnapshot()` (`lib/data.js`). That returns the firm's
   work orders (with Config and engaged counts), workmen (active / inactive / moved), engagements, wage months with
   lines, bills and recent activity. Every screen renders from this one snapshot.
3. **Screens:** `PageView` draws the screen described in `lib/schema.js`. `components/screens.js` supplies its rows,
   options, guidance ("create a work order first"), labels and button handlers.
4. **Buttons:** a handler calls `ctx.live.run("opName", args)` → `POST /api/data {op, firmId, …}`. The route checks the session (401),
   the same-origin JSON request (403 / 415 / 413) and that `op` is a real operation. It then runs `OPS[op](db, args)` in one
   **transaction** and reloads the snapshot.
5. **Errors:** operations throw `UserError(message, { fields, fix })`. The UI shows the message as a toast, marks the
   named fields, and offers the `fix` button (e.g. "Approve the work order"). Database constraint errors are turned
   into plain messages by `explainDbError`. Network errors and 5xx say "nothing was saved". An expired session returns to the login.

### Data model (`db/schema.js`)
| Table | Holds | Key rules |
|---|---|---|
| `app_users` | the single login | bcrypt hash |
| `sessions` | logged-in browsers | token stored as SHA-256, expiry |
| `firms` | firms (top-bar switcher) | name / CUIN unique |
| `work_orders` | a firm's work orders | WO number unique within the firm; pending → approved / rejected → completed |
| `work_order_config` | EPF %, ESI %, ceilings, OT rate, hours/day | one per work order |
| `work_order_rates` | Per Day Wage + VDA per skill | one per skill per order |
| `workmen` | workman profile | WUIN unique within the firm; Aadhaar per `RULES` |
| `engagements` | workman ↔ work order over dates | same firm; one work order per workman per day |
| `monthly_sheets` | one per work order per month | draft → submitted (locked) → approved; Reopen for Editing |
| `wage_lines` | days / OT / extras + calculated wages + Config snapshot | net = gross − deductions |
| `dispatch_register` | bills: taxable, tax rate + amount, GST rate + amount, total, receipts, GST / EPF / ESIC status | bill number unique within the firm; amounts calculated from the rates (`lib/bill.js`) |

- **Keys:** every table has a generated `id`. Records point at each other by id only, so every typed value
  (Aadhaar, WUIN, WO number, firm name…) stays editable.
- **Firm isolation:** every operation checks the record belongs to the firm in the request.
- **Integrity (in `lib/ops.js`, not the database):**
  - A workman is on one work order on any day.
  - Engagements fall inside the order's dates and on or after the date of joining.
  - Wage days can't exceed the month, the days engaged on that order, or the month across all orders.
  - Edits that would strand engagements or paid wages are refused.
  - Deletes are refused while linked records exist, and the message names them.

### Rules and formats (change these instead of code)
- **`lib/rules.js` → `RULES`:**
  - `lockedAfterCreate`: fields that become read-only after saving.
  - `aadhaarRequired`, `aadhaarUniquePerFirm`.
  - `checkFormats`, `minimumAge`.
  - `engagementWithinOrderDates`, `engagementAfterJoining`.
  - `wageDaysWithinEngagement`, `allowReopenWages`.
- **`lib/validate.js` → `FORMATS`:** a format sets the characters allowed while typing, the maximum length, the pattern
  checked when the field is left, and the message shown. Examples: `aadhaar` (12 digits), `mobile`, `pincode`, `pan`, `gstin`,
  `ifsc`, `bankAc`, `personName` (any script, no digits), `place`, `money`, `percent`, `date`.
- **`lib/schema.js` → `FIELD_FORMATS`:** which format each field uses. The browser filters and checks; the server checks
  again (`readForm` in `lib/ops.js`) and never silently cuts a value.

### Wage engine
`lib/wages.js` is pure maths in paise. `lib/payroll.js`:
- `saveWageLine` calculates a line from the days typed on Wage Entry and the order's Config.
- `recalculateSheet` re-runs a draft month after a Config change.

Verified against the client's August 2026 CLIP sheet: 26 days × ₹556 → gross 14,456, EPF 1,735, ESI 108, net 12,613.

### Login and security
- **One login:**
  - Change the password in the app: Compliance → **Reset Password**. It needs the current password and logs out other browsers.
  - Forgotten password or a new username: run `npm run db:login` with `ADMIN_USERNAME` / `ADMIN_PASSWORD`, against the
    database's address (see `docs/DEPLOY.md`).
- **Wrong passwords:** 5 from one address → a 15-minute wait. The counter is in memory per server instance.
- **Headers:** CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production
  (`next.config.mjs`). No `X-Powered-By`.
- **Requests:** CSRF check (same Origin + JSON body) and a 512 KB body limit (`lib/http.js`). Only names in `OPS` can be
  called (`Object.hasOwn`).
- **Downloads:** every download is a real `.xlsx` (`lib/xlsx.js`); cells are written as text or numbers, never formulas,
  so a typed `=…` can't run in Excel. There are no CSV downloads.
- **Audit:** the security audit and its results are in `docs/TEST-PLAN.md` §9.

---

## 4. Making changes (recipes)

**Add a field to a form**
1. `lib/schema.js`: add `c("id", "Label", { req?, input?, options? })` to the screen's block. Add its format to `FIELD_FORMATS`.
2. `db/schema.js`: add the column → `npm run db:generate` → check the new `drizzle/NNNN_*.sql` → `npm run db:migrate`.
3. `lib/ops.js`: add `[block, item, column]` to the screen's field map (`WO_NEW_FIELDS`, `WORKMAN_FIELDS`, …), so it is saved and loaded.
4. If a list or table shows it: add it in `lib/data.js` (`firmSnapshot`).
5. `tests/unit/spec.test.js`: screens may differ from spec v1 only where listed (`EXTENDED`, `REMOVED`, renames). Record the change there,
   and log it in `docs/CHANGES.md`.

**Add a screen:** add it to `SCREENS` and `MENU` in `lib/schema.js`, then add its behaviour to `CONTROLLERS` in `components/screens.js`.
Use `rows`, `action`, `row`, `guide`, `options`, `filter` and `load`, following the existing screens. If it needs a new server
operation, add a function to `lib/ops.js` and to the `OPS` map at the bottom. The every-button test (`tests/ui/live.test.jsx`)
fails if any button on the new screen does nothing visible.

**Relax or tighten a rule:** edit `RULES` in `lib/rules.js`. Tests in `tests/db/integrity.test.js` show how each rule behaves.

**Change a statutory document** (Form D / wage slip): headings and values are in `lib/forms.js`. Each heading is
copied from the client's sample, and `tests/unit/forms.test.js` checks it word for word, so change both together.

**Change a format** (e.g. allow a 16-digit bank account): edit `FORMATS` in `lib/validate.js`. Browser and server both follow it.

**Add or rename a district:** edit `lib/districts.js` (the State names must match `STATES` in `lib/schema.js`). Any name can
still be typed, so a missing district never blocks anyone.

**Database changes in general:** never edit an applied migration. Change `db/schema.js` → `npm run db:generate` → commit the new SQL file
→ run `npm run db:migrate` locally. The Vercel deploy applies it to Neon automatically.

---

## 5. Upgrading dependencies
- `next` and `@vercel/blob` are pinned to exact versions on purpose. Next 15.5.28 fixes a critical remote-code-execution flaw.
  `overrides.next.postcss` forces a patched postcss.
- Routine upgrade:
  ```bash
  npm outdated
  npm install next@<version> react@<v> react-dom@<v>    # one group at a time
  npm audit --omit=dev                                  # production dependencies must stay at 0
  npm test && npm run test:e2e                          # 383 + 31 must pass
  ```
- `npm audit` (all dependencies) reports moderate esbuild advisories inside `drizzle-kit`. That's a development tool only, never deployed.
- After upgrading Drizzle, run `npm run db:generate`. It should report **no changes**; if it writes a file, read it before committing.
- Node: Vercel's default (Node 24) works; there are no other runtime requirements.

---

## 6. Deploying
Full steps in **`docs/DEPLOY.md`**. In short:
1. Connect **Neon** to the Vercel project (Storage → Neon) for Production. This adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
   Use Neon preview branches, or no database for Preview deployments.
2. **Migrations run on every deploy** (`vercel.json` build command: `node scripts/db-migrate.mjs --deploy && next build`).
   - A failed migration fails the deploy.
   - A Production build with no database address fails.
   - A Preview build with no database address skips the migrations.
   After the first deploy, create the login once, with the Neon addresses in `.env.neon`:
   `ADMIN_USERNAME=… ADMIN_PASSWORD='…' node --env-file=.env.neon scripts/db-login.mjs`.
3. Vercel settings:
   - Add `TRUST_PROXY=true`.
   - Remove the prototype variables (`CLIENT_TOKEN`, `ADMIN_TOKEN`, `BLOB_READ_WRITE_TOKEN`).
   - Set the Functions region to Neon's region.
   - Add the domain.
4. `npm test && npm run test:e2e`, then `git push origin main`. Vercel migrates Neon, builds and deploys.
5. Later releases with a new `drizzle/` file need nothing extra: the deploy applies it. Keep migrations backward-compatible
   (add columns/tables; drop or rename only in a later release), because the old version serves traffic while the new
   build runs.
   Backups: Neon point-in-time restore, plus a monthly `pg_dump "$DATABASE_URL_UNPOOLED" > backup.sql`.

---

## 7. Tests
| Command | What |
|---|---|
| `npm test` | all of the below except e2e (383 tests) |
| `npm run test:unit` | wage maths, formats, districts, and **the screens vs the client's spec** |
| `npm run test:db` | operations, integrity rules, sessions, schema, the full ERP CRUD plan, on in-memory PostgreSQL |
| `npm run test:ui` | React screens in jsdom on the demo data. Includes **every button on every screen must do something**, screens vs raw SQL, error handling |
| `npm run test:e2e` | Playwright + Chromium against a production build on its own empty database (`.data/e2e`, `.next-e2e`): the full workflow, the HTTP API, security checks, firm switch, Excel files (31 tests). First time: `npx playwright install chromium` |
| `npm run test:coverage` | coverage report in `coverage/` |

Helpers: `tests/helpers/db.js` (fresh migrated database per file), `tests/helpers/factories.js`. The test plan and results are in `docs/TEST-PLAN.md`.

---

## 8. Troubleshooting
| Symptom | Cause → fix |
|---|---|
| `Cannot find module './NNN.js'` in dev | a production build overwrote `.next` under the running dev server → stop dev, `rm -rf .next`, `npm run dev` |
| db script hangs or "database is locked" locally | `npm run dev` holds the PGlite folder → stop it first |
| "DATABASE_URL is not set to a postgres:// address" | a production server has no database address → set `DATABASE_URL` (Vercel env vars) and redeploy |
| Site says "The database has not been set up yet"; logs show `relation "app_users" does not exist` | the deploy ran without migrating (older build, or a Preview with no database) → redeploy; the build log should show `migrations applied (…)`. Or run `node --env-file=.env.neon scripts/db-migrate.mjs` |
| Deploy fails at `db-migrate` | Production has no `DATABASE_URL`, or a migration failed (the log shows which). The live site keeps the previous version |
| Site loads but the login is refused / "No login has been set up yet" | create it: `ADMIN_USERNAME=… ADMIN_PASSWORD='…' node --env-file=.env.neon scripts/db-login.mjs` |
| Nobody can log in for 15 minutes | wrong-password limit; on Vercel make sure `TRUST_PROXY=true` (otherwise everyone shares one counter) |
| Every action says "did not come from the portal's own pages" | a proxy rewrites the host → set `TRUST_PROXY=true` |
| Login cookie not kept on a plain-HTTP server | set `COOKIE_SECURE=false` (or, better, use HTTPS) |
| Forgotten password | `ADMIN_USERNAME=… ADMIN_PASSWORD='…' npm run db:login` with that database's `DATABASE_URL` |
| An Excel button downloads a CSV | that's the live site running an older version; every download is .xlsx since CR-10 → deploy the latest code |
| A save is refused with a red message | intended: the message says why and what to do (rules in `lib/rules.js`) |

`NEXT_PUBLIC_APP_MODE=prototype` brings back the old field-selection tool (`/?k=…`, `/review?a=…`) used before spec v1.
