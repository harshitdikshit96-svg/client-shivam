# client-shivam — Contractor ERP (Secure Eye Security and Manpower Suppliers)

Next.js app. The UI is generated from `lib/schema.js`, which now holds the client's **frozen spec v1**
(`docs/client-spec-v1.json`, submitted 12 Oct 2026). Data lives in PostgreSQL via Drizzle ORM.

## Run
```bash
npm install
npm run db:migrate                                   # creates tables (local PGlite if DATABASE_URL is unset)
ADMIN_USERNAME=owner ADMIN_PASSWORD='long-password' npm run db:seed
npm run rates:set -- --skill "Unskilled" --basic 556 --vda 0 --from 2026-04-01
npm run dev                                          # http://localhost:3000
```
`NEXT_PUBLIC_APP_MODE=prototype` brings back the old field-selection tool (`/?k=…`, `/review?a=…`).

## Database (`db/schema.js`, migrations in `drizzle/`)
| Table | Holds | Key rules |
|---|---|---|
| `app_users` | the single login | unique username, bcrypt hash |
| `firm_settings` | firm name, CUIN for the dashboard title | exactly one row |
| `work_orders` | work orders (New / Edit / Ongoing / Completed / Pending) | unique WO number, completion ≥ commencement, status pending→approved→completed |
| `workmen` | workman profile (~35 fields) | unique WUIN and 12-digit Aadhaar; exit ≥ joining |
| `engagements` | workman ↔ work order over time | one open engagement per workman |
| `wage_rates` | daily basic + VDA per skill category, by effective date | unique (skill, date) |
| `statutory_rates` | EPF %, ESI %, ceilings, by effective date | |
| `monthly_sheets` | one per work order per month: attendance + wage status | unique (WO, year, month); wages can't move past draft before attendance |
| `attendance_entries` | days worked (0–31), OT hrs, OT min (0/15/30/45) | one row per workman per sheet |
| `wage_lines` | calculated wages, with the rates used copied in | net = gross − deductions (enforced) |
| `dispatch_register` | bills, receipts, GST/EPF/ESIC payment status | unique bill number |

Schema change: edit `db/schema.js` → `npm run db:generate` → commit the new file in `drizzle/` → `npm run db:migrate`.

## Wage engine
`lib/wages.js` (pure maths, paise arithmetic) and `lib/payroll.js` (attendance → `wage_lines`).
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
