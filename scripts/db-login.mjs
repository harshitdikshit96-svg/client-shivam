// Create the single login, or reset its username / password (also the way back in after a forgotten password).
//   ADMIN_USERNAME=owner ADMIN_PASSWORD='at-least-10-chars' npm run db:login
// Every browser that was logged in has to log in again afterwards.
import { getDb } from "../db/index.js";
import { setLogin } from "../lib/session.js";

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
if (!username || !password) {
  console.error("Set both, e.g.:  ADMIN_USERNAME=owner ADMIN_PASSWORD='a-long-password' npm run db:login");
  process.exit(1);
}
try {
  const r = await setLogin(await getDb(), { username, password });
  console.log(r.created ? `Login "${r.username}" created.` : `Login reset: username "${r.username}", new password set. Everyone has to log in again.`);
  process.exit(0);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
