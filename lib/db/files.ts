import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ProjectFile } from '../types/database';

export type FileInput = {
  path: string;
  name: string;
  content?: string;
  language?: string;
  isFolder?: boolean;
};

/**
 * Fetch all files and directories for a given project.
 */
export async function getProjectFiles(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<{ data: ProjectFile[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
      .order('is_folder', { ascending: false })
      .order('path', { ascending: true });

    if (error) {
      console.error(`Error fetching files for project ${projectId}:`, error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    console.error(`Unexpected error in getProjectFiles (${projectId}):`, err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Save or update a single project file.
 */
export async function saveProjectFile(
  supabase: SupabaseClient<Database>,
  projectId: string,
  file: FileInput
): Promise<{ data: ProjectFile | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('project_files')
      .upsert(
        {
          project_id: projectId,
          path: file.path,
          name: file.name,
          content: file.content ?? '',
          language: file.language ?? 'typescript',
          is_folder: file.isFolder ?? false,
        },
        { onConflict: 'project_id,path' }
      )
      .select('*')
      .single();

    if (error) {
      console.error(`Error saving file ${file.path} for project ${projectId}:`, error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    console.error(`Unexpected error in saveProjectFile (${file.path}):`, err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Batch insert or update multiple files in a project.
 */
export async function batchUpsertFiles(
  supabase: SupabaseClient<Database>,
  projectId: string,
  files: FileInput[]
): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (files.length === 0) return { success: true, error: null };

    const payload = files.map((f) => ({
      project_id: projectId,
      path: f.path,
      name: f.name,
      content: f.content ?? '',
      language: f.language ?? 'typescript',
      is_folder: f.isFolder ?? false,
    }));

    const { error } = await supabase
      .from('project_files')
      .upsert(payload, { onConflict: 'project_id,path' });

    if (error) {
      console.error(`Error batch upserting files for project ${projectId}:`, error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    console.error(`Unexpected error in batchUpsertFiles (${projectId}):`, err);
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Delete a file or directory by its path in a project.
 */
export async function deleteProjectFile(
  supabase: SupabaseClient<Database>,
  projectId: string,
  filePath: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('project_files')
      .delete()
      .eq('project_id', projectId)
      .eq('path', filePath);

    if (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    console.error(`Unexpected error in deleteProjectFile (${filePath}):`, err);
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/** Rename is deliberately implemented as a copy + delete only after the copy succeeds. */
export async function renameProjectFile(
  supabase: SupabaseClient<Database>, projectId: string, file: ProjectFile, nextPath: string
): Promise<{ data: ProjectFile | null; error: Error | null }> {
  const name = nextPath.split('/').pop() || nextPath;
  const saved = await saveProjectFile(supabase, projectId, {
    path: nextPath, name, content: file.content, language: file.language, isFolder: file.is_folder,
  });
  if (saved.error) return saved;
  const removed = await deleteProjectFile(supabase, projectId, file.path);
  return removed.error ? { data: null, error: removed.error } : saved;
}
