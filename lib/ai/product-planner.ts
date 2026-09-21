import { DEFAULT_GEMINI_MODEL, GeminiUnavailableError } from './coding-agent';

export interface DevelopmentTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  type: string;
  category?: 'frontend' | 'backend' | 'component' | 'styling' | 'state';
  status: 'todo' | 'in-progress' | 'completed';
  requirements: string;
  acceptanceCriteria: string[];
  technicalPlan: {
    overview?: string;
    filesToCreate?: string[];
    filesToUpdate?: string[];
    steps?: string[];
  };
  affectedFiles: string[];
  dependencies: string[];
}

export interface ProductPlan {
  overview?: {
    summary: string;
    targetAudience: string;
    keyDifferentiator: string;
  };
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
  acceptanceCriteria: string[];
  roadmap: Array<{
    milestone: string;
    description: string;
    targetWeek?: string;
  }>;
  developmentTasks: DevelopmentTask[];
  requirements: {
    functional: string[];
    nonFunctional: string[];
  };
  research: {
    marketAnalysis: string;
    competitiveBenchmarks: string[];
    userInsights: string[];
  };
}

export async function runProductManagerAgent(
  idea: string,
  existingFilePaths: string[]
): Promise<ProductPlan> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('Gemini is not configured. Add GEMINI_API_KEY to .env.');
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  const system = `You are a Principal AI Product Manager and Systems Architect.
Analyze the user's product idea and existing project files, and return a comprehensive, structured product development specification covering all 11 core product planning areas.

Return ONLY JSON adhering strictly to this schema:
{
  "overview": {
    "summary": "Executive summary of the product",
    "targetAudience": "Primary audience description",
    "keyDifferentiator": "Core competitive edge"
  },
  "vision": {
    "purpose": "Why this product exists",
    "valueProposition": "Value delivered to users",
    "targetOutcome": "Success metrics and outcomes"
  },
  "personas": [
    { "role": "Role title", "needs": "Key user needs", "painPoints": "Current frustrations" }
  ],
  "mvp": {
    "mustHave": ["Essential MVP feature 1", "Essential MVP feature 2"],
    "exclusions": ["Deferred to v2 feature 1", "Deferred to v2 feature 2"]
  },
  "features": [
    { "id": "feat-1", "title": "Feature Name", "priority": "high|medium|low", "description": "Detailed description" }
  ],
  "userStories": [
    {
      "id": "us-1",
      "asA": "Target user",
      "iWant": "Capability needed",
      "soThat": "Benefit realized",
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"]
    }
  ],
  "acceptanceCriteria": [
    "System-wide criterion 1",
    "System-wide criterion 2"
  ],
  "roadmap": [
    { "milestone": "Phase 1: Foundation", "description": "Core setup & MVP features", "targetWeek": "Week 1-2" }
  ],
  "developmentTasks": [
    {
      "id": "task-1",
      "title": "Task title",
      "description": "Concrete technical description of components, logic, and layout to build",
      "priority": "high|medium|low",
      "type": "component|frontend|backend|styling|state",
      "category": "component|frontend|backend|styling|state",
      "status": "todo",
      "requirements": "Detailed functional requirements for this task",
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
      "technicalPlan": {
        "overview": "Technical architecture outline",
        "filesToCreate": ["components/Feature.tsx"],
        "filesToUpdate": ["app/page.tsx"],
        "steps": ["Step 1", "Step 2"]
      },
      "affectedFiles": ["app/page.tsx", "components/Feature.tsx"],
      "dependencies": ["lucide-react"]
    }
  ],
  "requirements": {
    "functional": ["Functional requirement 1", "Functional requirement 2"],
    "nonFunctional": ["Performance / responsiveness requirement", "Accessibility requirement"]
  },
  "research": {
    "marketAnalysis": "Overview of market opportunity and trends",
    "competitiveBenchmarks": ["Benchmark 1 against leading solutions", "Benchmark 2"],
    "userInsights": ["Insight 1 from user feedback patterns", "Insight 2"]
  }
}
Make development tasks modular, actionable, and ready to dispatch to the Coding Agent.`;

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
