'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, FileQuestion } from 'lucide-react';
import { toast } from 'sonner';
import CodeEditor from '@/components/code-editor';
import LivePreview, { ViewportMode } from '@/components/live-preview';
import { WorkspaceHeader } from '@/components/editor/workspace-header';
import { FileExplorer } from '@/components/editor/file-explorer';
import { PromptPanel, AiMode } from '@/components/editor/prompt-panel';
import {
  EditorTabBar,
  WorkspaceViewMode,
} from '@/components/editor/editor-tab-bar';

import { StatusBar } from '@/components/editor/status-bar';
import { CommandPalette } from '@/components/editor/command-palette';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/components/auth-provider';
import { createClient } from '@/lib/client';
import {
  createProject,
  getProjectFiles,
  getProjects,
  saveProjectFile,
  deleteProjectFile,
  renameProjectFile,
} from '@/lib/db';
import { batchUpsertFiles } from '@/lib/db/files';
import { getDefaultProjectFiles } from '@/lib/db/starter-template';
import { exportProjectToZip } from '@/lib/export/zip';
import { ProductWorkspace } from '@/components/product/product-workspace';
import type { ProductPlan } from '@/lib/ai/product-planner';
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

  // Project and files state
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activePath, setActivePath] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedContents, setSavedContents] = useState<Record<string, string>>({});

  // View & responsive modes
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('code');
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [mobileDrawer, setMobileDrawer] = useState<'files' | 'ai' | null>(null);

  // Panel visibility
  const [showFiles, setShowFiles] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(true);

  // Command palette
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // AI & Editor working states
  const [prompt, setPrompt] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isWorking, setIsWorking] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [aiMode, setAiMode] = useState<AiMode>('build');
  const [dependencies, setDependencies] = useState<
    Array<{ name: string; version: string }>
  >([]);

  // Active file derived from single source of truth: `files`
  const activeFile = useMemo(
    () => files.find((file) => file.path === activePath) ?? null,
    [files, activePath]
  );

  // Current draft content in active editor
  const currentDraft = useMemo(() => {
    if (!activePath) return '';
    if (activePath in drafts) return drafts[activePath];
    return activeFile?.content ?? '';
  }, [activePath, drafts, activeFile]);

  // Track dirty paths across all files
  const dirtyPaths = useMemo(() => {
    const dirties = new Set<string>();
    for (const [path, draftVal] of Object.entries(drafts)) {
      const original = savedContents[path] ?? files.find((f) => f.path === path)?.content ?? '';
      if (draftVal !== original) {
        dirties.add(path);
      }
    }
    return dirties;
  }, [drafts, savedContents, files]);

  const isCurrentFileDirty = Boolean(activePath && dirtyPaths.has(activePath));

  // Open / switch active file
  const openFile = useCallback(
    (file: ProjectFile) => {
      if (file.is_folder) return;
      // Add to open tabs if not present
      setOpenTabs((prev) => (prev.includes(file.path) ? prev : [...prev, file.path]));
      setActivePath(file.path);

      // Initialize drafts / savedContents if not yet set
      setDrafts((prev) => {
        if (file.path in prev) return prev;
        return { ...prev, [file.path]: file.content };
      });
      setSavedContents((prev) => {
        if (file.path in prev) return prev;
        return { ...prev, [file.path]: file.content };
      });
    },
    []
  );

  // Close tab
  const closeTab = useCallback(
    (path: string) => {
      if (dirtyPaths.has(path)) {
        const confirmClose = window.confirm(
          `You have unsaved changes in ${path}. Close without saving?`
        );
        if (!confirmClose) return;
      }

      setOpenTabs((prev) => {
        const next = prev.filter((p) => p !== path);
        if (activePath === path) {
          const nextActive = next[next.length - 1] || '';
          setActivePath(nextActive);
        }
        return next;
      });

      // Clear draft for closed file
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[path];
        return copy;
      });
    },
    [activePath, dirtyPaths]
  );

  // Dedicated Workspaces: 'developer' | 'product'
  const [workspace, setWorkspace] = useState<'developer' | 'product'>('developer');
  const [productPlan, setProductPlan] = useState<ProductPlan | null>(null);

  const persistFiles = useCallback((projId: string, nextFiles: ProjectFile[]) => {
    try {
      localStorage.setItem(`ai_studio_files_${projId}`, JSON.stringify(nextFiles));
    } catch (e) {
      console.warn('localStorage persist failed', e);
    }
  }, []);

  const handlePlanGenerated = useCallback((plan: ProductPlan) => {
    setProductPlan(plan);
    const pid = project?.id || 'local-project';
    try {
      localStorage.setItem(`ai_studio_plan_${pid}`, JSON.stringify(plan));
    } catch {}
  }, [project?.id]);

  const handleFilesUpdatedFromPM = useCallback(
    (newFiles: ProjectFile[], newDeps?: Array<{ name: string; version: string }>) => {
      setFiles(newFiles);
      const pid = project?.id || 'local-project';
      persistFiles(pid, newFiles);
      if (newDeps) setDependencies(newDeps);
      const newSaved: Record<string, string> = {};
      for (const f of newFiles) {
        if (!f.is_folder) newSaved[f.path] = f.content;
      }
      setSavedContents(newSaved);
      setDrafts(newSaved);
    },
    [project?.id, persistFiles]
  );

  const handleSwitchToDeveloper = useCallback((targetFilePath?: string) => {
    setWorkspace('developer');
    if (targetFilePath) {
      setOpenTabs((prev) => (prev.includes(targetFilePath) ? prev : [...prev, targetFilePath]));
      setActivePath(targetFilePath);
    }
  }, []);

  // Load project on mount
  useEffect(() => {
    if (!isLoading && !user && process.env.NODE_ENV === 'production') {
      router.replace('/login?next=/editor');
      return;
    }

    let active = true;
    async function loadInitialProject() {
      if (!user) {
        // Local development fallback workspace with persistent cache
        const cacheKey = 'ai_studio_files_local-project';
        let initialFiles: ProjectFile[] = [];
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              initialFiles = parsed;
            }
          }
        } catch (e) {
          console.warn('Could not read cached files', e);
        }

        if (initialFiles.length === 0) {
          initialFiles = getDefaultProjectFiles('AI Studio Project').map((f, idx) => ({
            id: `starter-${idx}`,
            project_id: 'local-project',
            name: f.name,
            path: f.path,
            content: f.content,
            language: f.language,
            is_folder: f.isFolder,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          try {
            localStorage.setItem(cacheKey, JSON.stringify(initialFiles));
          } catch {}
        }

        // Restore saved product plan if any
        try {
          const savedPlan = localStorage.getItem('ai_studio_plan_local-project');
          if (savedPlan) setProductPlan(JSON.parse(savedPlan));
        } catch {}

        setProject({
          id: 'local-project',
          user_id: 'local-user',
          name: 'AI Studio Project',
          description: 'Interactive AI Studio IDE Workspace',
          prompt: null,
          framework: 'nextjs',
          is_public: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setFiles(initialFiles);

        const initial =
          initialFiles.find((file) => file.path === 'app/page.tsx') ??
          initialFiles.find((file) => !file.is_folder);

        if (initial) {
          setOpenTabs([initial.path]);
          setActivePath(initial.path);
          setDrafts({ [initial.path]: initial.content });
          setSavedContents({ [initial.path]: initial.content });
        }
        return;
      }

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
      let next = loaded.data ?? [];

      // If database has 0 files for project, seed clean starter files
      if (next.length === 0) {
        const starter = getDefaultProjectFiles(current.name, current.prompt ?? undefined);
        await batchUpsertFiles(supabase, current.id, starter);
        const reloaded = await getProjectFiles(supabase, current.id);
        next = reloaded.data ?? [];
      }

      // Sync to localStorage
      try {
        localStorage.setItem(`ai_studio_files_${current.id}`, JSON.stringify(next));
        const savedPlan = localStorage.getItem(`ai_studio_plan_${current.id}`);
        if (savedPlan) setProductPlan(JSON.parse(savedPlan));
      } catch {}

      setProject(current);
      setFiles(next);

      // Select initial file (app/page.tsx or first non-folder file)
      const initial =
        next.find((file) => file.path === 'app/page.tsx') ??
        next.find((file) => !file.is_folder);

      if (initial) {
        setOpenTabs([initial.path]);
        setActivePath(initial.path);
        setDrafts({ [initial.path]: initial.content });
        setSavedContents({ [initial.path]: initial.content });
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

  // Save active file
  const save = useCallback(async (): Promise<boolean> => {
    if (!project || !activeFile) return false;
    const contentToSave = currentDraft;

    if (project.id === 'local-project') {
      const updated = files.map((file) =>
        file.path === activeFile.path ? { ...file, content: contentToSave } : file
      );
      setFiles(updated);
      persistFiles('local-project', updated);
      setSavedContents((prev) => ({ ...prev, [activeFile.path]: contentToSave }));
      toast.success(`Saved ${activeFile.path}`);
      return true;
    }

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

    // Update frontend state single source of truth and persistent cache
    const updated = files.map((file) =>
      file.path === activeFile.path ? { ...file, content: contentToSave } : file
    );
    setFiles(updated);
    persistFiles(project.id, updated);
    setSavedContents((prev) => ({ ...prev, [activeFile.path]: contentToSave }));
    toast.success(`Saved ${activeFile.path}`);
    return true;
  }, [activeFile, currentDraft, files, persistFiles, project, supabase]);

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isCurrentFileDirty) {
          void save();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCurrentFileDirty, save]);

  // AI Generation Pipeline
  const generate = async (overridePrompt?: string) => {
    const effectivePrompt = overridePrompt || prompt;
    if (!project || !effectivePrompt.trim()) return;

    if (isCurrentFileDirty) {
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
          prompt: effectivePrompt,
          activePath,
          selectedCode: selectedCode || undefined,
          previewError: previewError || undefined,
          files,
        }),
      });

      const body = (await response.json()) as AgentResponse & {
        message?: string;
      };
      if (!response.ok) throw new Error(body.message || 'Generation failed.');

      const nextFiles = body.files ?? [];
      setFiles(nextFiles);
      persistFiles(project.id, nextFiles);
      setDependencies(body.dependencies ?? []);

      // Reset drafts & saved contents to newly returned source files
      const newSaved: Record<string, string> = {};
      for (const f of nextFiles) {
        if (!f.is_folder) newSaved[f.path] = f.content;
      }
      setSavedContents(newSaved);
      setDrafts(newSaved);

      toast.success(body.summary, {
        description: body.operations.map((op) => `${op.type} ${op.path}`).join(', '),
      });

      setPrompt('');
      if (viewMode === 'code') setViewMode('split');

      // Auto-open created or modified file
      const createdOp = body.operations.find((op) => op.type === 'create');
      const updatedOp = body.operations.find((op) => op.type === 'update');
      const targetOpPath = createdOp?.path || updatedOp?.path;

      if (targetOpPath) {
        const targetFile = nextFiles.find((f) => f.path === targetOpPath);
        if (targetFile) openFile(targetFile);
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Generation failed.');
    } finally {
      setIsWorking(false);
    }
  };

  // Fix with AI
  const fixWithAI = async (errorText: string) => {
    if (!project) return;
    if (isCurrentFileDirty) {
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
          files,
        }),
      });

      const body = (await response.json()) as AgentResponse & {
        message?: string;
      };
      if (!response.ok) throw new Error(body.message || 'Fix with AI failed.');

      const nextFiles = body.files ?? [];
      setFiles(nextFiles);
      persistFiles(project.id, nextFiles);
      setDependencies(body.dependencies ?? []);

      const newSaved: Record<string, string> = {};
      for (const f of nextFiles) {
        if (!f.is_folder) newSaved[f.path] = f.content;
      }
      setSavedContents(newSaved);
      setDrafts(newSaved);

      toast.success(`AI Repair applied: ${body.summary}`);
      setPreviewError('');
      if (viewMode === 'code') setViewMode('split');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Fix with AI failed.');
    } finally {
      setIsWorking(false);
    }
  };

  // Real File Management Actions
  const handleCreateFile = async (filePath: string) => {
    if (!project) return;
    const name = filePath.split('/').pop() || filePath;
    const language = filePath.endsWith('.tsx') || filePath.endsWith('.ts') ? 'typescript' : 'javascript';

    if (project.id === 'local-project') {
      const newFile: ProjectFile = {
        id: `file-${Date.now()}`,
        project_id: 'local-project',
        name,
        path: filePath,
        content: '// New file\n',
        language,
        is_folder: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updated = [...files.filter((f) => f.path !== filePath), newFile];
      setFiles(updated);
      persistFiles('local-project', updated);
      openFile(newFile);
      toast.success(`Created ${filePath}`);
      return;
    }

    const res = await saveProjectFile(supabase, project.id, {
      path: filePath,
      name,
      content: '// New file\n',
      language,
      isFolder: false,
    });
    if (res.error) {
      toast.error(`Create file failed: ${res.error.message}`);
      return;
    }
    if (res.data) {
      const updated = [...files.filter((f) => f.path !== filePath), res.data!];
      setFiles(updated);
      persistFiles(project.id, updated);
      openFile(res.data);
      toast.success(`Created ${filePath}`);
    }
  };

  const handleCreateFolder = async (folderPath: string) => {
    if (!project) return;
    const name = folderPath.split('/').pop() || folderPath;

    if (project.id === 'local-project') {
      const newFolder: ProjectFile = {
        id: `folder-${Date.now()}`,
        project_id: 'local-project',
        name,
        path: folderPath,
        content: '',
        language: 'folder',
        is_folder: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updated = [...files.filter((f) => f.path !== folderPath), newFolder];
      setFiles(updated);
      persistFiles('local-project', updated);
      toast.success(`Created folder ${folderPath}`);
      return;
    }

    const res = await saveProjectFile(supabase, project.id, {
      path: folderPath,
      name,
      content: '',
      language: 'folder',
      isFolder: true,
    });
    if (res.error) {
      toast.error(`Create folder failed: ${res.error.message}`);
      return;
    }
    if (res.data) {
      const updated = [...files.filter((f) => f.path !== folderPath), res.data!];
      setFiles(updated);
      persistFiles(project.id, updated);
      toast.success(`Created folder ${folderPath}`);
    }
  };

  const handleRenameFile = async (file: ProjectFile, newPath: string) => {
    if (!project) return;
    const name = newPath.split('/').pop() || newPath;

    if (project.id === 'local-project') {
      let updated: ProjectFile[];
      if (file.is_folder) {
        updated = files.map((f) => {
          if (f.path === file.path) return { ...f, path: newPath, name };
          if (f.path.startsWith(`${file.path}/`)) {
            const sub = f.path.slice(file.path.length + 1);
            const childNewPath = `${newPath}/${sub}`;
            return { ...f, path: childNewPath, name: childNewPath.split('/').pop() || childNewPath };
          }
          return f;
        });
      } else {
        updated = files.map((f) => (f.path === file.path ? { ...f, path: newPath, name } : f));
      }
      setFiles(updated);
      persistFiles('local-project', updated);
      setOpenTabs((prev) => prev.map((p) => (p === file.path ? newPath : p)));
      if (activePath === file.path) setActivePath(newPath);
      toast.success(`Renamed to ${newPath}`);
      return;
    }

    const res = await renameProjectFile(supabase, project.id, file, newPath);
    if (res.error) {
      toast.error(`Rename failed: ${res.error.message}`);
      return;
    }
    const refreshed = await getProjectFiles(supabase, project.id);
    if (refreshed.data) {
      setFiles(refreshed.data);
      persistFiles(project.id, refreshed.data);
      setOpenTabs((prev) =>
        prev.map((p) => (p === file.path ? newPath : p))
      );
      if (activePath === file.path) {
        setActivePath(newPath);
      }
      toast.success(`Renamed to ${newPath}`);
    }
  };

  const handleDeleteFile = async (file: ProjectFile) => {
    if (!project) return;

    if (project.id === 'local-project') {
      let updated: ProjectFile[];
      if (file.is_folder) {
        updated = files.filter((f) => f.path !== file.path && !f.path.startsWith(`${file.path}/`));
      } else {
        updated = files.filter((f) => f.path !== file.path);
      }
      setFiles(updated);
      persistFiles('local-project', updated);
      closeTab(file.path);
      toast.success(`Deleted ${file.path}`);
      return;
    }

    const res = await deleteProjectFile(supabase, project.id, file.path, file.is_folder);
    if (res.error) {
      toast.error(`Delete failed: ${res.error.message}`);
      return;
    }
    const refreshed = await getProjectFiles(supabase, project.id);
    if (refreshed.data) {
      setFiles(refreshed.data);
      persistFiles(project.id, refreshed.data);
      closeTab(file.path);
      toast.success(`Deleted ${file.path}`);
    }
  };

  const handleExportZip = async () => {
    if (!project || files.length === 0) return;
    try {
      toast.loading('Packaging project as ZIP…', { id: 'export-zip' });
      await exportProjectToZip(project.name, files);
      toast.success('Project exported successfully!', { id: 'export-zip' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ZIP export failed', { id: 'export-zip' });
    }
  };

  if (isLoading || !project) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080911]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          <p className="text-xs text-slate-400 font-medium">Initializing AI Studio workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-[#080911] text-slate-100 overflow-hidden select-none">
      {/* Workspace Header */}
      <WorkspaceHeader
        project={project}
        activePath={activePath}
        dirty={isCurrentFileDirty}
        isWorking={isWorking}
        onSave={save}
        onExportZip={handleExportZip}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        showFiles={showFiles}
        onToggleFiles={() => setShowFiles((prev) => !prev)}
        showAiPanel={showAiPanel}
        onToggleAiPanel={() => setShowAiPanel((prev) => !prev)}
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
      />

      {/* Main Workspace: Dedicated Product Manager Workspace OR 3-Panel IDE Layout */}
      {workspace === 'product' && project ? (
        <ProductWorkspace
          project={project}
          files={files}
          productPlan={productPlan}
          onPlanGenerated={handlePlanGenerated}
          onFilesUpdated={handleFilesUpdatedFromPM}
          onSwitchToDeveloper={handleSwitchToDeveloper}
        />
      ) : (
        <div className="flex-1 min-h-0 relative">
          <ResizablePanelGroup
            key={`layout-${showFiles ? 'f1' : 'f0'}-${showAiPanel ? 'a1' : 'a0'}`}
            direction="horizontal"
            className="h-full w-full"
          >
            {/* Panel 1: File Explorer (18–22%) */}
            {showFiles && (
              <>
                <ResizablePanel
                  defaultSize="20%"
                  minSize="15%"
                  maxSize="30%"
                  className="min-w-[190px]"
                >
                  <FileExplorer
                    files={files}
                    activePath={activePath}
                    dirtyPaths={dirtyPaths}
                    onOpenFile={openFile}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                    onRenameFile={handleRenameFile}
                    onDeleteFile={handleDeleteFile}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            {/* Panel 2: Center Workspace (Code / Preview / Split) (50–58%) */}
            <ResizablePanel defaultSize={showFiles && showAiPanel ? "54%" : showFiles || showAiPanel ? "75%" : "100%"}>
              <div className="flex h-full flex-col min-w-0 bg-[#090a12]">
                {/* Editor Tab Bar */}
                <EditorTabBar
                  files={files}
                  openTabs={openTabs}
                  activePath={activePath}
                  dirtyPaths={dirtyPaths}
                  onSelectTab={(path) => {
                    const f = files.find((item) => item.path === path);
                    if (f) openFile(f);
                  }}
                  onCloseTab={closeTab}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  viewport={viewport}
                  setViewport={setViewport}
                />

                {/* Center Workspace Content */}
                <div className="flex-1 min-h-0 relative overflow-hidden">
                  {/* 1. CODE ONLY VIEW */}
                  {viewMode === 'code' && (
                    <div className="h-full w-full p-2.5">
                      {activeFile ? (
                        <CodeEditor
                          path={activeFile.path}
                          value={currentDraft}
                          language={activeFile.language}
                          onChange={(val) => {
                            setDrafts((prev) => ({ ...prev, [activeFile.path]: val }));
                          }}
                          onSelectionChange={setSelectedCode}
                          onCursorChange={(line, col) => setCursorPos({ line, col })}
                          onSave={save}
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
                          <FileQuestion className="h-10 w-10 text-slate-600 mb-3" />
                          <h3 className="text-sm font-semibold text-slate-300 mb-1">
                            No File Selected
                          </h3>
                          <p className="text-xs max-w-sm text-slate-500">
                            Select a file from the explorer on the left or create a new file to start editing.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. PREVIEW ONLY VIEW */}
                  {viewMode === 'preview' && (
                    <LivePreview
                      files={files}
                      dependencies={dependencies}
                      controlledViewport={viewport}
                      onPreviewError={setPreviewError}
                      onFixWithAI={fixWithAI}
                    />
                  )}

                  {/* 3. SPLIT VIEW (Code + Preview side-by-side) */}
                  {viewMode === 'split' && (
                    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                      {/* Left side: Monaco */}
                      <ResizablePanel defaultSize="50%" minSize="30%">
                        <div className="h-full w-full p-2">
                          {activeFile ? (
                            <CodeEditor
                              path={activeFile.path}
                              value={currentDraft}
                              language={activeFile.language}
                              onChange={(val) => {
                                setDrafts((prev) => ({ ...prev, [activeFile.path]: val }));
                              }}
                              onSelectionChange={setSelectedCode}
                              onCursorChange={(line, col) => setCursorPos({ line, col })}
                              onSave={save}
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
                              <FileQuestion className="h-8 w-8 text-slate-600 mb-2" />
                              <p className="text-xs text-slate-500">No file selected for editing</p>
                            </div>
                          )}
                        </div>
                      </ResizablePanel>

                      <ResizableHandle withHandle />

                      {/* Right side: Sandpack Live Preview */}
                      <ResizablePanel defaultSize="50%" minSize="30%">
                        <div className="h-full w-full">
                          <LivePreview
                            files={files}
                            dependencies={dependencies}
                            controlledViewport={viewport}
                            onPreviewError={setPreviewError}
                            onFixWithAI={fixWithAI}
                          />
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  )}
                </div>
              </div>
            </ResizablePanel>

            {/* Panel 3: Persistent AI Assistant (25–30%) */}
            {showAiPanel && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel
                  defaultSize="26%"
                  minSize="20%"
                  maxSize="40%"
                  className="min-w-[280px]"
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
                    projectId={project?.id}
                    currentMode={aiMode}
                    onModeChange={setAiMode}
                    onOpenProductWorkspace={() => setWorkspace('product')}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      )}

      {/* Bottom Status Bar */}
      <StatusBar
        dirty={isCurrentFileDirty}
        language={activeFile?.language ?? 'typescript'}
        cursorLine={cursorPos.line}
        cursorCol={cursorPos.col}
        previewError={previewError || null}
        isWorking={isWorking}
        onOpenPreviewError={() => {
          setAiMode('debug');
          setShowAiPanel(true);
        }}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        files={files}
        onOpenFile={openFile}
        onSave={save}
        onExportZip={handleExportZip}
        onSelectViewMode={setViewMode}
        onSelectAiMode={(m) => {
          setAiMode(m);
          setShowAiPanel(true);
        }}
        onNewFile={() => {
          const name = window.prompt('Enter new file path (e.g. components/Header.tsx):');
          if (name) void handleCreateFile(name);
        }}
        onNewFolder={() => {
          const name = window.prompt('Enter new folder path (e.g. components/ui):');
          if (name) void handleCreateFolder(name);
        }}
      />
    </main>
  );
}