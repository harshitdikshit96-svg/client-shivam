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
