# ERP Test Plan — Contractor Portal (client-shivam)

Hierarchy under test: **Firm → Work Orders (+ Config) → Engagements ↔ Workmen → Monthly Wages → Bills**.
Rule under test throughout: **a workman is on at most one work order on any day.**

| Layer | File | How to run |
|---|---|---|
| Service + database (create/read/update, relations, views) | `tests/db/erp-crud.test.js` | `npx vitest run tests/db/erp-crud.test.js` |
| Browser (forms → lists → edit) | `e2e/workflow-crud.spec.js` | `npm run test:e2e` (runs after `navigation.spec.js`) |

Result on 23 Oct 2026: 53 service cases: 44 pass, 9 fail; 11 browser cases: 10 pass, 1 fail (defects D1–D5 below).
**Result on 26 Oct 2026, after the fixes: all 53 service cases and all 11 browser cases pass**, with the whole suite:
335 unit / database / UI tests and 29 browser tests (`npx vitest run`, `npm run test:e2e`). See sections 9–12 for the
security audit, error handling, screen-vs-database checks and the HTTP API tests added on 26 Oct.

## 1. Firm
| ID | Case | Result |
|---|---|---|
| F-01 | Created firm is listed in the top bar and selected | Pass |
| F-02 | Firm Name is required (field marked) | Pass |
| F-03 | Two firms cannot share a name or a CUIN | Pass |
| F-04 | Wrong mobile / pincode format is refused per field | Pass |
| F-05 | Edit form loads saved values; rename shows on the firm's work orders | Pass |
| UI-01 | Create Firm (navbar) creates two firms, each selectable | Pass |

## 2. Work Order and Config
| ID | Case | Result |
|---|---|---|
| WO-01 | New order is saved under the selected firm, Pending, with its Config (rate, EPF, ESI) | Pass |
| WO-02 | Order number unique within a firm; another firm may reuse it | Pass |
| WO-03 | Completion before commencement / no Per Day Wage refused; nothing half-saved | Pass |
| WO-04 | Edit form loads the order; edits (name, dates, rate) show in the list; updatedAt moves | Pass |
| WO-05 | Config change recalculates draft months only; submitted months keep their rates | Pass |
| WO-06 | Status moves: only allowed ones (approve/reject/resubmit/complete/reopen); Complete ends engagements | Pass |
| WO-07 | No engagement on a pending or rejected order | Pass |
| WO-08 | Order dates cannot be shortened so engagements / wages fall outside them | Pass (fixed D5) |
| UI-02 | New order + Approve → listed under Ongoing of that firm only, 0 workmen | Pass |
| UI-03 | Edit Work Order form loads saved values; change shows on the order page | Pass |
| UI-04 | Config: new Per Day Wage saved and shown again on reopen | Pass |

## 3. Workman
| ID | Case | Result |
|---|---|---|
| WM-01 | WUIN WM00001, WM00002… per firm; new workman is Inactive (not engaged) | Pass |
| WM-02 | Same Aadhaar twice in a firm refused (names the WUIN); another firm allowed | Pass |
| WM-03 | Required Aadhaar, 12 digits, under-18 on joining, future DOB refused | Pass |
| WM-04 | Edit form loads the workman; new name shows in lists, engagements and wage lines | Pass |
| WM-05 | Date of exit ends the current engagement → Moved out; cannot be engaged again | Pass |
| WM-06 | Date of exit before the current engagement start refused | Pass |
| WM-07 | Bulk Accommodation changes only the ticked workmen of this firm | Pass |
| UI-05 | New Workman → engaged: Active list, workman page and order page show the link | Pass |
| UI-09 | Edit Workman: new name shows in lists and wage lines | Pass |

