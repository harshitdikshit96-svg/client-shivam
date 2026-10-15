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
### Try it with dummy data, then wipe it
```bash
npm run db:migrate
npm run db:demo              # 2 demo firms, 4 orders, 8 workers, Aug + Sep wages, 3 bills; prints 18 PASS/FAIL checks
npm run db:reset -- --yes    # deletes everything and rebuilds empty tables (refuses without --yes)
```
All demo names start with "Demo". `db:demo` only runs on an empty database.

`NEXT_PUBLIC_APP_MODE=prototype` brings back the old field-selection tool (`/?k=…`, `/review?a=…`).

## Database (`db/schema.js`, migrations in `drizzle/`)
| Table | Holds | Key rules |
|---|---|---|
| `app_users` | the single login | unique username, bcrypt hash |
| `firms` | firms created from the top bar | unique name / CUIN, 6-digit pincode |
| `work_orders` | work orders of a firm | WO number unique within the firm, completion ≥ commencement |
| `work_order_config` | the order's Config: EPF %, EPF ceiling, ESI %, ESI limit, OT rate, hours/day, deadline day | sane ranges |
| `work_order_rates` | Per Day Wage + VDA per skill category, per work order | one row per skill |
| `workmen` | workman profile of a firm | WUIN and 12-digit Aadhaar unique within the firm |
| `engagements` | workman ↔ work order over time | same firm (composite FKs), one open engagement per workman |
| `monthly_sheets` | one per work order per month | draft → submitted (locked) → approved |
| `wage_lines` | typed days/OT/extras + calculated wages + Config snapshot | 0–31 days, OT minutes 0/15/30/45, net = gross − deductions |
| `dispatch_register` | bills, receipts, GST/EPF/ESIC payment status of a firm | bill number unique within the firm |

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
| `npm run test:ui` | React screens in jsdom (Testing Library) |
| `npm run test:e2e` | Playwright in Chromium against a production build (first time: `npx playwright install chromium`) |
| `npm run test:coverage` | coverage report in `coverage/` |

Helpers: `tests/helpers/db.js` (fresh migrated DB per file), `tests/helpers/factories.js` (valid rows with overrides).
