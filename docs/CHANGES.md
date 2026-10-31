# Change log against the client's spec v1 (docs/client-spec-v1.json, 12 Oct 2026)

## Applied with v1
- "Complaince" spelled "Compliance"; the "Dispatch Register" page is titled Dispatch Register (was "Contractor Profile").

## CR-1 — 15 Oct 2026 (Harshit)
1. **Firms.** "Create Firm" button and a firm switcher in the top bar. Each firm has its own work orders,
   workmen, wage sheets and bills; a workman can only be engaged on a work order of the same firm (enforced in the database).
2. **Work order Config.** New / Edit Work Order carry two Config sections, also reachable later from the
   "Config" column on Ongoing Work Orders (screen `wo_config`):
   - Per Day Wage and VDA per Day for each skill category (Highly Skilled, Skilled, Semi Skilled, Unskilled)
   - EPF/CMPF %, EPF wage ceiling, ESI %, ESI gross limit, overtime rate, working hours per day, wage deadline day
   Defaults: EPF 12%, ESI 0.75% up to ₹21,000 gross, OT ×2, 8-hour day.
3. **Attendance on the Wage Entry screen.** Days Worked, OT Hrs and OT Min are typed directly in the wage grid;
   Basic, VDA, OT, Gross, EPF, ESI, Total Deduction and Net calculate instantly from the work order's Config.
   The separate attendance screens (New / Submitted / Approved Attendance, Attendance Entry) are removed.
   Changing Config recalculates months still in draft; submitted months keep the values they were calculated with.

## CR-2 — 15 Oct 2026 (review feedback: "it should work like an ERP")
1. **Firm only in the top bar.** New Work Order no longer has a Firm field; every create/edit screen says which
   firm it saves under. Switching the firm reloads every list for that firm.
2. **Records are linked.** New pages: *Work Order* (details, workmen on it, wage months, bills) and *Workman*
   (details, engagement history, wages by month). Work order numbers, WUINs, names and "Engaged in" are links
   between them on every list. Ongoing work orders show how many workmen are engaged.
3. **Every button works or says why not.** Save / Submit / Engage / Approve / Config / Bills write to the database;
   wrong or missing fields are marked in red with a message; a missing step (no firm, order not approved, no per day
   wage in Config, nobody engaged that month…) is explained with a button to the screen that fixes it.
   Download Excel / FORM A download CSV files; View Wage Statement and Print Wage Slip print. Document uploads
   (labour licence, photo, appointment letter, proof of wage) are not in this version and say so. Logout says
   that sign-in is not switched on yet.
4. **Aadhaar** is typed when a workman is added (12 digits, unique in the firm) and locked afterwards. WUIN is
   given automatically (WM00001, …). A Date of Exit ends the current engagement and moves the workman out.
5. **Wage Entry** starts with Work Order (of the selected firm) + Year + Month and lists the workmen engaged on
   that order in that month; days, OT and extras are typed per row and calculate live; Save, Submit, Approve.
   Submitted / Approved Wages and Worker Wage Slip are now in the Wages menu.
6. **Approval.** The single login approves / rejects work orders (Pending Work Order Approval, which also lists
   rejected orders to resubmit), marks them completed (ends their engagements) or reopens them, and approves
   submitted wages.
