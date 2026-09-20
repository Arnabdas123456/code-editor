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
const ALLOWED_DEPENDENCIES = new Set(['lucide-react', 'framer-motion', 'date-fns']);

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
    const typed = operation as FileOperation;
    assertSafePath(typed.path);
    if (typed.type === 'create' || typed.type === 'update') {
      if (typeof typed.content !== 'string' || typed.content.length > 250_000) throw new Error(`Invalid content for ${typed.path}.`);
      if (typed.type === 'update' && !known.has(typed.path)) throw new Error(`Cannot update missing file ${typed.path}.`);
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
  const system = `You are a careful coding agent for a persisted Next.js-style project. Return ONLY JSON matching this schema: {"summary":"string","operations":[{"type":"create|update|delete|rename","path":"relative/path", "content":"required for create/update", "newPath":"required for rename", "language":"optional"}],"dependencies":[{"name":"lucide-react|framer-motion|date-fns","version":"semver"}]}. Make minimal targeted changes. Never use shell commands, secrets, binary files, node_modules, or paths containing .. . For generated UI, keep the preview compatible with React/Sandpack: do not import next/*, use relative imports, and use CSS or inline styles rather than Tailwind unless the existing project already supports it.`;
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
