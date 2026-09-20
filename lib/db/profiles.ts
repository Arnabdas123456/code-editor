import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Profile } from '../types/database';

/**
 * Fetch profile for the currently authenticated user.
 */
export async function getProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ data: Profile | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching profile for user ${userId}:`, error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    console.error(`Unexpected error in getProfile (${userId}):`, err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Upsert or update a profile.
 */
export async function updateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ data: Profile | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      console.error(`Error updating profile for user ${userId}:`, error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    console.error(`Unexpected error in updateProfile (${userId}):`, err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
