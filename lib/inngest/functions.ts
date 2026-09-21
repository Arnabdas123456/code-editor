import { inngest } from './client';
import { createClient } from '../server';
import { runGeminiAgent, selectProjectContext, validateAgentResult } from '../ai/coding-agent';
import { indexProjectFiles, retrieveContextForPrompt } from '../ai/rag';
import type { ProjectFile } from '../types/database';

export const buildFeatureWorkflow = inngest.createFunction(
  {
    id: 'build-feature-workflow',
    name: 'Autonomous Feature Build',
    triggers: [{ event: 'project/feature.build' }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { projectId, taskId, featureTitle, requirements } = event.data;

    // Step 1: Fetch Project Context & Files
    const projectData = await step.run('fetch-project-data', async () => {
      const supabase = await createClient();
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      const { data: files } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId);

      return {
        project,
        files: (files || []) as ProjectFile[],
      };
    });

    // Step 2: Retrieve Relevant RAG Context
    const ragContext = await step.run('retrieve-rag-context', async () => {
      const supabase = await createClient();
      const prompt = `${featureTitle}: ${requirements || ''}`;
      return await retrieveContextForPrompt(supabase, projectId, prompt, 4);
    });

    // Step 3: Execute AI Coding Agent
    const agentResult = await step.run('generate-code-changes', async () => {
      const prompt = `Build feature: ${featureTitle}.\nRequirements: ${requirements || 'Standard production implementation'}.\nRelevant context snippets:\n${ragContext.map((c: any) => `--- ${c.filePath} ---\n${c.content}`).join('\n\n')}`;
      const context = selectProjectContext(projectData.files);
      const raw = await runGeminiAgent(prompt, context);
      return validateAgentResult(raw, projectData.files);
    });

    // Step 4: Persist Changes to Supabase
    const persistResult = await step.run('persist-changes', async () => {
      const supabase = await createClient();
      const now = new Date().toISOString();

      for (const op of agentResult.operations) {
        if (op.type === 'create' || op.type === 'update') {
          await supabase.from('project_files').upsert(
            {
              project_id: projectId,
              path: op.path,
              name: op.path.split('/').pop() || op.path,
              content: op.content,
              language: op.language || 'typescript',
              is_folder: false,
              updated_at: now,
            },
            { onConflict: 'project_id,path' }
          );
        } else if (op.type === 'delete') {
          await supabase
            .from('project_files')
            .delete()
            .eq('project_id', projectId)
            .eq('path', op.path);
        }
      }

      if (taskId) {
        await supabase
          .from('product_tasks')
          .update({ status: 'completed', updated_at: now })
          .eq('id', taskId);
      }

      return { applied: agentResult.operations.length, summary: agentResult.summary };
    });

    // Step 5: Refresh RAG Index in Background
    await step.run('refresh-rag-index', async () => {
      const supabase = await createClient();
      const { data: updatedFiles } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId);

      if (updatedFiles) {
        await indexProjectFiles(supabase, projectId, updatedFiles as ProjectFile[]);
      }
    });

    return {
      success: true,
      summary: persistResult.summary,
      operationsCount: persistResult.applied,
    };
  }
);
