import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  DEFAULT_GEMINI_MODEL,
  GeminiQuotaError,
  GeminiUnavailableError,
  runGeminiAgent,
  selectProjectContext,
  validateAgentResult,
} from '@/lib/ai/coding-agent';
import type { ProjectFile } from '@/lib/types/database';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const body = await request.json() as {
      prompt?: string;
      mode?: 'build' | 'code' | 'debug';
      activePath?: string;
      selectedCode?: string;
      previewError?: string;
      files?: ProjectFile[];
    };
    if (!body.prompt?.trim() || body.prompt.length > 8_000) return NextResponse.json({ message: 'Provide a prompt under 8,000 characters.' }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (process.env.NODE_ENV !== 'production' || projectId === 'local-project') {
        const currentFiles: ProjectFile[] = (body.files ?? [])
          .filter((f): f is ProjectFile => Boolean(f && typeof f.path === 'string' && f.path.trim().length > 0))
          .map((f, i) => ({
            id: f.id || `f-${i}`,
            project_id: projectId,
            name: f.name || f.path.split('/').pop() || f.path,
            path: f.path,
            content: f.content ?? '',
            language: f.language || inferLanguage(f.path),
            is_folder: Boolean(f.is_folder),
            created_at: f.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

        const proposed = await runGeminiAgent(
          body.prompt.trim(),
          selectProjectContext(currentFiles, body.activePath, body.selectedCode, body.previewError, body.mode)
        );
        const result = validateAgentResult(proposed, currentFiles);

        let updatedFiles = [...currentFiles];
        for (const op of result.operations) {
          if (op.type === 'create') {
            const name = op.path.split('/').pop() || op.path;
            updatedFiles = updatedFiles.filter((f) => f.path !== op.path);
            updatedFiles.push({
              id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              project_id: projectId,
              name,
              path: op.path,
              content: op.content,
              language: op.language || inferLanguage(op.path),
              is_folder: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } else if (op.type === 'update') {
            updatedFiles = updatedFiles.map((f) =>
              f.path === op.path ? { ...f, content: op.content, updated_at: new Date().toISOString() } : f
            );
          } else if (op.type === 'delete') {
            updatedFiles = updatedFiles.filter((f) => f.path !== op.path);
          } else if (op.type === 'rename') {
            const name = op.newPath.split('/').pop() || op.newPath;
            updatedFiles = updatedFiles.map((f) =>
              f.path === op.path ? { ...f, path: op.newPath, name, updated_at: new Date().toISOString() } : f
            );
          }
        }

        return NextResponse.json({
          summary: result.summary,
          operations: result.operations,
          files: updatedFiles,
          dependencies: result.dependencies ?? [],
        });
      }
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`generate:${user.id}`, 10, 60_000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { message: `Generation rate limit reached. Please wait ${rateLimit.reset}s before trying again.` },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.reset),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.reset),
          },
        }
      );
    }

    const { data: project } = await supabase.from('projects').select('id, name').eq('id', projectId).eq('user_id', user.id).maybeSingle();
    if (!project) return NextResponse.json({ message: 'Project not found.' }, { status: 404 });
    const { data: files, error: filesError } = await supabase.from('project_files').select('*').eq('project_id', projectId).order('path');
    if (filesError) throw new Error(filesError.message);
    const currentFiles = files ?? [];
    const proposed = await runGeminiAgent(
      body.prompt.trim(),
      selectProjectContext(currentFiles, body.activePath, body.selectedCode, body.previewError, body.mode)
    );
    const result = validateAgentResult(proposed, currentFiles);
    // Preflight the entire plan before any mutation. The operations below are then executed in order.
    const generation = await supabase.from('generation_history').insert({ project_id: projectId, user_id: user.id, prompt: body.prompt.trim(), model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, status: 'applying' }).select('id').single();
    if (generation.error || !generation.data) throw new Error(generation.error?.message || 'Could not create generation record.');
    const serializedOperations = result.operations.map((operation) =>
      operation.type === 'create' || operation.type === 'update'
        ? { ...operation, language: operation.language || inferLanguage(operation.path) }
        : operation
    );

    // Attempt RPC first, fallback to direct table updates for resilience
    let appliedViaRpc = false;
    try {
      const { error: rpcError } = await supabase.rpc('apply_ai_generation', {
        p_project_id: projectId,
        p_operations: serializedOperations,
        p_dependencies: result.dependencies ?? [],
      });
      if (!rpcError) appliedViaRpc = true;
    } catch {
      appliedViaRpc = false;
    }

    if (!appliedViaRpc) {
      // Fallback: apply operations directly using Supabase table queries
      for (const op of serializedOperations) {
        if (op.type === 'create' || op.type === 'update') {
          const name = op.path.split('/').pop() || op.path;
          await supabase.from('project_files').upsert(
            {
              project_id: projectId,
              path: op.path,
              name,
              content: op.content,
              language: op.language || inferLanguage(op.path),
              is_folder: false,
            },
            { onConflict: 'project_id,path' }
          );
        } else if (op.type === 'delete') {
          await supabase.from('project_files').delete().eq('project_id', projectId).eq('path', op.path);
        } else if (op.type === 'rename') {
          const name = op.newPath.split('/').pop() || op.newPath;
          await supabase
            .from('project_files')
            .update({ path: op.newPath, name })
            .eq('project_id', projectId)
            .eq('path', op.path);
        }
      }

      if (result.dependencies && result.dependencies.length > 0) {
        for (const dep of result.dependencies) {
          await supabase.from('project_dependencies').upsert(
            {
              project_id: projectId,
              name: dep.name,
              version: dep.version,
            },
            { onConflict: 'project_id,name' }
          );
        }
      }
    }

    // Check if project name should be derived from first build prompt
    const isGenericName = !project.name || ['Untitled Project', 'My AI Project', 'AI Studio Project'].includes(project.name.trim());
    const projectUpdates: { prompt?: string; name?: string; updated_at?: string } = { prompt: body.prompt.trim() };
    if (isGenericName && body.prompt.trim()) {
      const derivedName = deriveProjectName(body.prompt.trim());
      if (derivedName) {
        projectUpdates.name = derivedName;
      }
    }

    await supabase.from('projects').update(projectUpdates).eq('id', projectId);
    await supabase.from('generation_history').update({ status: 'completed' }).eq('id', generation.data.id);

    const { data: updatedFiles, error: reloadError } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
      .order('is_folder', { ascending: false })
      .order('path');
    if (reloadError) throw new Error(reloadError.message);

    return NextResponse.json({
      summary: result.summary,
      operations: result.operations,
      files: updatedFiles,
      dependencies: result.dependencies ?? [],
      projectName: projectUpdates.name || project.name,
    });
  } catch (error) {
    console.error('[Generate Route Error]:', error);
    let status = 500;
    let message = 'Generation failed.';

    if (error instanceof GeminiUnavailableError) {
      status = 503;
      message = error.message;
    } else if (error instanceof GeminiQuotaError) {
      status = 429;
      message = error.message;
    } else if (error instanceof Error) {
      message = error.message;
      if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
        status = (error as { status: number }).status;
      }
    }

    return NextResponse.json(
      { message, error: String(error) },
      { status: typeof status === 'number' && status >= 400 && status < 600 ? status : 500 }
    );
  }
}

function deriveProjectName(prompt: string): string | null {
  const cleaned = prompt.replace(/^(create|build|make|generate|start|design)\s+(a|an|the)?\s*/i, '').trim();
  if (!cleaned) return null;
  const firstSentence = cleaned.split(/[.\n]/)[0].trim();
  const words = firstSentence.split(/\s+/).slice(0, 4);
  if (words.length === 0) return null;
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function inferLanguage(path: string) {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.jsx') || path.endsWith('.js') || path.endsWith('.mjs')) return 'javascript';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.java')) return 'java';
  if (path.endsWith('.cpp') || path.endsWith('.cc') || path.endsWith('.cxx') || path.endsWith('.h') || path.endsWith('.hpp')) return 'cpp';
  if (path.endsWith('.c')) return 'c';
  if (path.endsWith('.go')) return 'go';
  if (path.endsWith('.rs')) return 'rust';
  if (path.endsWith('.css') || path.endsWith('.scss')) return 'css';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html') || path.endsWith('.htm')) return 'html';
  if (path.endsWith('.md') || path.endsWith('.markdown')) return 'markdown';
  if (path.endsWith('.sql')) return 'sql';
  return 'plaintext';
}
