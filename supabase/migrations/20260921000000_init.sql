-- ==============================================================================
-- AI Code Editor - Supabase Database Schema
-- ==============================================================================
-- This script sets up tables, constraints, indexes, triggers, and Row Level
-- Security (RLS) policies for the AI Code Editor platform.
--
-- Instructions: Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor).
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Profiles Table (Linked 1-to-1 with auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Projects Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    prompt TEXT,
    framework TEXT NOT NULL DEFAULT 'nextjs',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Project Files Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'typescript',
    is_folder BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_project_file_path UNIQUE (project_id, path)
);

-- ------------------------------------------------------------------------------
-- 4. Generation History Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approved dependencies are persisted separately; AI never executes shell commands.
CREATE TABLE IF NOT EXISTS public.project_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_project_dependency UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_project_dependencies_project_id ON public.project_dependencies(project_id);

-- ------------------------------------------------------------------------------
-- Indexes for High Performance Querying
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_path ON public.project_files(project_id, path);
CREATE INDEX IF NOT EXISTS idx_generation_history_project_id ON public.generation_history(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_user_id ON public.generation_history(user_id);

-- ------------------------------------------------------------------------------
-- Triggers: Auto-update updated_at timestamp
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_project_files_updated_at ON public.project_files;
CREATE TRIGGER set_project_files_updated_at
BEFORE UPDATE ON public.project_files
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- Trigger: Auto-create Profile on Auth Signup
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for users that existed before this schema was installed
INSERT INTO public.profiles (id, email, full_name, avatar_url)
SELECT
    id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
    COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture', NULL)
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_dependencies ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Projects Policies
DROP POLICY IF EXISTS "Users can view own or public projects" ON public.projects;
CREATE POLICY "Users can view own or public projects"
    ON public.projects FOR SELECT
    USING (auth.uid() = user_id OR is_public = TRUE);

DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects"
    ON public.projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects"
    ON public.projects FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects"
    ON public.projects FOR DELETE
    USING (auth.uid() = user_id);

-- Project Files Policies
DROP POLICY IF EXISTS "Users can view project files for accessible projects" ON public.project_files;
CREATE POLICY "Users can view project files for accessible projects"
    ON public.project_files FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_files.project_id
            AND (p.user_id = auth.uid() OR p.is_public = TRUE)
        )
    );

DROP POLICY IF EXISTS "Users can insert project files for own projects" ON public.project_files;
CREATE POLICY "Users can insert project files for own projects"
    ON public.project_files FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_files.project_id
            AND p.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update project files for own projects" ON public.project_files;
CREATE POLICY "Users can update project files for own projects"
    ON public.project_files FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_files.project_id
            AND p.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete project files for own projects" ON public.project_files;
CREATE POLICY "Users can delete project files for own projects"
    ON public.project_files FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_files.project_id
            AND p.user_id = auth.uid()
        )
    );

-- Generation History Policies
DROP POLICY IF EXISTS "Users can view own generation history" ON public.generation_history;
CREATE POLICY "Users can view own generation history"
    ON public.generation_history FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own generation history" ON public.generation_history;
CREATE POLICY "Users can insert own generation history"
    ON public.generation_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage dependencies for own projects" ON public.project_dependencies;
CREATE POLICY "Users can manage dependencies for own projects"
    ON public.project_dependencies FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_dependencies.project_id AND p.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_dependencies.project_id AND p.user_id = auth.uid()));

-- Apply a validated generation as one PostgreSQL transaction. Validation and
-- ownership are also repeated in the Route Handler before calling this RPC.
CREATE OR REPLACE FUNCTION public.apply_ai_generation(
    p_project_id UUID,
    p_operations JSONB,
    p_dependencies JSONB DEFAULT '[]'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE operation JSONB; dependency JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Project not found or access denied';
    END IF;
    FOR operation IN SELECT * FROM jsonb_array_elements(p_operations) LOOP
        CASE operation->>'type'
            WHEN 'create', 'update' THEN
                INSERT INTO project_files (project_id, path, name, content, language, is_folder)
                VALUES (p_project_id, operation->>'path', split_part(operation->>'path', '/', array_length(string_to_array(operation->>'path', '/'), 1)), operation->>'content', COALESCE(operation->>'language', 'plaintext'), FALSE)
                ON CONFLICT (project_id, path) DO UPDATE SET content = EXCLUDED.content, language = EXCLUDED.language, name = EXCLUDED.name;
            WHEN 'delete' THEN
                DELETE FROM project_files WHERE project_id = p_project_id AND path = operation->>'path';
            WHEN 'rename' THEN
                UPDATE project_files SET path = operation->>'newPath', name = split_part(operation->>'newPath', '/', array_length(string_to_array(operation->>'newPath', '/'), 1))
                WHERE project_id = p_project_id AND path = operation->>'path';
            ELSE RAISE EXCEPTION 'Unsupported generation operation';
        END CASE;
    END LOOP;
    FOR dependency IN SELECT * FROM jsonb_array_elements(p_dependencies) LOOP
        INSERT INTO project_dependencies (project_id, name, version) VALUES (p_project_id, dependency->>'name', dependency->>'version')
        ON CONFLICT (project_id, name) DO UPDATE SET version = EXCLUDED.version;
    END LOOP;
    UPDATE projects SET updated_at = NOW() WHERE id = p_project_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Product Plans Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    vision JSONB NOT NULL DEFAULT '{}'::jsonb,
    personas JSONB NOT NULL DEFAULT '[]'::jsonb,
    mvp JSONB NOT NULL DEFAULT '{}'::jsonb,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    roadmap JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_project_product_plan UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_product_plans_project_id ON public.product_plans(project_id);

-- ------------------------------------------------------------------------------
-- 6. Product Tasks Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    product_plan_id UUID REFERENCES public.product_plans(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'component',
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'todo',
    requirements TEXT,
    acceptance_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    technical_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
    affected_files JSONB NOT NULL DEFAULT '[]'::jsonb,
    dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_tasks_project_id ON public.product_tasks(project_id);

-- ------------------------------------------------------------------------------
-- 7. Agent Runs Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.product_tasks(id) ON DELETE SET NULL,
    agent_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    current_step TEXT,
    input JSONB NOT NULL DEFAULT '{}'::jsonb,
    output JSONB,
    error TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_project_id ON public.agent_runs(project_id);

-- ------------------------------------------------------------------------------
-- 8. Project Embeddings Table (for RAG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    file_id UUID REFERENCES public.project_files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    embedding JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_embeddings_project_id ON public.project_embeddings(project_id);

-- Enable RLS on new tables
ALTER TABLE public.product_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for new tables
DROP POLICY IF EXISTS "Users can manage product plans for own projects" ON public.product_plans;
CREATE POLICY "Users can manage product plans for own projects"
    ON public.product_plans FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = product_plans.project_id AND p.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = product_plans.project_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage product tasks for own projects" ON public.product_tasks;
CREATE POLICY "Users can manage product tasks for own projects"
    ON public.product_tasks FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = product_tasks.project_id AND p.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = product_tasks.project_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage agent runs for own projects" ON public.agent_runs;
CREATE POLICY "Users can manage agent runs for own projects"
    ON public.agent_runs FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = agent_runs.project_id AND p.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = agent_runs.project_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage embeddings for own projects" ON public.project_embeddings;
CREATE POLICY "Users can manage embeddings for own projects"
    ON public.project_embeddings FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_embeddings.project_id AND p.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_embeddings.project_id AND p.user_id = auth.uid()));
