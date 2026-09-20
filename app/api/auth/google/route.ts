import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";

export async function POST(request: Request) {
  const { credential } = await request.json();

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()) {
    return NextResponse.json(
      { message: "Google sign-in is not configured." },
      { status: 503 },
    );
  }

  if (typeof credential !== "string" || !credential) {
    return NextResponse.json({ message: "Google sign-in did not return a credential." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: credential,
  });

  if (error || !data.user) {
    const authError = error?.message.toLowerCase() || "";
    if (authError.includes("unsupported provider") || authError.includes("not enabled")) {
      return NextResponse.json(
        { message: "Google sign-in is disabled in Supabase. Enable Google under Authentication > Providers." },
        { status: 503 },
      );
    }

    return NextResponse.json({ message: error?.message || "Google sign-in failed." }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split("@")[0] || "User",
      email: data.user.email || "",
    },
  });
}