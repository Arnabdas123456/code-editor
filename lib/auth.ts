import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const cookieName = "ai_studio_session";
const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV === "production" ? (() => { throw new Error("AUTH_SECRET environment variable is required in production"); })() : "development-only-secret-change-before-deploying");

export type SessionUser = { id: string; name: string; email: string };

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, storedHash] = stored.split(":");
  if (!salt || !storedHash) return false;
  const suppliedHash = (await scrypt(password, salt, 64)) as Buffer;
  const expectedHash = Buffer.from(storedHash, "hex");
  return expectedHash.length === suppliedHash.length && timingSafeEqual(expectedHash, suppliedHash);
}

function sign(payload: string) { return createHmac("sha256", secret).update(payload).digest("base64url"); }

export function createSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(token?: string): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return session.exp > Date.now() ? { id: session.id, name: session.name, email: session.email } : null;
  } catch { return null; }
}

export async function getCurrentUser() { return readSession((await cookies()).get(cookieName)?.value); }

export const sessionCookie = { name: cookieName, options: { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 } };
