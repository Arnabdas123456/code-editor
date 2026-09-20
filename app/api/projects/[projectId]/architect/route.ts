import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { GeminiUnavailableError } from '@/lib/ai/coding-agent';
import { planTechnicalTask } from '@/lib/ai/task-planner';
import type { DevelopmentTask } from '@/lib/ai/product-planner';
import type { ProjectFile } from '@/lib/types/database';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as {
      task?: DevelopmentTask;
      files?: ProjectFile[];
    };

    if (!body.task || !body.task.title) {
      return NextResponse.json(
        { message: 'Valid development task required.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let projectFiles: ProjectFile[] = body.files ?? [];

    if (user) {
      const rateLimit = checkRateLimit(`architect:${user.id}`, 15, 60_000);
      if (!rateLimit.success) {
        return NextResponse.json(
          { message: `Architect rate limit reached. Please wait ${rateLimit.reset}s.` },
          { status: 429 }
        );
      }

      const { data: dbFiles } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId);

      if (dbFiles && dbFiles.length > 0) {
        projectFiles = dbFiles;
      }
    }

    const plan = await planTechnicalTask(body.task, projectFiles);
    return NextResponse.json({ plan });
  } catch (error) {
    const status = error instanceof GeminiUnavailableError ? error.status : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Architect planning failed.' },
      { status }
    );
  }
}
