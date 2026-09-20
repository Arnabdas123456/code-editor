import { DEFAULT_GEMINI_MODEL, GeminiUnavailableError } from './coding-agent';
import type { DevelopmentTask } from './product-planner';
import type { ProjectFile } from '@/lib/types/database';

export interface TechnicalImplementationPlan {
  architectureOverview: string;
  filesToCreate: string[];
  filesToUpdate: string[];
  technicalSteps: string[];
  codingAgentPrompt: string;
}

/**
 * Technical Planner / Architect Agent.
 * Bridges high-level Product Manager development tasks into concrete,
 * architected technical specifications and instructions for the Coding Agent.
 */
export async function planTechnicalTask(
  task: DevelopmentTask,
  existingFiles: ProjectFile[]
): Promise<TechnicalImplementationPlan> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('Gemini is not configured. Add GEMINI_API_KEY to .env.');
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  const fileTree = existingFiles.map((f) => f.path);
  const relevantFiles = existingFiles
    .filter((f) => !f.is_folder && (task.affectedFiles.includes(f.path) || f.path === 'app/page.tsx' || f.path.startsWith('components/')))
    .slice(0, 8)
    .map((f) => ({ path: f.path, content: f.content.slice(0, 6000) }));

  const system = `You are an elite Principal Software Architect for Next.js and React applications.
Your job is to take a Product Development Task and translate it into a concrete, rigorous Technical Implementation Plan for a Coding Agent.

You must:
1. Deconstruct the feature into modular, maintainable Next.js/React components and utilities.
2. Identify all new files that must be CREATED (e.g. distinct UI components, data utilities, hooks).
3. Identify existing files that must be UPDATED (e.g. app/page.tsx, components/navbar.tsx) to integrate the new feature.
4. Formulate an exhaustive, highly specific "codingAgentPrompt" that instructs the Coding Agent on exact component props, Tailwind styling, Lucide icons, state management, and assembly so that it generates all required modular files.

Return ONLY JSON matching this schema:
{
  "architectureOverview": "string",
  "filesToCreate": ["string"],
  "filesToUpdate": ["string"],
  "technicalSteps": ["string"],
  "codingAgentPrompt": "Comprehensive prompt detailing components to create, exact props, styling, logic, and how to assemble them in the page"
}`;

  const userContent = JSON.stringify({
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      affectedFiles: task.affectedFiles,
      acceptanceCriteria: task.acceptanceCriteria,
    },
    projectContext: {
      allFiles: fileTree,
      relevantSnippets: relevantFiles,
    },
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  });

  let response: Response | undefined;
  let failure = '';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body,
    });
    if (response.ok) break;
    failure = (await response.text()).slice(0, 500);
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
    const delay = 800 * 2 ** attempt + Math.floor(Math.random() * 200);
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }

  if (!response?.ok) {
    if (response && [429, 500, 502, 503, 504].includes(response.status)) {
      throw new GeminiUnavailableError('Gemini Architect is temporarily busy. Please retry.');
    }
    // Fallback if Gemini fails
    return {
      architectureOverview: `Implementation plan for ${task.title}`,
      filesToCreate: task.affectedFiles.filter((p) => !fileTree.includes(p)),
      filesToUpdate: task.affectedFiles.filter((p) => fileTree.includes(p)),
      technicalSteps: task.acceptanceCriteria,
      codingAgentPrompt: `Build feature: ${task.title}\n\nDescription: ${task.description}\n\nAffected files: ${task.affectedFiles.join(', ')}\n\nAcceptance criteria:\n${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`,
    };
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

  try {
    const parsed = JSON.parse(text) as TechnicalImplementationPlan;
    return parsed;
  } catch {
    return {
      architectureOverview: `Implementation plan for ${task.title}`,
      filesToCreate: task.affectedFiles.filter((p) => !fileTree.includes(p)),
      filesToUpdate: task.affectedFiles.filter((p) => fileTree.includes(p)),
      technicalSteps: task.acceptanceCriteria,
      codingAgentPrompt: `Build feature: ${task.title}\n\nDescription: ${task.description}\n\nAffected files: ${task.affectedFiles.join(', ')}\n\nAcceptance criteria:\n${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`,
    };
  }
}
