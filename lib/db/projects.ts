import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Project } from '../types/database';
import { getDefaultProjectFiles } from './starter-template';
import { batchUpsertFiles } from './files';

export type CreateProjectInput = {
  name: string;
  description?: string;
  prompt?: string;
  framework?: string;
  isPublic?: boolean;
};

export type UpdateProjectInput = Partial<{
  name: string;
  description: string | null;
  prompt: string | null;
  framework: string;
  is_public: boolean;
}>;

/**
 * Fetch all projects accessible to the authenticated user.
 */
export async function getProjects(
  supabase: SupabaseClient<Database>,
  userId?: string
): Promise<{ data: Project[] | null; error: Error | null }> {
  try {
    let query = supabase.from('projects').select('*');
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    console.error('Unexpected error in getProjects:', err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Fetch a single project by ID.
 */
export async function getProjectById(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<{ data: Project | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching project ${projectId}:`, error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    console.error(`Unexpected error in getProjectById (${projectId}):`, err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Create a new project and initialize its starter files.
 */
export async function createProject(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateProjectInput
): Promise<{ data: Project | null; error: Error | null }> {
  try {
    const { data: project, error: createError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: input.name.trim() || 'Untitled Project',
        description: input.description?.trim() || null,
        prompt: input.prompt?.trim() || null,
        framework: input.framework || 'nextjs',
        is_public: input.isPublic ?? false,
      })
      .select('*')
      .single();

    if (createError || !project) {
      console.error('Error creating project:', createError);
      return { data: null, error: new Error(createError?.message || 'Failed to create project') };
    }

    return { data: project, error: null };
  } catch (err: unknown) {
    console.error('Unexpected error in createProject:', err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Update project metadata.
 */
export async function updateProject(
  supabase: SupabaseClient<Database>,
  projectId: string,
  updates: UpdateProjectInput
): Promise<{ data: Project | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select('*')
      .single();

    if (error) {
      console.error(`Error updating project ${projectId}:`, error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    console.error(`Unexpected error in updateProject (${projectId}):`, err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Delete a project and its associated files.
 */
export async function deleteProject(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);

    if (error) {
      console.error(`Error deleting project ${projectId}:`, error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    console.error(`Unexpected error in deleteProject (${projectId}):`, err);
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
