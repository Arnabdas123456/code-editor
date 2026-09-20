import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, GenerationHistory } from '../types/database';
import { DEFAULT_GEMINI_MODEL } from '../ai/coding-agent';

export type LogGenerationInput = {
  projectId: string;
  userId: string;
  prompt: string;
  model?: string;
  status?: string;
};

/**
 * Record a prompt and AI code generation entry.
 */
export async function logGeneration(
  supabase: SupabaseClient<Database>,
  input: LogGenerationInput
): Promise<{ data: GenerationHistory | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('generation_history')
      .insert({
        project_id: input.projectId,
        user_id: input.userId,
        prompt: input.prompt.trim(),
        model: input.model || DEFAULT_GEMINI_MODEL,
        status: input.status || 'completed',
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error logging generation:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    console.error('Unexpected error in logGeneration:', err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Fetch generation history for a given project.
 */
export async function getProjectGenerations(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<{ data: GenerationHistory[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('generation_history')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching generation history for project ${projectId}:`, error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    console.error(`Unexpected error in getProjectGenerations (${projectId}):`, err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
