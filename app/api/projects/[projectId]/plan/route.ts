import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { GeminiUnavailableError } from '@/lib/ai/coding-agent';
import { runProductManagerAgent } from '@/lib/ai/product-planner';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as { idea?: string; existingPaths?: string[] };

    if (!body.idea?.trim() || body.idea.length > 8_000) {
      return NextResponse.json(
        { message: 'Provide a product idea under 8,000 characters.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (process.env.NODE_ENV !== 'production' || projectId === 'local-project') {
        const existingPaths = (body.existingPaths ?? ['app/page.tsx', 'app/layout.tsx', 'components/Navbar.tsx']) as string[];
        const plan = await runProductManagerAgent(body.idea.trim(), existingPaths);
        return NextResponse.json({ plan });
      }
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`plan:${user.id}`, 10, 60_000);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          message: `Planning rate limit reached. Please wait ${rateLimit.reset}s before trying again.`,
        },
        { status: 429 }
      );
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ message: 'Project not found.' }, { status: 404 });
    }

    const { data: files } = await supabase
      .from('project_files')
      .select('path')
      .eq('project_id', projectId);

    const existingPaths = (files ?? []).map((f) => f.path);

    const plan = await runProductManagerAgent(body.idea.trim(), existingPaths);

    // Persist plan and tasks to Supabase
    try {
      const { saveProductPlanToDb } = await import('@/lib/db/product');
      await saveProductPlanToDb(supabase, projectId, plan);
    } catch (dbErr) {
      console.warn('Could not persist product plan to DB:', dbErr);
    }

    return NextResponse.json({ plan });
  } catch (error) {
    const status = error instanceof GeminiUnavailableError ? error.status : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Product planning failed.' },
      { status }
    );
  }
}
