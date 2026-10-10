import { timingSafeEqual } from "crypto";

function same(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
export const isClient = (k) => same(k, process.env.CLIENT_TOKEN);
export const isAdmin = (a) => same(a, process.env.ADMIN_TOKEN);
