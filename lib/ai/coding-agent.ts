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
  constructor(
    message = 'Gemini is temporarily unavailable. The model is experiencing high demand. Retried automatically; please try again shortly.'
  ) {
    super(message);
    this.name = 'GeminiUnavailableError';
  }
}

export class GeminiQuotaError extends Error {
  status = 429;
  constructor(
    message = 'Gemini API quota has been exceeded for the configured API key/project. Check Gemini API usage and billing/quota settings.'
  ) {
    super(message);
    this.name = 'GeminiQuotaError';
  }
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
export const MAX_GEMINI_RETRIES = 3;

const NPM_PACKAGE_NAME_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;

function cleanPath(raw: string): string {
  return raw
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .trim();
}

export function validateAgentResult(input: unknown, existingFiles: ProjectFile[]): AgentResult {
  if (!input || typeof input !== 'object') throw new Error('Gemini returned an invalid response.');
  const result = input as Partial<AgentResult>;
  const summary =
    typeof result.summary === 'string' && result.summary.trim()
      ? result.summary.slice(0, 2000)
      : 'Project files generated successfully.';

  if (!Array.isArray(result.operations)) {
    throw new Error('Gemini response did not include a change plan.');
  }

  // Filter out directory entries and invalid operations
  const rawOps = result.operations.filter(
    (op) =>
      Boolean(
        op &&
        typeof op === 'object' &&
        typeof (op as Record<string, unknown>).path === 'string' &&
        cleanPath((op as Record<string, unknown>).path as string).length > 0 &&
        !((op as Record<string, unknown>).path as string).endsWith('/')
      )
  );

  if (rawOps.length === 0 || rawOps.length > 60) {
    throw new Error('A generation must contain between 1 and 60 file operations.');
  }

  // Check if all paths are wrapped inside an arbitrary top-level directory (e.g. "my-app/package.json")
  let commonPrefix = '';
  const firstPath = cleanPath((rawOps[0] as Record<string, unknown>).path as string);
  const firstSlash = firstPath.indexOf('/');
  if (firstSlash > 0) {
    const candidate = firstPath.slice(0, firstSlash + 1);
    const standardRootFiles = [
      'package.json',
      'tsconfig.json',
      'README.md',
      'next.config.mjs',
      'next.config.ts',
      'next.config.js',
      'vite.config.ts',
      'index.html',
    ];
    if (
      rawOps.every((op) => cleanPath((op as Record<string, unknown>).path as string).startsWith(candidate)) &&
      rawOps.some((op) => standardRootFiles.includes(cleanPath((op as Record<string, unknown>).path as string).slice(candidate.length)))
    ) {
      commonPrefix = candidate;
    }
  }

  const known = new Set(existingFiles.filter((file) => !file.is_folder).map((file) => file.path));
  const opsByPath = new Map<string, FileOperation>();

  for (const operation of rawOps) {
    if (
      !operation ||
      typeof operation !== 'object' ||
      !['create', 'update', 'delete', 'rename'].includes((operation as FileOperation).type)
    ) {
      continue;
    }
    const typed = { ...(operation as FileOperation) };
    let path = cleanPath(typed.path);

    if (commonPrefix && path.startsWith(commonPrefix)) {
      path = path.slice(commonPrefix.length);
    }
    path = cleanPath(path);
    if (!path) continue;

    assertSafePath(path);
    typed.path = path;

    if (typed.type === 'create' || typed.type === 'update') {
      if (typeof typed.content !== 'string') {
        typed.content = '';
      }
      if (typed.content.length > 250_000) {
        throw new Error(`Invalid content length for ${typed.path}.`);
      }
      // Smart healing: adjust create <-> update based on existing files in project
      if (typed.type === 'create' && known.has(typed.path)) {
        typed.type = 'update';
      } else if (typed.type === 'update' && !known.has(typed.path)) {
        typed.type = 'create';
      }
      opsByPath.set(typed.path, typed);
    } else if (typed.type === 'delete') {
      if (known.has(typed.path)) {
        opsByPath.set(typed.path, typed);
      }
    } else if (typed.type === 'rename') {
      const rename = typed as Extract<FileOperation, { type: 'rename' }>;
      if (typeof rename.newPath !== 'string') continue;
      let newPath = cleanPath(rename.newPath);
      if (commonPrefix && newPath.startsWith(commonPrefix)) {
        newPath = newPath.slice(commonPrefix.length);
      }
      newPath = cleanPath(newPath);
      if (!newPath) continue;
      assertSafePath(newPath);
      rename.newPath = newPath;
      if (known.has(rename.path)) {
        opsByPath.set(rename.path, rename);
      }
    }
  }

  const operations = Array.from(opsByPath.values());
  if (operations.length === 0) {
    throw new Error('No valid file operations could be extracted.');
  }

  const dependencies = (result.dependencies ?? [])
    .filter((dep) => Boolean(dep && typeof dep.name === 'string' && NPM_PACKAGE_NAME_REGEX.test(dep.name.trim())))
    .map((dependency) => {
      const version =
        dependency.version && /^[-~^<>=*\w.]+$/.test(dependency.version) ? dependency.version : 'latest';
      return { name: dependency.name.trim(), version };
    });

  return { summary, operations, dependencies };
}

const PATH_PATTERN = /^[a-zA-Z0-9_\-./@]+$/;
const BLOCKED_SEGMENTS = new Set(['..', '.', 'node_modules', '.git', '.env', '.env.local']);

function assertSafePath(path: string) {
  const parts = path.split('/');
  if (!PATH_PATTERN.test(path) || path.startsWith('/') || parts.some((part) => BLOCKED_SEGMENTS.has(part))) {
    throw new Error(`Unsafe project path: ${path}`);
  }
}

export function selectProjectContext(
  files: ProjectFile[],
  activePath?: string,
  selectedCode?: string,
  previewError?: string,
  mode?: 'build' | 'code' | 'debug'
) {
  const sourceFiles = files.filter((file) => !file.is_folder);
  const active = sourceFiles.find((file) => file.path === activePath);

  // In debug mode, prioritize files mentioned in previewError / stack trace
  const errorLower = (previewError || '').toLowerCase();
  const errorMentioned = previewError
    ? sourceFiles.filter((f) => errorLower.includes(f.path.toLowerCase()) || errorLower.includes(f.name.toLowerCase()))
    : [];

  const priority = sourceFiles
    .filter((file) => file.path !== activePath && !errorMentioned.some((em) => em.path === file.path))
    .sort((a, b) => relevance(b.path) - relevance(a.path))
    .slice(0, 10);

  const included = [
    ...errorMentioned,
    ...(active && !errorMentioned.some((em) => em.path === active.path) ? [active] : []),
    ...priority,
  ]
    .slice(0, 12)
    .map((file) => ({ path: file.path, content: file.content.slice(0, 18_000) }));

  return {
    mode: mode || 'code',
    tree: sourceFiles.map((file) => file.path),
    files: included,
    activePath,
    selectedCode: selectedCode?.slice(0, 12_000),
    previewError: previewError?.slice(0, 8_000),
  };
}

function relevance(path: string) {
  return (
    Number(path === 'package.json') * 12 +
    Number(path === 'app/page.tsx' || path === 'src/App.tsx') * 10 +
    Number(path.startsWith('components/')) * 5 +
    Number(path.startsWith('app/')) * 3
  );
}


export async function runGeminiAgent(
  prompt: string,
  context: ReturnType<typeof selectProjectContext>
): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('Gemini is not configured. Add GEMINI_API_KEY to .env.local.');
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  const system = `You are the Coding Agent for Codatron.ai, a professional AI Product Development IDE.

You work INSIDE an existing software project.

Your job is NOT to create a separate project unless the user explicitly asks for a new project.

You must understand the existing project structure before making changes.

Current Operating Mode: ${context.mode.toUpperCase()}

==================================================
CORE RULES
==================================================

1. EXISTING PROJECT FIRST
- Treat the provided project tree and file contents as the current source codebase.
- Preserve existing working architecture.
- Reuse existing components, utilities, APIs, database logic, styles, and configuration whenever possible.
- Do not replace working infrastructure unnecessarily.
- Do not create duplicate versions of existing functionality.
- Do not create a second application, editor, database, or API system.
- Do not invent files that already exist.
- Do not silently migrate the project to another framework.

2. PROJECT-AWARE GENERATION
- Inspect package.json and the provided project tree before generating architecture.
- Identify the actual framework, language, package manager, routing structure, and existing conventions.
- Respect the existing Next.js App Router structure when present.
- Respect existing TypeScript configuration.
- Respect existing Tailwind/shadcn/component conventions.
- Reuse existing dependencies when they already provide the required functionality.

3. SOURCE OF TRUTH
- The project files supplied in the context represent the current project state.
- Generated operations will later be persisted to Supabase project_files.
- Never assume that a file exists unless it appears in the project tree/context.
- Never depend on files that you did not create or that are not already present.

==================================================
1. BUILD MODE
==================================================

When mode = BUILD:

The goal is to create a COMPLETE, runnable implementation of the user's requested product or feature.

BUILD MODE must:

1. Understand the requested product.
2. Inspect the existing project structure.
3. Determine the appropriate architecture.
4. Determine which existing files should be reused.
5. Determine which files must be created.
6. Determine which files must be updated.
7. Determine whether dependencies are actually required.
8. Generate the required implementation as complete files.

For a new Next.js App Router application, when those files do not already exist, consider the required project foundation:

- package.json
- tsconfig.json
- next.config.*
- app/layout.tsx
- app/page.tsx
- app/globals.css
- required components
- required utilities/lib files
- public assets when needed

For Vite/React, use the existing Vite structure when present.

IMPORTANT:

Do NOT blindly generate the entire project if a functioning project already exists.

If the project already contains:

- package.json
- app/
- components/
- lib/
- configuration
- database utilities
- authentication
- existing UI

then MODIFY and EXTEND the existing architecture instead of replacing it.

Every generated file must contain complete implementation code.

Do NOT generate:

- "// TODO"
- "// implement later"
- empty placeholder components
- fake APIs
- fake database implementations
- fake runtime output
- Hello World/demo pages unless explicitly requested.

Build the actual requested product.

==================================================
2. CODE MODE
==================================================

When mode = CODE:

The user wants a specific implementation, feature, refactor, UI change, bug-free enhancement, or code modification.

Rules:

- Preserve existing functionality.
- Modify only files required for the request.
- Reuse existing components and utilities.
- Do not regenerate unrelated files.
- Do not replace the entire application.
- Do not change framework or architecture unless explicitly required.
- Follow existing project conventions.
- Keep imports valid.
- Keep TypeScript types correct.
- Maintain compatibility with existing APIs and database logic.

If the requested feature requires a new dependency:

- add it only when necessary
- return it in the dependencies array
- do not add duplicate packages already present in package.json.

==================================================
3. DEBUG MODE
==================================================

When mode = DEBUG:

The goal is to repair an existing runtime/build/type/import problem.

Analyze:

- runtime error
- stack trace
- preview error
- affected file
- relevant project files
- package.json when dependency/configuration is involved.

Rules:

- Find the smallest correct fix.
- Modify only affected/relevant files.
- Preserve unrelated functionality.
- Do NOT regenerate the whole application.
- Do NOT replace working architecture.
- Do NOT randomly change dependencies.
- Do NOT hide the error with fallback UI.
- Do NOT remove functionality merely to make the error disappear.

If the error is caused by:

Missing import:
→ fix the import or create the genuinely missing module.

Missing dependency:
→ add the required dependency.

Incorrect dependency version:
→ update only when justified.

TypeScript error:
→ fix the underlying type issue.

Runtime error:
→ fix the actual runtime cause.

Framework/configuration error:
→ modify the relevant configuration file.

Preview/dev-server error:
→ investigate the actual error rather than creating fake preview content.

Return targeted UPDATE/CREATE operations.

==================================================
4. FILE OPERATIONS
==================================================

Allowed operations:

CREATE
UPDATE
DELETE
RENAME

CREATE:
Use only when the target file does not exist.

UPDATE:
Use when modifying an existing file.

DELETE:
Use sparingly and only when the file is genuinely unnecessary or explicitly requested.

RENAME:
Use when a file must actually move or be renamed.

Never delete a working file merely because you prefer another architecture.

Never create duplicate files with slightly different names.

==================================================
5. DEPENDENCY RULES
==================================================

Before adding a dependency:

1. Check the project context/package.json.
2. Determine whether the functionality already exists.
3. Reuse existing dependencies when possible.

Only return dependencies that are genuinely required.

Do not add:

- duplicate packages
- unnecessary UI libraries
- random utility libraries
- packages that duplicate existing functionality.

For a dependency change, the runtime system will determine whether installation is required.

==================================================
6. NEXT.JS RULES
==================================================

When working with Next.js:

- Respect App Router conventions.
- Use server components by default.
- Add "use client" only when browser APIs, hooks, state, or event handlers require it.
- Do not use browser-only APIs inside server components.
- Keep server/client boundaries correct.
- Use existing routing/layout structure.
- Preserve existing authentication and database architecture.
- Do not replace Next.js with Vite/CRA.
- Do not create Create React App files in a Next.js project.

==================================================
7. UI GENERATION RULES
==================================================

When generating UI:

- Build the requested product, not a generic dashboard template.
- Make the UI responsive.
- Reuse existing design tokens/components.
- Respect existing shadcn/Tailwind conventions.
- Use semantic HTML.
- Include useful loading, empty, error, and success states where appropriate.
- Keep components modular.
- Avoid excessive monolithic files.
- Do not generate fake interactions that appear functional but do nothing.

If the project already has an established visual system:

PRESERVE IT.

Do not redesign the entire application for a small UI request.

==================================================
8. DATABASE / SUPABASE RULES
==================================================

If Supabase/database code already exists:

- reuse the existing database architecture.
- inspect existing tables/utilities supplied in context.
- do not create duplicate persistence systems.
- do not replace Supabase with another database.
- do not invent database tables unless the requested feature genuinely requires them.
- do not expose service-role secrets to client components.

==================================================
9. RUNTIME-AWARE RULES
==================================================

Codatron uses WebContainer as the primary browser runtime for Node.js/JS/TS projects.

Generated projects must therefore be runnable using their actual project configuration.

Respect:

- package.json
- scripts
- lockfiles
- packageManager
- framework configuration.

For development scripts:

Prefer the project's existing:

scripts.dev

Do not hardcode:

npm run dev

inside generated source code.

Do not generate fake localhost URLs.

Do not generate fake terminal output.

Do not create fake preview implementations.

The runtime manager is responsible for:

- mounting files
- dependency installation
- starting the dev server
- detecting server-ready
- providing the preview URL.

The Coding Agent is responsible for generating a valid project that the runtime can execute.

==================================================
10. IMPORT AND FILE CONSISTENCY
==================================================

Before returning operations, verify mentally that:

- every generated import points to a real file
- every imported symbol exists
- relative paths are correct
- aliases match tsconfig
- client components use "use client" when required
- generated routes match the framework
- configuration files reference valid packages
- package dependencies match imports.

Do not reference files that are not created or present in the supplied project context.

==================================================
11. COMPLETENESS RULE
==================================================

For BUILD mode:

Never intentionally return a partial application when the user requested a complete application.

For CODE mode:

Return only the files necessary for the requested change.

For DEBUG mode:

Return only targeted repairs.

Completeness depends on the mode.

==================================================
12. SECURITY RULES
==================================================

Never generate or expose:

- API secrets
- private keys
- service-role credentials
- passwords
- tokens
- .env contents.

Do not create:

.env
.env.local

with secret values.

Use environment-variable references instead.

Never bypass existing authentication or authorization merely to make functionality work.

==================================================
13. RESPONSE FORMAT
==================================================

Return ONLY valid JSON matching the required schema.

No Markdown.
No explanations outside JSON.
No code fences.

Schema:

{
  "summary": "Concise description of the implementation",
  "operations": [
    {
      "type": "create" | "update" | "delete" | "rename",
      "path": "relative/path/to/file.ext",
      "content": "Complete file content for create/update",
      "newPath": "destination path for rename",
      "language": "typescript | javascript | python | java | cpp | css | json | markdown | html | plaintext"
    }
  ],
  "dependencies": [
    {
      "name": "package-name",
      "version": "version-specifier"
    }
  ]
}

For create/update:

"content" must contain the COMPLETE file.

Never truncate generated files.

Never return placeholder content.

==================================================
FINAL QUALITY CHECK
==================================================

Before returning the JSON:

1. Confirm operations are valid.
2. Confirm paths are safe.
3. Confirm imports are consistent.
4. Confirm dependencies are necessary.
5. Confirm the requested functionality is actually implemented.
6. Confirm existing functionality is preserved.
7. Confirm the operation set is minimal for CODE/DEBUG mode.
8. Confirm BUILD mode produces a complete runnable implementation.
9. Confirm no fake runtime/preview behavior was introduced.
10. Confirm no secrets were generated.

Return the final structured file operations only.`;