## 4. Engagement — one work order at a time
| ID | Case | Result |
|---|---|---|
| EN-01 | Engaging links workman ↔ order in every view (engagements, workman, order count) | Pass |
| EN-02 | Engaging on a 2nd order moves him: 1st ends the day before; only one current | Pass |
| EN-03 | Same order again / move date not after current start refused | Pass |
| EN-04 | Database refuses two current engagements for one workman | Pass |
| EN-05 | Same workman ticked twice in one Engage: clean refusal, ≤ 1 engagement | Pass |
| EN-06 | Back-dated engagement may not overlap an **ended** engagement on another order | Pass (fixed D1) |
| EN-07 | Editing dates may not create an overlap with another order | Pass (fixed D1) |
| EN-08 | Editing dates keeps the engage rules (order dates, date of joining) | Pass (fixed D2) |
| EN-09 | Engagement cannot be shortened so saved wages fall outside it | Pass (fixed D5) |
| EN-10 | End before start / ending twice refused; ended shows as Ended, workman Inactive | Pass |
| EN-11 | Outside order dates / before joining refused; one bad row saves nothing | Pass |
| UI-06 | Move to WF-WO-2 in the UI: WF-WO-1 ends 15 Aug, WF-WO-2 current; counts 0 / 1 | Pass |
| UI-07 | Edit Dates in the UI: moving WF-WO-2's start back into WF-WO-1's period is refused | Pass (fixed D1) |

## 5. Wages
| ID | Case | Result |
|---|---|---|
| WG-01 | 26 days × ₹556 → gross 14,456, EPF 1,735, ESI 108, net 12,613; shown under order and workman | Pass |
| WG-02 | Saving again updates the line, never duplicates | Pass |
| WG-03 | Workman not engaged that month → row error, nothing saved for him | Pass |
| WG-04 | Days worked ≤ days in the month (31 in September refused) | Pass (fixed D3) |
| WG-05 | Days worked ≤ days engaged on that order in the month | Pass (fixed D3) |
| WG-06 | Moved mid-month: days across both orders ≤ days in the month (no double pay) | Pass (fixed D3) |
| WG-07 | Negative / text / OT minutes not in quarter hours refused; 12.5 days allowed | Pass |
| WG-08 | Month outside the order, or another firm's order, refused | Pass |
| WG-09 | Submit locks; approve needs submit; reopen makes it editable again | Pass |
| WG-10 | Another firm cannot submit / approve / reopen these wages | Pass |
| WG-11 | Every line net = gross − deductions; sheet totals = sum of lines | Pass |
| WG-12 | A submitted line keeps the rate it was calculated with | Pass |
| UI-08 | Wage entry on WF-WO-2 visible on the order page and on the workman page | Pass |

## 6. Dispatch Register (bills)
| ID | Case | Result |
|---|---|---|
| BL-01 | Bill created, listed with its work order number, then edited (no duplicate) | Pass |
| BL-02 | Bill number unique per firm; negative amount refused | Pass |
| BL-03 | Bill cannot point at / be edited from another firm | Pass |
| UI-10 | New bill in the UI listed with WF-WO-2, then edited | Pass |

## 7. Firm isolation
| ID | Case | Result |
|---|---|---|
| IS-01 | Another firm cannot read/change this firm's order, config, status, workman, engagement | Pass |
| IS-02 | Firm B's workman cannot be engaged on firm A's order (app and database) | Pass |
| IS-03 | Each firm's views show only its own records | Pass |
| UI-11 | Switching to firm B in the top bar shows none of firm A's records | Pass |

## 8. ERP sanity
| ID | Case | Result |
|---|---|---|
| SN-01 | SQL/HTML-looking text stored and shown literally | Pass |
| SN-02 | Impossible dates (30 Feb, month 13) refused | Pass |
| SN-03 | Ids that don't exist → clear message, no crash | Pass |
| SN-04 | Records entered by mistake can be removed / cancelled | Pass (fixed D4) |
| — | Logged-out API calls get 401; wrong password refused; password reset logs out other sessions | Pass (navigation.spec.js, session tests) |

