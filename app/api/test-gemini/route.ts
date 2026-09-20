import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import {
    runGeminiAgent,
    selectProjectContext,
    validateAgentResult,
} from "@/lib/ai/coding-agent";
import type { ProjectFile } from "@/lib/types/database";

export const runtime = "nodejs";

export async function GET() {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
            { success: false, error: "Test endpoint is disabled in production." },
            { status: 403 }
        );
    }

    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Authentication required to access test endpoint." },
                { status: 401 }
            );
        }
        const now = new Date().toISOString();
        // Fake existing project files
        const existingFiles: ProjectFile[] = [
            {
                id: "1",
                project_id: "test",
                name: "page.tsx",
                path: "app/page.tsx",
                content: `export default function Home() {
  return <h1>Hello</h1>;
}`,
                language: "typescript",
                is_folder: false,
                created_at: now,
                updated_at: now,
            },
            {
                id: "2",
                project_id: "test",
                name: "globals.css",
                path: "app/globals.css",
                content: `body {
  margin: 0;
}`,
                language: "css",
                is_folder: false,
                created_at: now,
                updated_at: now,
            },
        ];

        const context = selectProjectContext(
            existingFiles,
            "app/page.tsx"
        );

        console.log("Calling runGeminiAgent...");

        const proposed = await runGeminiAgent(
            `
Create a very simple SaaS landing page.

Update:
- app/page.tsx
- app/globals.css

Requirements:
- Navbar
- Hero section
- 3 feature cards
- Footer

IMPORTANT:
The preview is React/Sandpack.
Do NOT use next/link.
Do NOT use next/router.
Do NOT use any next/* import.
Do NOT use Tailwind CSS.
Use normal CSS classes defined in globals.css.
      `,
            context
        );

        console.log("Gemini result:", proposed);

        const validated = validateAgentResult(
            proposed,
            existingFiles
        );

        console.log("Validation successful:", validated);

        return NextResponse.json({
            success: true,
            message: "Gemini agent + validation working",
            result: validated,
        });
    } catch (error) {
        console.error("AGENT TEST ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
            { status: 500 }
        );
    }
}