  const maxAttempts = MAX_GEMINI_RETRIES + 1;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    temperature: 0.2,
    maxOutputTokens: 65536,
    thinkingConfig: { thinkingBudget: 0 },
    responseSchema: {
      type: 'OBJECT',
      properties: {
        summary: {
          type: 'STRING',
          description: 'Concise description of the implementation',
        },
        operations: {
          type: 'ARRAY',
          description: 'List of file operations to apply',
          items: {
            type: 'OBJECT',
            properties: {
              type: {
                type: 'STRING',
                enum: ['create', 'update', 'delete', 'rename'],
              },
              path: {
                type: 'STRING',
                description: 'Relative file path',
              },
              content: {
                type: 'STRING',
                description: 'Complete file content for create/update',
              },
              newPath: {
                type: 'STRING',
                description: 'Destination file path for rename',
              },
              language: {
                type: 'STRING',
                description: 'File language identifier',
              },
            },
            required: ['type', 'path'],
          },
        },
        dependencies: {
          type: 'ARRAY',
          description: 'Required dependencies',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              version: { type: 'STRING' },
            },
            required: ['name'],
          },
        },
      },
      required: ['summary', 'operations'],
    },
  };

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      {
        role: 'user',
        parts: [{ text: JSON.stringify({ instruction: prompt, project: context }) }],
      },
    ],
    generationConfig,
  });

  let response: Response | undefined;
  let failureText = '';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    console.log(`[Gemini API] Model: ${model}`);
    console.log(`[Gemini API] Attempt: ${attempt + 1}/${maxAttempts}`);

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: requestBody,
      });

      if (response.ok) {
        break;
      }

      failureText = (await response.text()).slice(0, 800);
      console.warn(`[Gemini API] Status: ${response.status}`);

      // Differentiate exhausted quota from temporary rate limiting
      const isQuotaExceeded =
        response.status === 429 &&
        (failureText.toLowerCase().includes('quota') ||
          failureText.toLowerCase().includes('billing') ||
          failureText.toLowerCase().includes('exceeded your current quota'));

      if (isQuotaExceeded) {
        console.error('[Gemini API] Quota exhausted (429):', failureText.slice(0, 300));
        throw new GeminiQuotaError(
          'Gemini API quota has been exceeded for the configured API key/project. Check Gemini API usage and billing/quota settings.'
        );
      }

      const isRetryable = [429, 500, 502, 503, 504].includes(response.status);
      if (!isRetryable || attempt === maxAttempts - 1) {
        break;
      }

      // Controlled exponential backoff with jitter:
      // Attempt 0 -> wait ~1s (+ jitter)
      // Attempt 1 -> wait ~2s (+ jitter)
      // Attempt 2 -> wait ~4s (+ jitter)
      // Attempt 3 -> wait ~8s (+ jitter)
      const retryAfterHeader = Number(response.headers.get('retry-after'));
      const baseDelay = 1000 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * (200 + attempt * 200));
      const delay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : baseDelay + jitter;

      console.log(`[Gemini API] Retrying in ${delay}ms`);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    } catch (err) {
      if (err instanceof GeminiQuotaError) throw err;
      failureText = err instanceof Error ? err.message : 'Network failure';
      if (attempt === maxAttempts - 1) break;
      const baseDelay = 1000 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 300);
      const delay = baseDelay + jitter;
      console.warn(`[Gemini API] Network error: ${failureText}. Retrying in ${delay}ms`);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }

  if (!response?.ok) {
    if (response && [500, 502, 503, 504].includes(response.status)) {
      throw new GeminiUnavailableError(
        'Gemini is temporarily unavailable. The model is experiencing high demand. Retried automatically; please try again shortly.'
      );
    }
    if (response?.status === 429) {
      throw new GeminiQuotaError(
        'Gemini API quota has been exceeded for the configured API key/project. Check Gemini API usage and billing/quota settings.'
      );
    }
    throw new Error(`Gemini request failed (${response?.status ?? 'network'}): ${failureText}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    usageMetadata?: {
      candidatesTokenCount?: number;
      promptTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  const candidate = payload.candidates?.[0];
  if (!candidate) {
    throw new Error('Gemini returned no candidates in response.');
  }

  const finishReason = candidate.finishReason;
  const parts = candidate.content?.parts ?? [];
  const rawText = parts.map((part) => part.text ?? '').join('').trim();

  if (!rawText) {
    throw new Error('Gemini returned an empty response.');
  }

  console.log(`[Gemini API] Request succeeded with model: ${model}`);
  console.log(`[Gemini JSON] Response length: ${rawText.length}, Finish reason: ${finishReason || 'UNKNOWN'}`);

  // Detect truncated JSON
  if (finishReason === 'MAX_TOKENS') {
    console.error(`[Gemini JSON Error] Truncated output detected (finishReason: MAX_TOKENS). Length: ${rawText.length}`);
    throw new Error(
      'Gemini returned an incomplete structured response (token limit reached). No files were saved. Please retry the generation or split the build into smaller batches.'
    );
  }

  // Safe transport normalization: strip surrounding markdown code fences or whitespace without altering inner content
  let cleanedJson = rawText;
  if (cleanedJson.startsWith('```')) {
    const fenceMatch = cleanedJson.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
    if (fenceMatch) {
      cleanedJson = fenceMatch[1].trim();
    } else {
      cleanedJson = cleanedJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedJson);
    console.log('[Gemini JSON] Parsed successfully');
  } catch (parseErr) {
    console.error(`[Gemini JSON Parse Error] Failed to parse response from ${model}:`, parseErr instanceof Error ? parseErr.message : parseErr);
    console.error(`[Gemini JSON Parse Error] Response length: ${rawText.length}, Finish reason: ${finishReason || 'UNKNOWN'}`);
    console.error(`[Gemini JSON Parse Error] First 200 chars: ${rawText.slice(0, 200)}`);
    console.error(`[Gemini JSON Parse Error] Last 200 chars: ${rawText.slice(-200)}`);
    throw new Error('Gemini returned an incomplete structured response. No files were saved. Please retry the generation.');
  }

  return parsed;
}