## Defects found
| # | Severity | Defect | Suggested fix → **Status (26 Oct)** |
|---|---|---|---|
| D1 | **High** | A workman can be on two work orders at once: (a) a back-dated engagement overlaps an ended one; (b) Edit Dates moves a start/end into another order's period (reproduced in the UI) | One overlap check used by `engageWorkmen` and `editEngagement`: no other engagement of the workman with `from ≤ other.to` and `to ≥ other.from`; optionally a Postgres exclusion constraint on (workman, daterange)  → **Fixed.** One check (`checkEngagementChange` in `lib/ops.js`) is used by Engage, Edit Dates, End, Delete, Date of Exit and Mark Completed: no other engagement of the workman may overlap the new period. |
| D2 | Medium | Edit Dates skips the rules Engage applies (within order dates, not before joining) | Reuse the same checks in `editEngagement`  → **Fixed.** Edit Dates applies the same rules as Engage (order dates, date of joining, date of exit), switchable in `lib/rules.js`. |
| D3 | **High** | Wages accept more days than possible: 31 days in a 30-day month; more days than engaged; a workman moved mid-month paid 15 + 26 = 41 days in August | In `saveWageLine`: days ≤ days engaged on that order in the month, and the sum across all orders of that month ≤ days in month  → **Fixed.** Save refuses per row: more days than the month has; more than the days engaged on that order; more than the month across all orders. The grid flags it while typing. `RULES.wageDaysWithinEngagement`. |
| D4 | Medium | No delete / cancel anywhere (firm, order, workman, engagement, wage month, bill) — a wrong entry can only be edited | Delete for records with nothing linked (e.g. a pending order, an unengaged workman, a wrong engagement with no wages, a draft month, a bill); otherwise "Cancel"/archive  → **Fixed.** Delete for firm, work order, workman, engagement, draft wage month and bill; refused while records depend on it, naming them (e.g. "has 4 engagements, 3 wage months, 1 bill"). A saved wage row is removed by clearing its Days Worked. |
| D5 | Medium | Edits can orphan linked data: order dates shortened past its engagements/wages; an engagement ended before a month already paid | Refuse with a message naming the linked records  → **Fixed.** Order dates, engagement end/edit/delete, Date of Exit, Date of Joining and Mark Completed are refused when they would leave engagements or paid months outside, naming them. |

Other observations (not failures) — all addressed on 26 Oct:
- ~~The first edit of any work order requires four fields that the New Work Order form never asked for~~ → optional on Edit, and can be filled on New Work Order (CR-5).
- ~~Ended engagements have no Edit button~~ → Edit (and Delete) on every engagement; End only on current ones. UI-07 updated accordingly.
- ~~Names allow English letters only~~ → letters of any script (Hindi, Bengali, Assamese…) are accepted; digits and symbols are still refused.

