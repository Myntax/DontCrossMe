// Password hashing with Node's built-in scrypt — no external dependency, safe
// for v1's single coordinator login. (Phase 2 swaps in full Auth.js accounts.)

import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hash, "hex");
  return hashBuf.length === test.length && timingSafeEqual(hashBuf, test);
}
