import type { ProjectFile } from '@/lib/types/database';

export type FileOperation =
  | { type: 'create' | 'update'; path: string; content: string; language?: string }
  | { type: 'delete'; path: string }
  | { type: 'rename'; path: string; newPath: string };

export type AgentResult = {
  summary: string;
  operations: FileOperation[];
  dependencies?: Array<{ name: string; version: string }>;
};

export class GeminiUnavailableError extends Error {
  status = 503;
}

const PATH_PATTERN = /^[a-zA-Z0-9._@()\-/]+$/;
const BLOCKED_SEGMENTS = new Set(['node_modules', '.git', '.next']);
const ALLOWED_DEPENDENCIES = new Set([
  'lucide-react',
  'framer-motion',
  'date-fns',
  'clsx',
  'tailwind-merge',
]);

export function validateAgentResult(input: unknown, existingFiles: ProjectFile[]): AgentResult {
  if (!input || typeof input !== 'object') throw new Error('Gemini returned an invalid response.');
  const result = input as Partial<AgentResult>;
  if (typeof result.summary !== 'string' || !Array.isArray(result.operations)) {
    throw new Error('Gemini response did not include a change plan.');
  }
  if (result.operations.length === 0 || result.operations.length > 30) {
    throw new Error('A generation must contain between 1 and 30 file operations.');
  }
  const known = new Set(existingFiles.filter((file) => !file.is_folder).map((file) => file.path));
  const paths = new Set<string>();
  const operations: FileOperation[] = result.operations.map((operation) => {
    if (!operation || typeof operation !== 'object' || !['create', 'update', 'delete', 'rename'].includes((operation as FileOperation).type)) {
      throw new Error('Gemini proposed an unsupported file operation.');
    }
    const typed = { ...(operation as FileOperation) };
    assertSafePath(typed.path);
    if (typed.type === 'create' || typed.type === 'update') {
      if (typeof typed.content !== 'string' || typed.content.length > 250_000) throw new Error(`Invalid content for ${typed.path}.`);
      // Smart healing: adjust create <-> update based on existing files in project
      if (typed.type === 'create' && known.has(typed.path)) {
        typed.type = 'update';
      } else if (typed.type === 'update' && !known.has(typed.path)) {
        typed.type = 'create';
      }
      if (paths.has(typed.path)) throw new Error(`More than one operation targets ${typed.path}.`);
      paths.add(typed.path);
      return typed;
    }
    if (typed.type === 'delete') {
      if (!known.has(typed.path)) throw new Error(`Cannot delete missing file ${typed.path}.`);
      if (paths.has(typed.path)) throw new Error(`More than one operation targets ${typed.path}.`);
      paths.add(typed.path);
      return typed;
    }
    const rename = typed as Extract<FileOperation, { type: 'rename' }>;
    if (typeof rename.newPath !== 'string') throw new Error(`Missing destination for ${rename.path}.`);
    assertSafePath(rename.newPath);
    if (!known.has(rename.path) || known.has(rename.newPath)) throw new Error(`Invalid rename from ${rename.path} to ${rename.newPath}.`);
    if (paths.has(rename.path) || paths.has(rename.newPath)) throw new Error(`More than one operation targets ${rename.path}.`);
    paths.add(rename.path); paths.add(rename.newPath);
    return rename;
  });
  const dependencies = (result.dependencies ?? []).map((dependency) => {
    if (!dependency || !ALLOWED_DEPENDENCIES.has(dependency.name) || !/^[-~^<>=*\w.]+$/.test(dependency.version)) {
      throw new Error('Gemini requested a dependency that is not approved for the preview runtime.');
    }
    return { name: dependency.name, version: dependency.version };
  });
  return { summary: result.summary.slice(0, 2000), operations, dependencies };
}

function assertSafePath(path: string) {
  if (!PATH_PATTERN.test(path) || path.startsWith('/') || path.includes('..') || path.split('/').some((part) => BLOCKED_SEGMENTS.has(part))) {
    throw new Error(`Unsafe project path: ${path}`);
  }
}

