import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, DbProductPlan, DbProductTask, DbAgentRun } from '../types/database';
import type { ProductPlan, DevelopmentTask } from '../ai/product-planner';

export async function getProductPlanFromDb(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<{ plan: ProductPlan | null; tasks: DevelopmentTask[]; error: Error | null }> {
  try {
    const { data: planRow, error: planErr } = await supabase
      .from('product_plans')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (planErr) {
      return { plan: null, tasks: [], error: new Error(planErr.message) };
    }

    if (!planRow) {
      return { plan: null, tasks: [], error: null };
    }

    const { data: taskRows, error: taskErr } = await supabase
      .from('product_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (taskErr) {
      return { plan: null, tasks: [], error: new Error(taskErr.message) };
    }

    const tasks: DevelopmentTask[] = (taskRows || []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      type: (t.type as string) || 'component',
      category: (t.type as any) || 'component',
      priority: (t.priority as any) || 'medium',
      status: (t.status as any) || 'todo',
      requirements: t.requirements || '',
      acceptanceCriteria: Array.isArray(t.acceptance_criteria) ? (t.acceptance_criteria as string[]) : [],
      technicalPlan: (t.technical_plan as any) || {},
      affectedFiles: Array.isArray(t.affected_files) ? (t.affected_files as string[]) : [],
      dependencies: Array.isArray(t.dependencies) ? (t.dependencies as string[]) : [],
    }));

    const fullPlan: ProductPlan = {
      overview: (planRow as any).overview || { summary: '', targetAudience: '', keyDifferentiator: '' },
      vision: planRow.vision as any,
      personas: planRow.personas as any,
      mvp: planRow.mvp as any,
      features: planRow.features as any,
      userStories: (planRow as any).user_stories || [],
      acceptanceCriteria: (planRow as any).acceptance_criteria || [],
      roadmap: planRow.roadmap as any,
      developmentTasks: tasks,
      requirements: (planRow as any).requirements || { functional: [], nonFunctional: [] },
      research: (planRow as any).research || { marketAnalysis: '', competitiveBenchmarks: [], userInsights: [] },
    };

    return { plan: fullPlan, tasks, error: null };
  } catch (err) {
    return { plan: null, tasks: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function saveProductPlanToDb(
  supabase: SupabaseClient<Database>,
  projectId: string,
  plan: ProductPlan
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: savedPlan, error: planErr } = await supabase
      .from('product_plans')
      .upsert(
        {
          project_id: projectId,
          vision: plan.vision as any,
          personas: plan.personas as any,
          mvp: plan.mvp as any,
          features: plan.features as any,
          roadmap: plan.roadmap as any,
        },
        { onConflict: 'project_id' }
      )
      .select('id')
      .single();

    if (planErr || !savedPlan) {
      return { success: false, error: new Error(planErr?.message || 'Could not save product plan') };
    }

    // Upsert development tasks
    if (plan.developmentTasks && plan.developmentTasks.length > 0) {
      const taskPayloads = plan.developmentTasks.map((t) => ({
        project_id: projectId,
        product_plan_id: savedPlan.id,
        title: t.title,
        description: t.description,
        type: t.category,
        priority: t.priority || 'medium',
        status: t.status || 'todo',
        requirements: t.requirements || null,
        acceptance_criteria: t.acceptanceCriteria as any,
        technical_plan: (t.technicalPlan || {}) as any,
        affected_files: (t.affectedFiles || []) as any,
        dependencies: (t.dependencies || []) as any,
      }));

      await supabase.from('product_tasks').upsert(taskPayloads);
    }

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function recordAgentRunInDb(
  supabase: SupabaseClient<Database>,
  run: {
    projectId: string;
    taskId?: string;
    agentType: string;
    status: 'running' | 'completed' | 'failed';
    currentStep?: string;
    input?: unknown;
    output?: unknown;
    error?: string;
  }
): Promise<{ id: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('agent_runs')
      .insert({
        project_id: run.projectId,
        task_id: run.taskId || null,
        agent_type: run.agentType,
        status: run.status,
        current_step: run.currentStep || null,
        input: (run.input || {}) as any,
        output: (run.output || {}) as any,
        error: run.error || null,
      })
      .select('id')
      .single();

    if (error) return { id: null, error: new Error(error.message) };
    return { id: data.id, error: null };
  } catch (err) {
    return { id: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
