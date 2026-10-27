// The single login: username + password, sessions, logout, password change, and slowing down guessing.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "../helpers/db";
import { appUsers, sessions } from "@/db/schema";
import { login, logout, sessionUser, setLogin, endOtherSessions, resetThrottle, theLogin } from "@/lib/session";
import { OPS, UserError } from "@/lib/ops";

let t, db;
beforeEach(async () => { t = await createTestDb(); db = t.db; resetThrottle(); });
afterEach(async () => { await t.close(); });

const refused = async (p) => { try { await p; } catch (e) { expect(e).toBeInstanceOf(UserError); return e; } throw new Error("expected refusal"); };

describe("one login", () => {
  it("before setup, logging in says the administrator has to set it up", async () => {
    expect((await refused(login(db, { username: "owner", password: "whatever-123" }))).message).toMatch(/No login has been set up/);
  });
  it("setLogin creates it once; running it again replaces username and password, never adds a second login", async () => {
    expect(await setLogin(db, { username: "owner", password: "first-password" })).toMatchObject({ created: true });
    expect(await setLogin(db, { username: "boss", password: "second-password" })).toMatchObject({ created: false });
    const users = await db.select().from(appUsers);
    expect(users.map((u) => u.username)).toEqual(["boss"]);
    expect(users[0].passwordHash).not.toContain("second-password");
  });
  it("a short password or an odd username is refused", async () => {
    await refused(setLogin(db, { username: "owner", password: "short" }));
    await refused(setLogin(db, { username: "a b", password: "long-enough-pw" }));
  });
});

describe("log in and out", () => {
  beforeEach(async () => { await setLogin(db, { username: "owner", password: "correct-horse" }); });

  it("right username + password gives a session; only its hash is stored", async () => {
    const r = await login(db, { username: "owner", password: "correct-horse" });
    expect(await sessionUser(db, r.token)).toMatchObject({ username: "owner" });
    const [row] = await db.select().from(sessions);
    expect(row.tokenHash).not.toBe(r.token);
    expect(row.tokenHash).toHaveLength(64);
  });
  it("wrong password or wrong username: the same message, nothing about which was wrong", async () => {
    const a = await refused(login(db, { username: "owner", password: "nope-nope-nope", address: "a" }));
    const b = await refused(login(db, { username: "someone", password: "correct-horse", address: "b" }));
    expect(a.message).toBe(b.message);
    expect(a.message).toMatch(/username or password is not correct/);
  });
  it("blank fields are named", async () => {
    expect((await refused(login(db, { username: "", password: "" }))).fields).toEqual({ username: "Required", password: "Required" });
  });
  it("5 wrong passwords from one address → 15 minutes wait, even with the right password", async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) await refused(login(db, { username: "owner", password: "wrong-pass", address: "x", now }));
    expect((await refused(login(db, { username: "owner", password: "correct-horse", address: "x", now: now + 60000 }))).message).toMatch(/Too many wrong attempts/);
    expect(await login(db, { username: "owner", password: "correct-horse", address: "x", now: now + 16 * 60000 })).toHaveProperty("token");
    expect(await login(db, { username: "owner", password: "correct-horse", address: "other", now })).toHaveProperty("token");
  });
  it("logout ends the session", async () => {
    const r = await login(db, { username: "owner", password: "correct-horse" });
    await logout(db, r.token);
    expect(await sessionUser(db, r.token)).toBeNull();
  });
  it("an expired session is not accepted", async () => {
    const r = await login(db, { username: "owner", password: "correct-horse" });
    expect(await sessionUser(db, r.token, new Date(Date.now() + 8 * 86400000))).toBeNull();
  });
});

describe("reset password", () => {
  beforeEach(async () => { await setLogin(db, { username: "owner", password: "correct-horse" }); });

  it("needs the current password; the new one works and the old one does not", async () => {
    await refused(OPS.resetPassword(db, { values: { form: { current: "wrong-current", new: "brand-new-pass", confirm: "brand-new-pass" } } }));
    await OPS.resetPassword(db, { values: { form: { current: "correct-horse", new: "brand-new-pass", confirm: "brand-new-pass" } } });
    await refused(login(db, { username: "owner", password: "correct-horse", address: "r" }));
    expect(await login(db, { username: "owner", password: "brand-new-pass", address: "r" })).toHaveProperty("token");
  });
  it("other browsers are logged out, this one stays", async () => {
    const here = await login(db, { username: "owner", password: "correct-horse" });
    const there = await login(db, { username: "owner", password: "correct-horse" });
    await endOtherSessions(db, (await theLogin(db)).id, here.token);
    expect(await sessionUser(db, here.token)).not.toBeNull();
    expect(await sessionUser(db, there.token)).toBeNull();
  });
  it("db:login (setLogin) logs everyone out", async () => {
    const r = await login(db, { username: "owner", password: "correct-horse" });
    await setLogin(db, { username: "owner", password: "reset-by-admin" });
    expect(await sessionUser(db, r.token)).toBeNull();
  });
});
