'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, FileQuestion } from 'lucide-react';
import { toast } from 'sonner';
import CodeEditor from '@/components/code-editor';
import LivePreview from '@/components/live-preview';
import { WorkspaceHeader } from '@/components/editor/workspace-header';
import { FileExplorer } from '@/components/editor/file-explorer';
import { PromptPanel } from '@/components/editor/prompt-panel';
import { EditorTabBar } from '@/components/editor/editor-tab-bar';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useAuth } from '@/components/auth-provider';
import { createClient } from '@/lib/client';
import {
  createProject,
  getProjectFiles,
  getProjects,
  saveProjectFile,
} from '@/lib/db';
import type { Project, ProjectFile } from '@/lib/types/database';

type AgentResponse = {
  summary: string;
  files: ProjectFile[];
  operations: Array<{ type: string; path: string; newPath?: string }>;
  dependencies: Array<{ name: string; version: string }>;
};

export default function EditorPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [activePath, setActivePath] = useState('');
  const [draft, setDraft] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [mobile, setMobile] = useState(false);
  const [dependencies, setDependencies] = useState<
    Array<{ name: string; version: string }>
  >([]);

  // Panel visibility toggles
  const [showFiles, setShowFiles] = useState(true);
  const [showPrompt, setShowPrompt] = useState(true);

  const activeFile = files.find((file) => file.path === activePath) ?? null;
  const dirty = Boolean(activeFile && draft !== savedContent);

  // Switch active file with unsaved check
  const openFile = useCallback(
    (file: ProjectFile) => {
      if (file.is_folder) return;
      if (dirty && activePath && activePath !== file.path) {
        const confirmSwitch = window.confirm(
          `You have unsaved changes in ${activePath}. Do you want to discard them and switch to ${file.path}?`
        );
        if (!confirmSwitch) return;
      }
      setActivePath(file.path);
      setDraft(file.content);
      setSavedContent(file.content);
      setTab('code');
    },
    [dirty, activePath]
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login?next=/editor');
      return;
    }
    if (!user) return;

    let active = true;
    async function loadInitialProject() {
      const projects = await getProjects(supabase, user?.id);
      if (!active) return;
      let current = projects.data?.[0] ?? null;
      if (!current) {
        const created = await createProject(supabase, user!.id, {
          name: 'My AI Project',
          description: 'AI-built application',
        });
        if (!active) return;
        current = created.data;
      }
      if (!current) {
        toast.error('Unable to load or create a project.');
        return;
      }
      const loaded = await getProjectFiles(supabase, current.id);
      if (!active) return;
      const next = loaded.data ?? [];
      setProject(current);
      setFiles(next);
      const initial =
        next.find((file) => file.path === 'app/page.tsx') ??
        next.find((file) => !file.is_folder);
      if (initial) {
        setActivePath(initial.path);
        setDraft(initial.content);
        setSavedContent(initial.content);
      }
      const deps = await supabase
        .from('project_dependencies')
        .select('name,version')
        .eq('project_id', current.id);
      if (!active) return;
      if (!deps.error) setDependencies(deps.data ?? []);
    }

    void loadInitialProject();
    return () => {
      active = false;
    };
  }, [isLoading, router, supabase, user]);

  // Save active file returning boolean status
  const save = useCallback(async (): Promise<boolean> => {
    if (!project || !activeFile) return false;
    const contentToSave = draft;
    const saved = await saveProjectFile(supabase, project.id, {
      path: activeFile.path,
      name: activeFile.name,
      content: contentToSave,
      language: activeFile.language,
      isFolder: false,
    });
    if (saved.error) {
      toast.error(`Save failed: ${saved.error.message}`);
      return false;
    }
    setFiles((current) =>
      current.map((file) =>
        file.path === activeFile.path ? { ...file, content: contentToSave } : file
      )
    );
    setSavedContent(contentToSave);
    toast.success(`Saved ${activeFile.path}`);
    return true;
  }, [activeFile, draft, project, supabase]);

  // Keyboard shortcut: Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (dirty) {
          void save();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dirty, save]);

  const generate = async () => {
    if (!project || !prompt.trim()) return;
    if (dirty) {
      const confirmSave = window.confirm(
        'You have unsaved Monaco edits. Save them before AI changes are applied?'
      );
      if (!confirmSave) return;
      const saveSuccess = await save();
      if (!saveSuccess) return;
    }
    setIsWorking(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          activePath,
          selectedCode: selectedCode || undefined,
          previewError: previewError || undefined,
        }),
      });
      const body = (await response.json()) as AgentResponse & {
        message?: string;
      };
      if (!response.ok) throw new Error(body.message || 'Generation failed.');

      const nextFiles = body.files ?? [];
      setFiles(nextFiles);
      setDependencies(body.dependencies ?? []);
      toast.success(body.summary, {
        description: body.operations.map((op) => `${op.type} ${op.path}`).join(', '),
      });
      setPrompt('');
      setTab('preview');

      const matching = nextFiles.find((file) => file.path === activePath);
      if (matching) {
        setDraft(matching.content);
        setSavedContent(matching.content);
      } else {
        const next =
          nextFiles.find((file) => file.path === 'app/page.tsx') ??
          nextFiles.find((file) => !file.is_folder);
        if (next) openFile(next);
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Generation failed.');
    } finally {
      setIsWorking(false);
    }
  };

  const fixWithAI = async (errorText: string) => {
    if (!project) return;
    if (dirty) {
      const saveSuccess = await save();
      if (!saveSuccess) return;
    }
    setIsWorking(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Diagnose and fix this preview error: ${errorText}`,
          activePath,
          selectedCode: selectedCode || undefined,
          previewError: errorText,
        }),
      });
      const body = (await response.json()) as AgentResponse & {
        message?: string;
      };
      if (!response.ok) throw new Error(body.message || 'Fix with AI failed.');

      const nextFiles = body.files ?? [];
      setFiles(nextFiles);
      setDependencies(body.dependencies ?? []);
      toast.success(`AI Repair applied: ${body.summary}`);
      setPreviewError('');
      setTab('preview');

      const matching = nextFiles.find((file) => file.path === activePath);
      if (matching) {
        setDraft(matching.content);
        setSavedContent(matching.content);
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Fix with AI failed.');
    } finally {
      setIsWorking(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080911]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
          <p className="text-xs text-slate-400 font-medium">Initializing workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-[#080911] text-slate-100 overflow-hidden">
      {/* Workspace Header */}
      <WorkspaceHeader
        project={project}
        activePath={activePath}
        dirty={dirty}
        isWorking={isWorking}
        onSave={save}
        tab={tab}
        setTab={setTab}
        showFiles={showFiles}
        onToggleFiles={() => setShowFiles((prev) => !prev)}
        showPrompt={showPrompt}
        onTogglePrompt={() => setShowPrompt((prev) => !prev)}
      />

      {/* Main Workspace Body with Resizable Panels */}
      <div className="flex-1 min-h-0 relative">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          {/* File Explorer Panel */}
          {showFiles && (
            <>
              <ResizablePanel
                defaultSize={16}
                minSize={12}
                maxSize={28}
                className="min-w-[170px]"
              >
                <FileExplorer
                  files={files}
                  activePath={activePath}
                  dirty={dirty}
                  onOpenFile={openFile}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* AI Prompt / Chat Panel */}
          {showPrompt && (
            <>
              <ResizablePanel
                defaultSize={24}
                minSize={18}
                maxSize={38}
                className="min-w-[270px]"
              >
                <PromptPanel
                  prompt={prompt}
                  setPrompt={setPrompt}
                  activePath={activePath}
                  selectedCode={selectedCode}
                  onClearSelectedCode={() => setSelectedCode('')}
                  previewError={previewError}
                  onClearPreviewError={() => setPreviewError('')}
                  isWorking={isWorking}
                  onGenerate={generate}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Main Area: Code Editor or Live Preview */}
          <ResizablePanel defaultSize={showFiles && showPrompt ? 60 : 80}>
            <div className="flex h-full flex-col min-w-0 bg-[#090a12]">
              {/* Editor Tab Bar */}
              <EditorTabBar
                activeFile={activeFile}
                dirty={dirty}
                tab={tab}
                setTab={setTab}
                mobile={mobile}
                setMobile={setMobile}
              />

              {/* View Content */}
              <div className="flex-1 min-h-0 relative overflow-hidden">
                {tab === 'code' ? (
                  <div className="h-full w-full p-2.5">
                    {activeFile ? (
                      <CodeEditor
                        path={activeFile.path}
                        value={draft}
                        language={activeFile.language}
                        onChange={setDraft}
                        onSelectionChange={setSelectedCode}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
                        <FileQuestion className="h-10 w-10 text-slate-600 mb-3" />
                        <h3 className="text-sm font-semibold text-slate-300 mb-1">
                          No File Selected
                        </h3>
                        <p className="text-xs max-w-sm text-slate-500">
                          Select a file from the explorer on the left to start editing.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <LivePreview
                    files={files}
                    dependencies={dependencies}
                    mobile={mobile}
                    onPreviewError={setPreviewError}
                    onFixWithAI={fixWithAI}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </main>
  );
}