export function selectProjectContext(files: ProjectFile[], activePath?: string, selectedCode?: string, previewError?: string) {
  const sourceFiles = files.filter((file) => !file.is_folder);
  const active = sourceFiles.find((file) => file.path === activePath);
  const priority = sourceFiles
    .filter((file) => file.path !== activePath)
    .sort((a, b) => relevance(b.path) - relevance(a.path))
    .slice(0, 10);
  const included = [...(active ? [active] : []), ...priority].slice(0, 11).map((file) => ({ path: file.path, content: file.content.slice(0, 18_000) }));
  return { tree: sourceFiles.map((file) => file.path), files: included, activePath, selectedCode: selectedCode?.slice(0, 12_000), previewError: previewError?.slice(0, 8_000) };
}

function relevance(path: string) {
  return Number(path === 'app/page.tsx') * 10 + Number(path.startsWith('components/')) * 5 + Number(path.startsWith('app/')) * 3;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export async function runGeminiAgent(prompt: string, context: ReturnType<typeof selectProjectContext>): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('Gemini is not configured. Add GEMINI_API_KEY to .env.local.');
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const system = `You are an expert Next.js & React AI software engineer for a full-stack web application.
Your goal is to fulfill the user's request with high-quality, production-ready, modular code.

Analyze the user's request and the existing project tree:
1. When asked to build a feature, dashboard, page, or application, ALWAYS decompose it into a complete, modular structure:
   - Create distinct subcomponents in appropriate folders (e.g. components/dashboard/sidebar.tsx, components/dashboard/header.tsx, components/dashboard/stat-card.tsx, components/dashboard/chart.tsx, etc.).
   - Create or update the main page (e.g. app/page.tsx or app/dashboard/page.tsx) and layouts as needed.
   - Create helper/data/lib files if state or mock data is needed.
   - NEVER generate just 1-2 partial files when a complete feature or application was requested.
2. Operations:
   - Use 'create' for new files.
   - Use 'update' for existing files that need modifications (such as updating app/page.tsx to import and assemble new components).
   - Use 'delete' only when explicitly requested.
   - Use 'rename' only when explicitly requested.
   - Do NOT overwrite unrelated existing files.
3. Code quality & styling:
   - Write modern React 19 + TypeScript code with 'use client' directives at the top of client components.
   - Use Tailwind CSS utility classes for styling.
   - Use icons from 'lucide-react'.
   - Ensure imports resolve cleanly (use relative imports like '../components/...' or '@/' aliases).

Return ONLY valid JSON matching this schema:
{
  "summary": "Concise summary of architecture and files created/updated",
  "operations": [
    {
      "type": "create" | "update" | "delete" | "rename",
      "path": "relative/path/to/file.tsx",
      "content": "Full, complete file content (never truncated or commented out)",
      "newPath": "optional new path for rename",
      "language": "typescript" | "css" | "json"
    }
  ],
  "dependencies": [
    { "name": "lucide-react" | "framer-motion" | "date-fns" | "clsx" | "tailwind-merge", "version": "semver" }
  ]
}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify({ instruction: prompt, project: context }) }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } });
  let response: Response | undefined;
  let failure = '';
  // Gemini documents 429/503 as transient; retrying avoids failing a generation
  // merely because a model is momentarily at capacity.
  for (let attempt = 0; attempt < 4; attempt += 1) {
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
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) break;
    const retryAfter = Number(response.headers.get('retry-after'));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 700 * 2 ** attempt + Math.floor(Math.random() * 250);
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
  if (!response?.ok) {
    const message = `Gemini request failed (${response?.status ?? 'network'}): ${failure}`;
    if (response && [429, 500, 502, 503, 504].includes(response.status)) throw new GeminiUnavailableError('Gemini is temporarily busy. Please try again in a moment.');
    throw new Error(message);
  }
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini returned no code changes.');
  try { return JSON.parse(text); } catch { throw new Error('Gemini returned malformed JSON.'); }
}