7. **Bulk Accommodation** opens a panel that explains it (Accommodation = where the workman stays: Self,
   Company Quarter, Contractors' camp) and sets it for the ticked workmen.
8. **Home** is first in the menu. Home shows a "Getting started" checklist until the firm has done each step once,
   clickable summary cards, and recent activity. The Compliance Summary steps no longer mention the Attendance
   screens removed in CR-1.
9. **Dispatch Register** lists the firm's bills (linked to work orders) with Edit, and a form to add or edit a bill.

## CR-3 — 15 Oct 2026 (everything editable, rules in config, field validation everywhere)
1. **Everything is editable.** Aadhaar and WUIN on a workman (WUIN left blank = next number), every field of a work
   order on Edit Work Order (number, name, company, dates, principal employer…), engagement dates (Edit on the
   work order and workman pages), and submitted / approved wages (Reopen for Editing → correct → Submit again).
2. **Rules live in `lib/rules.js`**, not in the database: Aadhaar required / unique per firm, format checks on or off,
   minimum age at joining (18), engagement date checks, reopening wages, and `lockedAfterCreate` to lock chosen
   fields once saved (empty by default).
3. **Keys.** Every table has a generated `id` primary key and records link only through ids (`work_order_rates` and
   `work_order_config` were keyed by work order + skill / work order id; now they have their own id). Typed values
   are never keys. Typed identifiers people search by stay unique within a firm: work order number, WUIN, bill
   number, firm name / CUIN. Migration: `drizzle/0001_cr3_surrogate_keys.sql`.
4. **Field validation on every form** (`lib/validate.js`, one table of formats in `lib/schema.js` → `FIELD_FORMATS`):
   - while typing: number fields accept digits only (Aadhaar 12, mobile 10, pincode 6, bank account 18, ESIC IP 10,
     ESIC code 17), PAN / GSTIN / IFSC / UAN become capitals, every field stops at its maximum length;
   - when leaving a field: Aadhaar 12 digits, mobile 10 digits starting 6–9, pincode 6 digits, PAN ABCDE1234F,
     GSTIN 15, IFSC SBIN0001234, email, names letters only, codes without symbols, amounts with ≤ 2 decimals,
     percentages 0–100, real calendar dates;
   - on save the server applies the same checks, plus: choices must be from the list, date of birth in the past,
     age ≥ 18 at joining, received / approval date not before the bill date, password ≥ 10 characters.

## CR-4 — 15 Oct 2026 (login)
1. **One login.** A single username + password (`app_users`). Logged out, the site shows a full-screen home page
   with the login and no data; every data call needs a session (401 otherwise). After login the portal opens on Home.
2. **Logout** (top bar and menu) ends the session and returns to the full-screen home page.
3. **Reset Password** (Compliance) changes the password with the current one and logs out every other browser.
   A forgotten password is reset by the administrator on the server: `npm run db:login`.
4. Sessions: random token in an httpOnly cookie, only its SHA-256 stored (`sessions`, migration
   `drizzle/0002_sessions.sql`), 7 days. Wrong passwords: 5 tries per address, then 15 minutes.

## CR-5 — 26 Oct 2026 (test plan D1–D5, security audit, error handling)
1. **One work order per workman per day.** Engage, Edit Dates, End, Delete, Date of Exit and Mark Completed share one
   check: no overlapping engagements, within the order's dates and after joining (switchable in `lib/rules.js`).
2. **Wage days.** Per row: not more than the month's days, not more than the days engaged on that order, and not more
   than the month across all orders (`RULES.wageDaysWithinEngagement`). Flagged while typing, refused on Save.
3. **Delete** for firm, work order, workman, engagement, draft wage month and bill — refused while other records depend
   on it, naming them. Clearing a saved row's Days Worked and pressing Save removes that row.
4. **No stranded records.** Order dates, engagement dates, Date of Exit / Joining and Mark Completed are refused when
   they would leave engagements or paid months outside, naming them.
5. Edit on ended engagements; Nature of Work, Area of Operation and supervisor name / phone optional on Edit (and
   available on New Work Order); names in any script (e.g. Hindi).
6. **Security:** CSRF checks (same Origin, JSON only), safe operation lookup, 512 KB body limit, security headers
   (CSP, frame-ancestors none, nosniff, HSTS), prototype endpoints closed, `X-Forwarded-For` only with `TRUST_PROXY`,
   expired sessions purged, CSV formula injection blocked, Next.js 15.5.28 (critical RCE fix), 0 production
   vulnerabilities.
7. **Error handling:** plain messages for no connection / server error, a recovery panel when a screen fails to draw.

## CR-6 — 26 Oct 2026 (review feedback)
- **Work Location (District)** on New / Edit Work Order suggests the districts of the chosen State (`lib/districts.js`)
  and still takes any name typed in, for a district missing from the list. Changing the State clears a district picked
  from the old State's list; a typed-in one is kept.
- **Workmen Photo removed**: the menu item, the screen and the unused `workmen.photo_path` column
  (`drizzle/0003_drop_workman_photo.sql`).
- **Engage**: the date picker starts at the later of the work order's start and the workman's Date of Joining; an
  earlier date is refused with when the workman joined and how to fix it.
- **Wage Entry**: more days than the engagement covers now shows the engagement dates, the most days allowed, and
  where to correct the dates.
- **Last Attendance Date** stops at the day the engagement ended instead of always the end of the paid month.
- Dialogs: space between the last field and the buttons.
- The e2e tests build into `.next-e2e`, so running them no longer breaks a running dev server (`Cannot find module './NNN.js'`).

## CR-7 — 31 Oct 2026 (review feedback)
- **Engage Workmen** opens on the top approved work order ("— select —" only when there is none) and lists that order's
  workmen (marked Engaged) plus the free workmen (not engaged anywhere), which can be ticked. A workman engaged on
  another order no longer looks available. To move someone to another order, tick **"Also show workmen engaged on other work orders"**
  (the old engagement still ends the day before the new one). Opening Engage from a workman's page
  ("Engage on another work order") lists that workman first. When everyone is engaged, the empty list says so.
- **Dispatch Register: Tax Rate and GST Rate.** After Taxable Amount: **Tax Rate (%)** and **GST Rate (%)**, each a
  drop-down of 0% / 5% / 18% / Other (Other opens a box for any rate 0–100, decimals allowed). **Tax Amount**, **GST
  Amount** and **Total Amount** (= taxable + tax + GST) are calculated as you pick, and stored by the server from the same
  formula (`lib/bill.js`). The amounts can't be typed. The bills list shows Tax, GST and Total.
  Migration `drizzle/0004_bill_tax_rates.sql` adds `tax_rate`, `tax_amount`, `gst_rate`, `total_amount`. Bills saved
  before it get their GST rate worked out from the GST amount typed then, and their total.

## CR-8 — 31 Oct 2026 (statutory formats)
The downloads follow the client's sample formats exactly: headings character for character, each value under its heading.
- **Form D — "WAGE STATEMENT FOR THE MONTH OF …"** (Wage Entry → **View Wage Statement**, and **Download Excel**):
  - **Header table:** Name of Firm/Establishment, Name of Owner/Contractor, Work Order Reference No, Name of the Work,
    and the Dates of Commencement and Completion.
  - **25 columns,** from Name to EPF/CMPF Account Number.
  - **"Paid Wages Verified By"** gives the Principal Employer [Designation] and the approval date.
  - **Printing:** A4 landscape, with "Page n/m" and "Contractor CUIN : … | date time" on every page.
  - **Download Excel** is now a real `.xlsx` in the same layout (`lib/xlsx.js`, no new dependency). Amounts are numbers;
    bank account, UAN and Group Insurance numbers are text, so no digits or leading zeros are lost.
- **FORM – VIII-C wage slip** (Worker Wage Slip → **Print Wage Slip**):
  - The 12 numbered rows of the format.
  - **Basic and D.A.:** the month's amounts, with the daily rates under them.
  - **Other Allowances:** UG + Bonus + EDLIS + PLI + Other Earnings.
  - **Others deduction:** CMPS + Fine + Damage Recovery + Other Deduction (CR-9).
  - **Masking:** UAN shows as XXXXXXXX + last 4 digits, the bank account as ****** + last 4 digits.
  - **Printing:** A4 portrait.
- Both open full-screen with **Print / Save as PDF**; printing outputs only the document (`components/Forms.js`).
  The headings and values are built once in `lib/forms.js`.

## CR-9 — 31 Oct 2026 (review feedback: "all the things are calculated through my office")
- **Wage Entry: CMPS Deduction and Fine** are columns the office types in, beside Other Deduction and Damage Recovery
  (they had been left out in CR-1). Total Deduction = EPF/CMPF + CMPS + ESI + Fine + Damage Recovery + Other Deduction.
  Form D shows them under their headings, the wage slip includes them in "c) Others", and the Worker Wage Slip screen
  lists them. Migration `drizzle/0005_wage_cmps_fine.sql`; existing wage lines get 0.
- **Form D "Name of Owner/Contractor"** is no longer typed separately: it is the work order's **"Name of the supervisor /
  Auth. Personnel representing the contractor"** (entered when the work order is created), or the firm name when that is blank.
  The manual owner-name field added earlier the same day was removed before release.

## CR-10 — 31 Oct 2026 (review feedback)
- **No CSV downloads remain.** Engage Workmen → **Download Excel** is the Form D wage statement (.xlsx) of the selected
  work order, for its latest month with saved wages (if none, it says so and offers Wage Entry). **FORM A** is an .xlsx
  register of workmen. The CSV writer is removed. Wage Entry → Download Excel was already Form D (.xlsx, CR-8).
  The live site showed CSVs because it still runs the last pushed version (`d5f6e97`).
- **Firm switch:** the old firm's records no longer flash after picking another firm. The drop-down shows the new firm
  at once, and the page shows a loading shimmer (React `<Suspense>`, `components/App.js`) until the new firm's data
  arrives. A slow answer for an earlier choice can no longer overwrite a later one (`components/Data.js`).
- **A crash in a button's code** shows a plain message ("Something went wrong on this screen…") instead of the
  technical error, with the details in the browser console.
- **Tests that stop these coming back:**
  - The every-button test now fails on any crash in a button's code and on any download that isn't an .xlsx.
  - New tests cover the firm switch (shimmer, and the out-of-order answer), the Engage and FORM A Excel files, and,
    in the browser, UI-12 (slow firm switch) and UI-13 (real .xlsx files).
