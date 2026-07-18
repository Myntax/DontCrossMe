// Minimal signed-cookie session. The cookie holds a user id plus an HMAC over
// it keyed by SESSION_SECRET, so it can't be forged without the secret.

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { appConfig } from "./config";

const COOKIE_NAME = "dcm_session";

function sign(value: string): string {
  return createHmac("sha256", appConfig.sessionSecret).update(value).digest("hex");
}

function serialize(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function deserialize(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(userId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, serialize(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return deserialize(store.get(COOKIE_NAME)?.value);
}
