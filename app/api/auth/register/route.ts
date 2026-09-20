import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";

export async function POST(request: Request) {
  const { name, email, password } = await request.json();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (
    !name?.trim()
    || !/^\S+@\S+\.\S+$/.test(normalizedEmail)
    || typeof password !== "string"
    || password.length < 8
  ) {
    return NextResponse.json(
      { message: "Enter your name, a valid email, and a password of at least 8 characters." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { full_name: name.trim() } },
  });

  if (error) {
    const authError = error.message.toLowerCase();
    if (authError.includes("rate limit") || authError.includes("email_send_rate_limit")) {
      return NextResponse.json(
        { message: "Supabase email limit reached. Wait a few minutes, or disable email confirmation for local development." },
        { status: 429 },
      );
    }

    const status = authError.includes("already registered") ? 409 : 400;
    return NextResponse.json({ message: error.message }, { status });
  }

  if (data.user && data.user.identities?.length === 0) {
    return NextResponse.json(
      { message: "An account already exists for this email. Please log in instead." },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      authenticated: Boolean(data.session),
      message: data.session ? "Account created." : "Account created. Check your email to confirm it.",
    },
    { status: 201 },
  );
}
