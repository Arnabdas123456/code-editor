import { DEFAULT_GEMINI_MODEL, GeminiUnavailableError } from './coding-agent';

export interface DevelopmentTask {
  id: string;
  title: string;
  description: string;
  category: 'frontend' | 'backend' | 'component' | 'styling' | 'state';
  affectedFiles: string[];
  acceptanceCriteria: string[];
  status: 'todo' | 'in-progress' | 'completed';
}

export interface ProductPlan {

  vision: {
    purpose: string;
    valueProposition: string;
    targetOutcome: string;
  };
  personas: Array<{
    role: string;
    needs: string;
    painPoints: string;
  }>;
  mvp: {
    mustHave: string[];
    exclusions: string[];
  };
  features: Array<{
    id: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
  }>;
  userStories: Array<{
    id: string;
    asA: string;
    iWant: string;
    soThat: string;
    acceptanceCriteria: string[];
  }>;
  roadmap: Array<{
    milestone: string;
    description: string;
    targetWeek?: string;
  }>;
  developmentTasks: DevelopmentTask[];
}

export async function runProductManagerAgent(
  idea: string,
  existingFilePaths: string[]
): Promise<ProductPlan> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('Gemini is not configured. Add GEMINI_API_KEY to .env.');
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  const system = `You are an elite AI Product Manager and Software Architect.
Analyze the user's product idea and existing project files, and return a comprehensive, structured product development plan.
Return ONLY JSON adhering strictly to this schema:
{
  "vision": {
    "purpose": "string",
    "valueProposition": "string",
    "targetOutcome": "string"
  },
  "personas": [
    { "role": "string", "needs": "string", "painPoints": "string" }
  ],
  "mvp": {
    "mustHave": ["string"],
    "exclusions": ["string"]
  },
  "features": [
    { "id": "feat-1", "title": "string", "priority": "high|medium|low", "description": "string" }
  ],
  "userStories": [
    {
      "id": "us-1",
      "asA": "string",
      "iWant": "string",
      "soThat": "string",
      "acceptanceCriteria": ["string"]
    }
  ],
  "roadmap": [
    { "milestone": "string", "description": "string", "targetWeek": "string" }
  ],
  "developmentTasks": [
    {
      "id": "task-1",
      "title": "Short actionable task title",
      "description": "Specific instruction on what components to build, styling to apply, or logic to add",
      "category": "frontend|backend|component|styling|state",
      "affectedFiles": ["app/page.tsx", "components/Feature.tsx"],
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
      "status": "todo"
    }
  ]
}
Make development tasks concrete, modular, and directly executable by a Next.js/React coding agent.
Ensure affectedFiles correspond to logical Next.js project paths (e.g. app/page.tsx, components/Navbar.tsx, components/Pricing.tsx, etc.).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: JSON.stringify({
              productIdea: idea,
              existingFiles: existingFilePaths,
            }),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
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
      throw new GeminiUnavailableError('Gemini is temporarily busy. Please retry.');
    }
    throw new Error(`Gemini product planning failed: ${failure || response?.statusText}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini returned empty product plan.');

  try {
    const plan = JSON.parse(text) as ProductPlan;
    // Basic structural validation
    if (!plan.vision || !Array.isArray(plan.features) || !Array.isArray(plan.developmentTasks)) {
      throw new Error('Gemini product plan structure was incomplete.');
    }
    return plan;
  } catch (err) {
    throw new Error(`Failed to parse product plan: ${err instanceof Error ? err.message : String(err)}`);
  }
}
