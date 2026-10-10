# client-shivam — Contractor Portal field-selection prototype

A no-database Next.js prototype. Every screen is generated from `lib/schema.js`.
The client hides, renames and reorders menu items, sections, columns, fields and buttons;
his choices autosave to the server and become the spec for the real build.

## Run locally
```bash
npm install
cp .env.example .env.local   # set CLIENT_TOKEN and ADMIN_TOKEN to long random values
npm run dev
```
- Client link: `http://localhost:3000/?k=<CLIENT_TOKEN>`
- Review link: `http://localhost:3000/review?a=<ADMIN_TOKEN>`

Drafts are stored in `.data/config.json` locally. On Vercel, connect a **Public** Blob store
(sets `BLOB_READ_WRITE_TOKEN`) and set both tokens as environment variables.

## Files
- `lib/schema.js` — all 23 screens (Attendance Entry = days worked per workman; Wage Entry = auto-calculated from it), menu, columns, fields (`locked`, `req`, `readOnly`, `calc`, `feeds`)
- `lib/resolve.js` — applies overrides; builds the review spec
- `components/Cust.js` — overrides, undo/redo, autosave, confirm dialog, toolbar, Submit final
- `components/PageView.js` — one renderer for every block type
- `components/Sidebar.js`, `components/Edit.js` — menu and the hide/rename/move/drag controls
- `app/api/config`, `app/api/submit` — save draft, submit, reopen (token-checked)
- `app/review` — removed/renamed lists, final field list, JSON download, Reopen (with note), History tab: every Submit saved as v1, v2… with a diff vs the previous version and per-version download

## Rules
- Locked (🔒): Aadhaar, WUIN, Work Order Number, Attendance Days, Gross/Total Deduction/Net, read-only header and system fields.
- Hiding a column that feeds a calculation asks for confirmation.
- No adding new fields. Tables are empty by design.
