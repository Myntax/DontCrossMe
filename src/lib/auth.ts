// Auth helpers used by server actions and pages.

import { prisma } from "@db/client";
import { verifyPassword } from "./password";
import { getSessionUserId, createSession, destroySession } from "./session";
import type { UserRole } from "@engine/enums";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
  };
}

export async function login(
  email: string,
  password: string,
): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  await createSession(user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
  };
}

export async function logout(): Promise<void> {
  await destroySession();
}

/** Roles allowed to write data. VIEWER is read-only. */
export function canEdit(role: UserRole | undefined | null): boolean {
  return role === "ADMIN" || role === "COORDINATOR" || role === "CONTRIBUTOR";
}

export function canReview(role: UserRole | undefined | null): boolean {
  return role === "ADMIN" || role === "COORDINATOR";
}
