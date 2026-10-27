# client-shivam — Contractor ERP (Secure Eye Security and Manpower Suppliers)

Next.js app. The UI is generated from `lib/schema.js`, which now holds the client's **frozen spec v1**
(`docs/client-spec-v1.json`, submitted 12 Oct 2026). Data lives in PostgreSQL via Drizzle ORM.

## Run
```bash
npm install
npm run db:migrate                                   # creates tables (local PGlite if DATABASE_URL is unset)
ADMIN_USERNAME=owner ADMIN_PASSWORD='long-password' npm run db:seed
npm run dev                                          # http://localhost:3000
```
### Login
There is one login (one username + password). Logged out, the site shows a full-screen home page with the login;
after logging in it opens the portal on Home. **Logout** (top bar or menu) returns to that page.
- Change the password: Compliance → **Reset Password** (needs the current password; other browsers are logged out).
- Forgotten password, or to change the username: on the server run
  `ADMIN_USERNAME=owner ADMIN_PASSWORD='new-long-password' npm run db:login` (everyone has to log in again).
- Sessions last 7 days and are stored hashed (`sessions` table). 5 wrong passwords from one address → 15-minute wait.
- In production the session cookie is `Secure` (HTTPS only). On a plain-HTTP server set `COOKIE_SECURE=false`.

### Security settings
- Behind nginx / a load balancer set `TRUST_PROXY=true`, so wrong-password limits count per real client address
  (otherwise `X-Forwarded-For` could be faked; without it all callers share one counter).
- Every response carries security headers (CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS in production) — `next.config.mjs`.
- Data-changing requests must come from the portal's own pages as JSON (CSRF check in `lib/http.js`).
- The field-selection prototype (`/api/config`, `/api/submit`, `/review`) is closed unless `NEXT_PUBLIC_APP_MODE=prototype`.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` are read only by `npm run db:seed` / `db:login` from the shell environment,
  not from `.env.local`.
- Audit results and the full test plan: `docs/TEST-PLAN.md`.
### Try it with dummy data, then wipe it
```bash
npm run db:migrate
npm run db:demo              # 2 demo firms, 7 work orders, 11 workmen, May–Sep wages, 4 bills; prints 20 PASS/FAIL checks
npm run db:reset -- --yes    # deletes everything and rebuilds empty tables (refuses without --yes)
```
The reset also deletes the login, so create it again straight after:
```bash
npm run db:reset -- --yes && node --env-file=.env.local scripts/db-login.mjs   # login from ADMIN_USERNAME / ADMIN_PASSWORD in .env.local
```
Stop `npm run dev` before resetting (the local database is a folder only one process can open). For a hosted database,
put its address in front: `DATABASE_URL='postgres://…' npm run db:reset -- --yes`; with `NODE_ENV=production` it also
needs `--force`. A production database is started fresh with `db:migrate` + `db:login` and never needs a reset.

All demo firms have a `DEMO-` CUIN. Re-running `db:demo` replaces earlier demo data (the login is kept); it refuses if any real firm exists.
After `db:demo`, `npm run dev` opens with the demo firms (switch firms in the top bar). The demo fills every screen:
ongoing / pending / rejected / completed work orders, active / inactive / moved-out workmen, approved / submitted /
draft wage months and bills. Every screen reads `GET /api/data?firm=ID` (`lib/data.js`) and every button posts an
operation to `POST /api/data` (`lib/ops.js`); what each screen does is in `components/screens.js`.

`NEXT_PUBLIC_APP_MODE=prototype` brings back the old field-selection tool (`/?k=…`, `/review?a=…`).

## Database (`db/schema.js`, migrations in `drizzle/`)
| Table | Holds | Key rules |
|---|---|---|
| `app_users` | the single login | unique username, bcrypt hash |
| `firms` | firms created from the top bar | unique name / CUIN |
| `work_orders` | work orders of a firm | WO number unique within the firm, completion ≥ commencement |
| `work_order_config` | the order's Config: EPF %, EPF ceiling, ESI %, ESI limit, OT rate, hours/day, deadline day | sane ranges |
| `work_order_rates` | Per Day Wage + VDA per skill category, per work order | one row per skill |
| `workmen` | workman profile of a firm | WUIN unique within the firm; Aadhaar format + uniqueness per `lib/rules.js` |
| `engagements` | workman ↔ work order over time | same firm (composite FKs), one open engagement per workman |
| `monthly_sheets` | one per work order per month | draft → submitted (locked) → approved |
| `wage_lines` | typed days/OT/extras + calculated wages + Config snapshot | 0–31 days, OT minutes 0/15/30/45, net = gross − deductions |
| `dispatch_register` | bills, receipts, GST/EPF/ESIC payment status of a firm | bill number unique within the firm |

Keys: every table has a generated `id` primary key and records point at each other by id only, so every typed value
(Aadhaar, WUIN, work order number…) stays editable. Business rules that can be relaxed — Aadhaar format / uniqueness,
format checks, minimum age, locking fields after saving — are in **`lib/rules.js`**; field formats (what may be typed,
length, pattern) are in `lib/validate.js` and assigned per field in `lib/schema.js` (`FIELD_FORMATS`).

Schema change: edit `db/schema.js` → `npm run db:generate` → commit the new file in `drizzle/` → `npm run db:migrate`.

## Wage engine
`lib/wages.js` (pure maths, paise arithmetic) and `lib/payroll.js`: `saveWageLine` takes the days typed on the
Wage Entry screen and calculates the line from the work order's Config; `recalculateSheet` re-runs a draft month
after Config changes; `submitSheet` locks a month. See `docs/CHANGES.md` for the change requests since spec v1.
Verified against the client's August 2026 CLIP wage sheet: 26 days × ₹556 → gross 14,456, EPF 1,735, ESI 108, net 12,613.

## Tests
| Command | What |
|---|---|
| `npm test` | everything below except e2e |
| `npm run test:unit` | wage maths, rate lookup, and **UI vs the client's spec** (fails if a field drifts) |
| `npm run test:db` | constraints + payroll on a real in-memory PostgreSQL (PGlite) — no server needed |
| `npm run test:ui` | React screens in jsdom against a real in-memory database with the demo data — including a test that clicks **every button on every screen** and fails if any click does nothing |
| `npm run test:e2e` | Playwright in Chromium against a production build on its own empty database: create firm → work order → approve → workman → engage → wages → submit (first time: `npx playwright install chromium`) |
| `npm run test:coverage` | coverage report in `coverage/` |

Helpers: `tests/helpers/db.js` (fresh migrated DB per file), `tests/helpers/factories.js` (valid rows with overrides).
