# Production deployment: Vercel + Neon

The app is a Next.js app on Vercel; the database is Neon (PostgreSQL). **Every Vercel build first applies the database
migrations, then builds** (`vercel.json`: `node scripts/db-migrate.mjs --deploy && next build`), so new tables and columns
reach Neon together with the code that needs them. Pages and API calls read `DATABASE_URL` at run time. Deploys come from GitHub (`harshitdikshit96-svg/client-shivam`, branch `main`).

## 1. Neon database
1. Vercel → the `client-shivam` project → **Storage** → **Create / Connect Database** → **Neon** (Marketplace).
   Pick the region closest to the users, and the same region for the Vercel functions (step 3).
   Connect it to the **Production** environment. This adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`
   (direct) to the project's environment variables.
   *(Alternative: create the project at neon.tech and paste the two addresses in by hand.)*
2. Preview deployments must not write to the production database: either let the Neon integration create a
   database branch per preview, or don't give Preview a `DATABASE_URL` (previews then show an error, by design).
   Builds migrate whatever database they are given: with a per-preview branch, a preview build migrates its own branch.

## 2. Tables (automatic) and the login (once, from this machine)
**Tables:** created by the build. Each deploy runs `db-migrate --deploy`, which applies any new files in `drizzle/`
(already-applied ones are skipped), using `DATABASE_URL_UNPOOLED` if set, else `DATABASE_URL`. In the build log it prints
`migrations applied (<neon host>)`.
- A failing migration **fails the deploy**, and the live site keeps running the previous version.
- A Production build with no `postgres://` address fails with a message saying so.
- A Preview build with no address skips the migrations with a warning.

**The login:** a one-time step the build can't do, because it needs a password.
1. Put the two Neon addresses in a file **`.env.neon`** in the project folder. It is git-ignored, and Next.js never loads it,
   so `npm run dev` keeps using the local database. Copy them from Vercel → Project → Settings → Environment Variables,
   or from Neon → Dashboard → Connect (with "Connection pooling" on, then off):
   ```
   DATABASE_URL=postgres://…-pooler….neon.tech/neondb?sslmode=require
   DATABASE_URL_UNPOOLED=postgres://….neon.tech/neondb?sslmode=require
   ```
2. After the first successful deploy (so the tables exist), create the login:
   ```bash
   ADMIN_USERNAME=shivam ADMIN_PASSWORD='<a long random password>' node --env-file=.env.neon scripts/db-login.mjs
   ```
   The same command later resets a forgotten password.
3. Reload the site. No redeploy is needed.

To migrate by hand (e.g. to check a migration before deploying it): `node --env-file=.env.neon scripts/db-migrate.mjs`.

The production database starts empty, with no demo data. The client's first step after logging in is **Create Firm**.
Never run `db:demo` or `db:reset` against it.

## 3. Vercel project settings
- **Environment Variables (Production):**
  - `DATABASE_URL`, `DATABASE_URL_UNPOOLED`: from Neon (step 1).
  - `TRUST_PROXY=true`: Vercel sets the real visitor address. Without it, five wrong passwords from anyone lock everyone out for 15 minutes.
  - Remove the old prototype values: `CLIENT_TOKEN`, `ADMIN_TOKEN`, `BLOB_READ_WRITE_TOKEN`, and `NEXT_PUBLIC_APP_MODE` if it is there.
    Download anything still wanted from the prototype's Blob store first (the client's field selections), then delete the store.
  - Don't set `COOKIE_SECURE` (Vercel is HTTPS) or `ALLOW_PGLITE`.
- **Functions → Region:** the same region as the Neon database (every request goes to the database, often several times).
- **Domains:** add the client's domain if there is one; HTTPS is automatic.
- **Deployment Protection:** keep it on for Preview deployments.

## 4. Release
```bash
npm test && npm run test:e2e          # 407 + 33 must pass
git push origin main                  # Vercel builds and deploys main to Production
```
Then on the live site: log in, create a firm, a work order (approve it), a workman, engage, enter a month's wages,
and download one Excel file. **Logout** returns to the landing page.

## 5. After going live
- **Daily backups (21 days):** set up once, see section 6. Neon's own point-in-time restore is a second safety net
  (its window depends on the Neon plan).
- **Change the password:** in the app, under Reset Password. If it is forgotten, run `npm run db:login` with the production addresses as in step 2.
- **Logs:** Vercel → Deployments → Logs (Runtime). A missing `DATABASE_URL` shows as
  "DATABASE_URL is not set to a postgres:// address".
- The wrong-password counter lives in each server instance's memory and resets when the instance restarts.

## 6. Daily backups (one-time setup)
Every night at 02:00 India time, Vercel Cron calls `/api/cron/backup` (`vercel.json` → `crons`). That saves the whole
database as `backups/erp-YYYY-MM-DD.json` in a **private** Vercel Blob store, and deletes the oldest file once there are
more than 21. The files hold Aadhaar and bank details, so the store must be **private**. The old prototype store is
public and must not be used.
1. **Vercel → Storage → Create → Blob**, access **Private**, name e.g. `erp-backups`, same region as the functions.
   **Connect** it to this project for **Production**, with the environment variable prefix **`BACKUP`**. That creates
   `BACKUP_BLOB_READ_WRITE_TOKEN`, which the app reads. Without the prefix it would be `BLOB_READ_WRITE_TOKEN`, which the
   app does not use for backups.
2. **Settings → Environment Variables (Production):** add `CRON_SECRET` = a long random value (e.g. `openssl rand -hex 32`).
   Vercel sends it with each cron call; without it the route refuses to run.
3. Redeploy (Deployments → ⋯ → Redeploy) so both values reach the functions.
4. Check: **Settings → Cron Jobs** lists `/api/cron/backup`. Press **Run** once, then look in the Blob store for today's
   file. Logs show `backup erp-…json: … bytes`.

**Retrieve / restore** from a computer with the repo: put `BACKUP_BLOB_READ_WRITE_TOKEN` (copy it from the store's
`.env.local` tab) in `.env.neon` next to `DATABASE_URL`, then:
```bash
node --env-file=.env.neon scripts/db-backup.mjs --list                        # the 21 days kept
node --env-file=.env.neon scripts/db-backup.mjs --download 2026-11-15         # → erp-2026-11-15.json (keep it private)
node --env-file=.env.neon scripts/db-backup.mjs --restore 2026-11-15 --yes    # replace ALL live data with that day
node --env-file=.env.neon scripts/db-backup.mjs                               # take a backup now
```
A restore runs in one transaction (all or nothing). It refuses a backup from a different database version, and it logs
everyone out. A file can also be downloaded from the Blob store in the Vercel dashboard and restored with
`--restore-file file.json --yes`.
