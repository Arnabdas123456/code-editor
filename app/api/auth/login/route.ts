import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || "").trim().toLowerCase(),
    password: String(password || ""),
  });

  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") {
      return NextResponse.json(
        { message: "Please confirm your email address before logging in." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { message: error?.message || "Invalid email or password." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      name: data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "User",
      email: data.user.email || "",
    },
  });
}
