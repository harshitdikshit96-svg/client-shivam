// The single login (one username + password in app_users) and browser sessions.
//   login → random token in an httpOnly cookie; the database keeps only its SHA-256 (sessions table)
//   every /api/data call → sessionUser(token); logout or a password change deletes the session rows
// Repeated wrong passwords from one address are slowed down: 5 failures → 15 minutes before the next try.
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, lt, ne } from "drizzle-orm";
import { appUsers, sessions } from "../db/schema.js";
import { UserError } from "./ops.js";
import { checkValue } from "./validate.js";

export const SESSION_COOKIE = "cp_session";
export const SESSION_DAYS = 7;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

const hash = (token) => createHash("sha256").update(token).digest("hex");
// compared when the username is wrong, so a wrong username takes as long as a wrong password
const DUMMY_HASH = bcrypt.hashSync("not-the-password", 10);

const failures = new Map(); // address → { count, until }

export async function theLogin(db) {
  const [user] = await db.select().from(appUsers).orderBy(asc(appUsers.id)).limit(1);
  return user ?? null;
}

/** Check username + password; returns { token, user, expiresAt }. */
export async function login(db, { username, password, address = "local", now = Date.now() }) {
  const f = failures.get(address);
  if (f?.until && f.until > now) {
    const mins = Math.ceil((f.until - now) / 60000);
    throw new UserError(`Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
  const u = String(username ?? "").trim();
  const p = String(password ?? "");
  const fields = {};
  if (!u) fields.username = "Required";
  if (!p) fields.password = "Required";
  if (Object.keys(fields).length) throw new UserError("Enter the username and the password.", { fields });

  const user = await theLogin(db);
  if (!user) throw new UserError("No login has been set up yet. Ask your administrator to set it up.");
  const ok = (await bcrypt.compare(p, user.username === u ? user.passwordHash : DUMMY_HASH)) && user.username === u;
  if (!ok) {
    const count = (f && (!f.until || f.until <= now) ? f.count : 0) + 1;
    failures.set(address, { count, until: count >= MAX_FAILURES ? now + LOCK_MINUTES * 60000 : null });
    const left = MAX_FAILURES - count;
    throw new UserError(left > 0
      ? `The username or password is not correct.${left <= 2 ? ` ${left} more tr${left === 1 ? "y" : "ies"} before a ${LOCK_MINUTES}-minute wait.` : ""}`
      : `Too many wrong attempts. Try again in ${LOCK_MINUTES} minutes.`, { fields: { password: "Not correct" } });
  }
  failures.delete(address);
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date(now)));   // tidy away expired sessions
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + SESSION_DAYS * 86400000);
  await db.insert(sessions).values({ userId: user.id, tokenHash: hash(token), expiresAt });
  await db.update(appUsers).set({ lastLoginAt: new Date(now) }).where(eq(appUsers.id, user.id));
  return { token, user: { id: user.id, username: user.username }, expiresAt };
}

/** The logged-in user for a cookie token, or null (unknown or expired). */
export async function sessionUser(db, token, now = new Date()) {
  if (!token) return null;
  const [row] = await db.select({ id: appUsers.id, username: appUsers.username, sessionId: sessions.id })
    .from(sessions).innerJoin(appUsers, eq(appUsers.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hash(token)), gt(sessions.expiresAt, now)));
  return row ?? null;
}

export async function logout(db, token) {
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hash(token)));
}

/** After a password change: every other browser has to log in again. */
export async function endOtherSessions(db, userId, keepToken) {
  await db.delete(sessions).where(keepToken
    ? and(eq(sessions.userId, userId), ne(sessions.tokenHash, hash(keepToken)))
    : eq(sessions.userId, userId));
}

/** Create the single login, or replace its username and password (server command: npm run db:login). */
export async function setLogin(db, { username, password }) {
  const u = String(username ?? "").trim();
  if (!/^[A-Za-z0-9._@-]{3,64}$/.test(u)) throw new UserError("The username should be 3 to 64 letters, numbers or . _ @ -");
  const bad = checkValue("password", password ?? "");
  if (!password || bad) throw new UserError("The password should be at least 10 characters.");
  const passwordHash = await bcrypt.hash(String(password), 12);
  const user = await theLogin(db);
  if (user) {
    await db.update(appUsers).set({ username: u, passwordHash }).where(eq(appUsers.id, user.id));
    await endOtherSessions(db, user.id, null);
    return { username: u, created: false };
  }
  await db.insert(appUsers).values({ username: u, passwordHash });
  return { username: u, created: true };
}

/** For tests: forget the wrong-password counters. */
export const resetThrottle = () => failures.clear();
