/**
 * Environment configuration and validation.
 * Ensures critical environment variables are present and cleanly formatted.
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Please set it in your .env or .env.local file."
    );
  }

  if (!anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY). Please set it in your .env or .env.local file."
    );
  }

  return {
    url,
    anonKey,
  };
}

export function isSupabaseConfigured(): boolean {
  try {
    const { url, anonKey } = getSupabaseEnv();
    return Boolean(url && anonKey);
  } catch {
    return false;
  }
}
