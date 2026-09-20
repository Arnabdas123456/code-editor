import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: sbUser },
    } = await supabase.auth.getUser();

    if (sbUser) {
      return NextResponse.json({
        user: {
          id: sbUser.id,
          name:
            sbUser.user_metadata?.full_name ||
            sbUser.user_metadata?.name ||
            sbUser.email?.split("@")[0] ||
            "User",
          email: sbUser.email || "",
        },
      });
    }
  } catch {
    // Return an unauthenticated response when Supabase is unavailable.
  }

  return NextResponse.json({ user: null });
}
