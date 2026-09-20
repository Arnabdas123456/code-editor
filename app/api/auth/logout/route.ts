import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth";
import { createClient } from "@/lib/server";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Non-critical if Supabase signOut fails
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, "", {
    ...sessionCookie.options,
    maxAge: 0,
  });

  return response;
}