## 9. Security audit (26 Oct 2026) — `e2e/security-api.spec.js`, `tests/db/session.test.js`
| ID | Check | Result |
|---|---|---|
| SEC-01 | Logged-out calls to `/api/data` (GET and POST) get 401; nothing is returned | Pass |
| SEC-02 | Session cookie: HttpOnly, SameSite=Lax, Secure (production), Path=/; only its SHA-256 stored; logout ends it on the server | Pass |
| SEC-03 | CSRF: a foreign `Origin` → 403; a form-style (non-JSON) body → 415; also on login and logout | Pass — **fixed today** |
| SEC-04 | Operation names are looked up with `Object.hasOwn`: `constructor`, `__proto__`, `toString` → 400 "Unknown action" | Pass — **fixed today** (they used to reach `Object`'s own functions) |
| SEC-05 | Oversized body → 413; malformed JSON → 400; non-numeric `?firm=` never reaches SQL | Pass — 413 **added today** |
| SEC-06 | Security headers: CSP (`frame-ancestors 'none'`, `object-src 'none'`), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS (production); no `X-Powered-By` | Pass — **added today** |
| SEC-07 | Field-selection prototype endpoints (`/api/config`, `/api/submit`, `/review`) answer 404 unless `NEXT_PUBLIC_APP_MODE=prototype` | Pass — **closed today** (they were reachable with the default tokens) |
| SEC-08 | Password guessing: 5 wrong → 15-minute wait; `X-Forwarded-For` only believed with `TRUST_PROXY=true` (it could be faked to dodge the limit) | Pass — **fixed today** |
| SEC-09 | Wrong username and wrong password give the same message and take the same time | Pass |
| SEC-10 | SQL injection: every query is parameterised (Drizzle); SQL-looking text is stored and shown literally (SN-01) | Pass |
| SEC-11 | XSS: React escapes all output; no `dangerouslySetInnerHTML` / `eval` in the code | Pass |
| SEC-12 | CSV / Excel formula injection in Download Excel and FORM A (`=`, `+`, `-`, `@` cells kept as text) | Pass — **fixed today** |
| SEC-13 | Firm isolation over HTTP: firm B's id cannot read, change or delete firm A's records | Pass |
| SEC-14 | Dependencies: `npm audit --omit=dev` → **0 vulnerabilities** (Next.js 15.5.27 → 15.5.28 fixed a critical RCE in image optimisation; `@vercel/blob` pinned to 2.4.0; `postcss` in Next overridden to 8.5.30). 4 moderate remain in `esbuild` under `drizzle-kit` — a development-only tool, never deployed | Pass |
| SEC-15 | Secrets: none committed (git history has only the `change-me-…` placeholders); `.env.local` is git-ignored | Pass |
| SEC-16 | Expired sessions are purged at each login | Pass — **added today** |

Notes for deployment: serve over HTTPS (the cookie is `Secure`); behind nginx / a load balancer set `TRUST_PROXY=true`;
on plain HTTP only, `COOKIE_SECURE=false`. The wrong-password counter is kept in memory (it resets when the server restarts).

## 10. Error handling and graceful degradation — `tests/ui/resilience.test.jsx`, `tests/ui/live.test.jsx`
| ID | Case | Result |
|---|---|---|
| RS-01 | Server unreachable while saving → "Cannot reach the server, so nothing was saved"; typed values kept | Pass — **message added today** (was the raw "Failed to fetch") |
| RS-02 | Server error (500, no JSON) → "The server had a problem and nothing was changed" — no technical detail | Pass |
| RS-03 | Session ended while working → back to the login page with "Your session has ended" | Pass |
| RS-04 | Refused action → message bar names the problem, the field is marked red, a button opens the screen that fixes it | Pass |
| RS-05 | A screen that fails to draw → "This screen ran into a problem… Go to Home / Reload" instead of a blank page | Pass — **added today** |
| RS-06 | Every button on every screen gives visible feedback (230+ clicks); no button falls back to "not available" | Pass |
| RS-07 | Empty database / missing step → guidance with the button to the fixing screen (no firm, order not approved, no Config…) | Pass |
| RS-08 | Impossible wage days flagged on the row while typing, before Save | Pass — **added today** |
| RS-09 | Bill form: pressing Edit on the bill already open no longer reloads it over what is being typed | Pass — **fixed today** (race found by UI-10) |

## 11. Screens vs database — `tests/ui/relations.test.jsx`
For both demo firms, every work order page and every workman page is rendered and compared with plain SQL on the
tables (not with the code the screens use): engagements (who, from, to), wage months (period, workmen, net), bills,
each workman's engagements and wage lines; the Active / Inactive / Moved-out lists, "Workmen Engaged" counts and the
Home cards. **All match.**

## 12. Integrity and delete — `tests/db/integrity.test.js`
Delete of every record type (allowed / refused with the reason), clearing a wage row, Mark Completed / Date of Exit /
Date of Joining refused when they would strand wages or engagements, Hindi names, and the rule switch. **All pass.**
