import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  DEFAULT_GEMINI_MODEL,
  GeminiUnavailableError,
  runGeminiAgent,
  selectProjectContext,
  validateAgentResult,
} from '@/lib/ai/coding-agent';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const body = await request.json() as { prompt?: string; activePath?: string; selectedCode?: string; previewError?: string };
    if (!body.prompt?.trim() || body.prompt.length > 8_000) return NextResponse.json({ message: 'Provide a prompt under 8,000 characters.' }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });

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
    const proposed = await runGeminiAgent(body.prompt.trim(), selectProjectContext(currentFiles, body.activePath, body.selectedCode, body.previewError));
    const result = validateAgentResult(proposed, currentFiles);
    // Preflight the entire plan before any mutation. The operations below are then executed in order.
    const generation = await supabase.from('generation_history').insert({ project_id: projectId, user_id: user.id, prompt: body.prompt.trim(), model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, status: 'applying' }).select('id').single();
    if (generation.error || !generation.data) throw new Error(generation.error?.message || 'Could not create generation record.');
    const serializedOperations = result.operations.map((operation) => operation.type === 'create' || operation.type === 'update' ? { ...operation, language: operation.language || inferLanguage(operation.path) } : operation);
    const { error: applyError } = await supabase.rpc('apply_ai_generation', { p_project_id: projectId, p_operations: serializedOperations, p_dependencies: result.dependencies ?? [] });
    if (applyError) {
      await supabase.from('generation_history').update({ status: 'failed' }).eq('id', generation.data.id);
      throw new Error(applyError.message);
    }
    await supabase.from('projects').update({ prompt: body.prompt.trim() }).eq('id', projectId);
    await supabase.from('generation_history').update({ status: 'completed' }).eq('id', generation.data.id);
    const { data: updatedFiles, error: reloadError } = await supabase.from('project_files').select('*').eq('project_id', projectId).order('is_folder', { ascending: false }).order('path');
    if (reloadError) throw new Error(reloadError.message);
    return NextResponse.json({ summary: result.summary, operations: result.operations, files: updatedFiles, dependencies: result.dependencies ?? [] });
  } catch (error) {
    const status = error instanceof GeminiUnavailableError ? error.status : 500;
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Generation failed.' }, { status });
  }
}

function inferLanguage(path: string) {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.css')) return 'css'; if (path.endsWith('.json')) return 'json'; if (path.endsWith('.html')) return 'html'; return 'plaintext';
}
