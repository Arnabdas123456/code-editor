import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './env';
import type { Database } from './types/database';

/**
 * Creates a type-safe Supabase browser client for client components.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
