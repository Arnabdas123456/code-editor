'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import {
  Loader2,
  FileQuestion,
  Sparkles,
  Plus,
  Compass,
  FilePlus,
  Terminal as TerminalIcon,
  Play,
  Layers,
  Code2,
} from 'lucide-react';
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
import { TerminalPanel } from '@/components/editor/terminal-panel';
import { webcontainerManager } from '@/lib/runtime/webcontainer-manager';
import { StatusBar } from '@/components/editor/status-bar';
import { CommandPalette } from '@/components/editor/command-palette';
import { Button } from '@/components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useAuth } from '@/components/auth-provider';
import { createClient } from '@/lib/client';
import {
  createProject,
  getProjectById,
  getProjectFiles,
  getProjects,
  updateProject,
  saveProjectFile,
  deleteProjectFile,
  renameProjectFile,
} from '@/lib/db';
import { getProductPlanFromDb, saveProductPlanToDb } from '@/lib/db/product';
import { exportProjectToZip } from '@/lib/export/zip';
import { ProductWorkspace } from '@/components/product/product-workspace';
import type { ProductPlan } from '@/lib/ai/product-planner';
import type { Project, ProjectFile } from '@/lib/types/database';

type AgentResponse = {
  summary: string;
  files: ProjectFile[];
  operations: Array<{ type: string; path: string; newPath?: string }>;
  dependencies: Array<{ name: string; version: string }>;
  projectName?: string;
};

export type ProjectStatus = 'loading' | 'empty' | 'ready' | 'error';

export default function EditorPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Project and files state
  const [project, setProject] = useState<Project | null>(null);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('loading');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activePath, setActivePath] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedContents, setSavedContents] = useState<Record<string, string>>({});

  // View & responsive modes
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('code');
  const [viewport, setViewport] = useState<ViewportMode>('desktop');

  // WebContainer running server URL
  const [webcontainerUrl, setWebcontainerUrl] = useState<string | null>(null);

  // Panel visibility & sizing
  const [showFiles, setShowFiles] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);

  // Exact controlled layout dimensions (Default 260px, 360px, 220px)
  const [explorerWidth, setExplorerWidth] = useState(260);
  const [assistantWidth, setAssistantWidth] = useState(360);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const [isDragging, setIsDragging] = useState(false);

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

  // Dedicated Workspaces: 'developer' | 'product'
  const [workspace, setWorkspace] = useState<'developer' | 'product'>('developer');
  const [productPlan, setProductPlan] = useState<ProductPlan | null>(null);

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
  const openFile = useCallback((file: ProjectFile) => {
    if (file.is_folder) return;
    setOpenTabs((prev) => (prev.includes(file.path) ? prev : [...prev, file.path]));
    setActivePath(file.path);

    setDrafts((prev) => {
      if (file.path in prev) return prev;
      return { ...prev, [file.path]: file.content };
    });
    setSavedContents((prev) => {
      if (file.path in prev) return prev;
      return { ...prev, [file.path]: file.content };
    });
  }, []);

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

      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[path];
        return copy;
      });
    },
    [activePath, dirtyPaths]
  );

  const persistFilesToCache = useCallback((projId: string, nextFiles: ProjectFile[]) => {
    try {
      localStorage.setItem(`codatron_files_${projId}`, JSON.stringify(nextFiles));
    } catch (e) {
      console.warn('localStorage cache failed', e);
    }
  }, []);

  const handlePlanGenerated = useCallback(
    (plan: ProductPlan) => {
      setProductPlan(plan);
      if (project) {
        void saveProductPlanToDb(supabase, project.id, plan);
        try {
          localStorage.setItem(`codatron_plan_${project.id}`, JSON.stringify(plan));
        } catch { }
      }
    },
    [project, supabase]
  );

  const handleFilesUpdatedFromPM = useCallback(
    (newFiles: ProjectFile[], newDeps?: Array<{ name: string; version: string }>) => {
      setFiles(newFiles);
      setProjectStatus(newFiles.length > 0 ? 'ready' : 'empty');
      const pid = project?.id || 'local-project';
      persistFilesToCache(pid, newFiles);
      if (newDeps) setDependencies(newDeps);
      const newSaved: Record<string, string> = {};
      for (const f of newFiles) {
        if (!f.is_folder) newSaved[f.path] = f.content;
      }
      setSavedContents(newSaved);
      setDrafts(newSaved);
    },
    [project?.id, persistFilesToCache]
  );

  const handleSwitchToDeveloper = useCallback(
    (targetFilePath?: string) => {
      setWorkspace('developer');
      if (targetFilePath) {
        const target = files.find((f) => f.path === targetFilePath);
        if (target) {
          openFile(target);
        } else {
          setOpenTabs((prev) => (prev.includes(targetFilePath) ? prev : [...prev, targetFilePath]));
          setActivePath(targetFilePath);
        }
      }
    },
    [files, openFile]
  );

  // Resize drag handlers
  const handleExplorerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = explorerWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(400, Math.max(220, startWidth + delta));
      setExplorerWidth(newWidth);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('monaco-layout'));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('monaco-layout'));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [explorerWidth]);

  const handleAssistantMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = assistantWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(480, Math.max(320, startWidth + delta));
      setAssistantWidth(newWidth);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('monaco-layout'));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('monaco-layout'));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [assistantWidth]);

  const handleTerminalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const maxHeight = Math.floor(window.innerHeight * 0.5);
      const newHeight = Math.min(maxHeight, Math.max(140, startHeight + delta));
      setTerminalHeight(newHeight);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('monaco-layout'));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('monaco-layout'));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [terminalHeight]);

  const gridTemplateColumns = useMemo(() => {
    if (showFiles && showAiPanel) {
      return `${explorerWidth}px 4px minmax(0, 1fr) 4px ${assistantWidth}px`;
    }
    if (showFiles && !showAiPanel) {
      return `${explorerWidth}px 4px minmax(0, 1fr)`;
    }
    if (!showFiles && showAiPanel) {
      return `minmax(0, 1fr) 4px ${assistantWidth}px`;
    }
    return 'minmax(0, 1fr)';
  }, [showFiles, showAiPanel, explorerWidth, assistantWidth]);

  // Load project on mount: Hydrate from Supabase and URL query
  useEffect(() => {
    if (!isLoading && !user && process.env.NODE_ENV === 'production') {
      router.replace('/login?next=/editor');
      return;
    }

    let active = true;

    async function loadInitialProject() {
      setProjectStatus('loading');

      // Check URL query parameters: ?project=<id> or ?id=<id>
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const queryPid = params?.get('project') || params?.get('id');

      if (!user) {
        // Local offline development mode
        const localPid = 'local-project';
        let initialFiles: ProjectFile[] = [];
        try {
          const cached = localStorage.getItem(`codatron_files_${localPid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) initialFiles = parsed;
          }
        } catch { }

        try {
          const savedPlan = localStorage.getItem(`codatron_plan_${localPid}`);
          if (savedPlan) setProductPlan(JSON.parse(savedPlan));
        } catch { }

        setProject({
          id: localPid,
          user_id: 'local-user',
          name: 'Local Project',
          description: 'Local development workspace',
          prompt: null,
          framework: 'nextjs',
          is_public: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        setFiles(initialFiles);
        setProjectStatus(initialFiles.length > 0 ? 'ready' : 'empty');

        if (initialFiles.length > 0) {
          const initial =
            initialFiles.find((file) => file.path === 'app/page.tsx' || file.path === 'main.py') ??
            initialFiles.find((file) => !file.is_folder);
          if (initial) {
            setOpenTabs([initial.path]);
            setActivePath(initial.path);
            setDrafts({ [initial.path]: initial.content });
            setSavedContents({ [initial.path]: initial.content });
          }
        }
        return;
      }

      // Authenticated User: Supabase is the sole source of truth
      try {
        let current: Project | null = null;

        if (queryPid) {
          const fetched = await getProjectById(supabase, queryPid);
          if (active && fetched.data) {
            current = fetched.data;
          }
        }

        if (!current) {
          const projects = await getProjects(supabase, user.id);
          if (!active) return;
          current = projects.data?.[0] ?? null;
        }

        if (!current) {
          const created = await createProject(supabase, user.id, {
            name: 'New Project',
            description: 'AI-built application',
          });
          if (!active) return;
          current = created.data;
        }

        if (!current) {
          setProjectStatus('error');
          toast.error('Unable to load or create a project.');
          return;
        }

        // Ensure URL reflects active projectId
        if (typeof window !== 'undefined' && window.location.search !== `?project=${current.id}`) {
          window.history.replaceState(null, '', `?project=${current.id}`);
        }

        setProject(current);

        // Fetch files from Supabase project_files table
        const loaded = await getProjectFiles(supabase, current.id);
        if (!active) return;
        const projectFiles = loaded.data ?? [];

        setFiles(projectFiles);
        persistFilesToCache(current.id, projectFiles);

        if (projectFiles.length === 0) {
          // Explicit EMPTY PROJECT state. Do NOT inject fake or demo files!
          setProjectStatus('empty');
          setOpenTabs([]);
          setActivePath('');
        } else {
          setProjectStatus('ready');
          const initial =
            projectFiles.find((file) => file.path === 'app/page.tsx' || file.path === 'main.py' || file.path === 'index.html') ??
            projectFiles.find((file) => !file.is_folder);

          if (initial) {
            setOpenTabs([initial.path]);
            setActivePath(initial.path);
            setDrafts({ [initial.path]: initial.content });
            setSavedContents({ [initial.path]: initial.content });
          }
        }

        // Load project plan from Supabase
        const planRes = await getProductPlanFromDb(supabase, current.id);
        if (active && planRes.plan) {
          setProductPlan(planRes.plan);
        }

        // Load dependencies
        const deps = await supabase
          .from('project_dependencies')
          .select('name,version')
          .eq('project_id', current.id);
        if (active && !deps.error) {
          setDependencies(deps.data ?? []);
        }
      } catch (err) {
        if (!active) return;
        setProjectStatus('error');
        console.error('Project hydration error:', err);
        toast.error('Failed to load project from Supabase.');
      }
    }

    void loadInitialProject();
    return () => {
      active = false;
    };
  }, [isLoading, router, supabase, user, persistFilesToCache]);

  // Synchronize WebContainer runtime snapshot (previewUrl, errors)
  useEffect(() => {
    const unsub = webcontainerManager.subscribeSnapshot((snap) => {
      if (snap.previewUrl) {
        setWebcontainerUrl(snap.previewUrl);
      }
      if (snap.lastError) {
        setPreviewError(snap.lastError.message);
      }
    });
    return unsub;
  }, []);

  // Rename Project
  const handleRenameProject = async (newName: string) => {
    if (!project) return;
    if (project.id === 'local-project') {
      setProject((prev) => (prev ? { ...prev, name: newName } : prev));
      toast.success('Project renamed');
      return;
    }
    const res = await updateProject(supabase, project.id, { name: newName });
    if (res.data) {
      setProject(res.data);
      toast.success('Project renamed');
    } else {
      toast.error('Could not rename project');
    }
  };

  // Run / Preview shortcut
  const handleRunPreview = () => {
    if (viewMode === 'code') {
      setViewMode('split');
    } else {
      setViewMode('preview');
    }
  };

  // Save active file to Supabase & hot-sync to WebContainer virtual filesystem
  const save = useCallback(async (): Promise<boolean> => {
    if (!project || !activeFile) return false;
    const contentToSave = currentDraft;

    if (project.id === 'local-project') {
      const updated = files.map((file) =>
        file.path === activeFile.path ? { ...file, content: contentToSave } : file
      );
      setFiles(updated);
      persistFilesToCache('local-project', updated);
      setSavedContents((prev) => ({ ...prev, [activeFile.path]: contentToSave }));
      void webcontainerManager.syncFile(activeFile.path, contentToSave);
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

    const updated = files.map((file) =>
      file.path === activeFile.path ? { ...file, content: contentToSave } : file
    );
    setFiles(updated);
    persistFilesToCache(project.id, updated);
    setSavedContents((prev) => ({ ...prev, [activeFile.path]: contentToSave }));
    void webcontainerManager.syncFile(activeFile.path, contentToSave);
    toast.success(`Saved ${activeFile.path}`);
    return true;
  }, [activeFile, currentDraft, files, persistFilesToCache, project, supabase]);

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

  // AI Generation Pipeline (Build / Code / Debug)
  const generate = async (overridePrompt?: string) => {
    const effectivePrompt = overridePrompt || prompt;
    if (!project || !effectivePrompt.trim()) return;

    if (isCurrentFileDirty) {
      const confirmSave = window.confirm(
        'You have unsaved edits. Save them before AI changes are applied?'
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
          mode: aiMode,
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
      setProjectStatus(nextFiles.length > 0 ? 'ready' : 'empty');
      persistFilesToCache(project.id, nextFiles);
      setDependencies(body.dependencies ?? []);

      // If a project name was derived from first build, update project state
      if (body.projectName && body.projectName !== project.name) {
        setProject((prev) => (prev ? { ...prev, name: body.projectName! } : prev));
      }

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

      // Automate Build App pipeline in WebContainer
      if (aiMode === 'build' || nextFiles.length > 0) {
        void webcontainerManager.runProject(nextFiles);
      }

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

  // Fix with AI Debug
  const fixWithAI = async (errorText: string) => {
    setAiMode('debug');
    setShowAiPanel(true);
    setPreviewError(errorText);
    await generate(`Diagnose and fix this error: ${errorText}`);
  };

  // File operations handlers
  const handleCreateFile = async (filePath: string) => {
    if (!project) return;
    const cleanPath = filePath.trim().replace(/^\//, '');
    if (!cleanPath) return;

    const name = cleanPath.split('/').pop() || cleanPath;
    const newFile: ProjectFile = {
      id: `f-${Date.now()}`,
      project_id: project.id,
      name,
      path: cleanPath,
      content: '',
      language: cleanPath.endsWith('.py')
        ? 'python'
        : cleanPath.endsWith('.java')
          ? 'java'
          : cleanPath.endsWith('.cpp')
            ? 'cpp'
            : cleanPath.endsWith('.json')
              ? 'json'
              : cleanPath.endsWith('.css')
                ? 'css'
                : 'typescript',
      is_folder: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (project.id === 'local-project') {
      const updated = [...files.filter((f) => f.path !== cleanPath), newFile];
      setFiles(updated);
      setProjectStatus('ready');
      persistFilesToCache('local-project', updated);
      openFile(newFile);
      void webcontainerManager.syncFile(cleanPath, '');
      toast.success(`Created ${cleanPath}`);
      return;
    }

    const res = await saveProjectFile(supabase, project.id, {
      path: cleanPath,
      name,
      content: '',
      language: newFile.language,
      isFolder: false,
    });

    if (res.error) {
      toast.error(`Create file failed: ${res.error.message}`);
      return;
    }

    const refreshed = await getProjectFiles(supabase, project.id);
    if (refreshed.data) {
      setFiles(refreshed.data);
      setProjectStatus('ready');
      persistFilesToCache(project.id, refreshed.data);
      const created = refreshed.data.find((f) => f.path === cleanPath);
      if (created) openFile(created);
      void webcontainerManager.syncFile(cleanPath, '');
      toast.success(`Created ${cleanPath}`);
    }
  };

  const handleCreateFolder = async (folderPath: string) => {
    if (!project) return;
    const cleanPath = folderPath.trim().replace(/^\//, '');
    if (!cleanPath) return;
    const name = cleanPath.split('/').pop() || cleanPath;

    const folderPlaceholder: ProjectFile = {
      id: `folder-${Date.now()}`,
      project_id: project.id,
      name,
      path: cleanPath,
      content: '',
      language: 'plaintext',
      is_folder: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (project.id === 'local-project') {
      const updated = [...files, folderPlaceholder];
      setFiles(updated);
      setProjectStatus('ready');
      persistFilesToCache('local-project', updated);
      toast.success(`Created folder ${cleanPath}`);
      return;
    }

    const res = await saveProjectFile(supabase, project.id, {
      path: cleanPath,
      name,
      content: '',
      language: 'plaintext',
      isFolder: true,
    });

    if (res.error) {
      toast.error(`Create folder failed: ${res.error.message}`);
      return;
    }

    const refreshed = await getProjectFiles(supabase, project.id);
    if (refreshed.data) {
      setFiles(refreshed.data);
      setProjectStatus('ready');
      persistFilesToCache(project.id, refreshed.data);
      toast.success(`Created folder ${cleanPath}`);
    }
  };

  const handleRenameFile = async (file: ProjectFile, newPath: string) => {
    if (!project) return;
    if (project.id === 'local-project') {
      const updated = files.map((f) => (f.path === file.path ? { ...f, path: newPath } : f));
      setFiles(updated);
      persistFilesToCache('local-project', updated);
      setOpenTabs((prev) => prev.map((p) => (p === file.path ? newPath : p)));
      if (activePath === file.path) setActivePath(newPath);
      void webcontainerManager.renameFile(file.path, newPath);
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
      persistFilesToCache(project.id, refreshed.data);
      setOpenTabs((prev) => prev.map((p) => (p === file.path ? newPath : p)));
      if (activePath === file.path) setActivePath(newPath);
      void webcontainerManager.renameFile(file.path, newPath);
      toast.success(`Renamed to ${newPath}`);
    }
  };

  const handleDeleteFile = async (file: ProjectFile) => {
    if (!project) return;
    if (project.id === 'local-project') {
      const updated = files.filter(
        (f) => f.path !== file.path && !f.path.startsWith(`${file.path}/`)
      );
      setFiles(updated);
      setProjectStatus(updated.length > 0 ? 'ready' : 'empty');
      persistFilesToCache('local-project', updated);
      closeTab(file.path);
      void webcontainerManager.removeFile(file.path);
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
      setProjectStatus(refreshed.data.length > 0 ? 'ready' : 'empty');
      persistFilesToCache(project.id, refreshed.data);
      closeTab(file.path);
      void webcontainerManager.removeFile(file.path);
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

  if (projectStatus === 'loading' || !project) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080911]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          <p className="text-xs text-slate-400 font-medium">Hydrating project from Supabase…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-[#080911] text-slate-100 overflow-hidden select-none">
      <Script src="/coi-serviceworker.js" strategy="afterInteractive" />
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
        onRenameProject={handleRenameProject}
        onRunPreview={handleRunPreview}
      />

      {/* Main Workspace: Dedicated Product Manager Workspace OR Developer IDE */}
      {workspace === 'product' ? (
        <ProductWorkspace
          project={project}
          files={files}
          productPlan={productPlan}
          onPlanGenerated={handlePlanGenerated}
          onFilesUpdated={handleFilesUpdatedFromPM}
          onSwitchToDeveloper={handleSwitchToDeveloper}
        />
      ) : (
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative ${isDragging ? 'select-none [&_iframe]:pointer-events-none' : ''}`}>
          {/* Upper Workspace: Explorer | Center | Assistant */}
          <div
            className="flex-1 min-h-0 min-w-0 grid overflow-hidden w-full"
            style={{
              gridTemplateColumns,
            }}
          >
            {/* Panel 1: File Explorer (min 220px, max 400px, default 260px) */}
            {showFiles && (
              <div
                className="h-full min-h-0 min-w-0 overflow-hidden flex flex-col bg-[#0b0c16] border-r border-white/10"
                style={{ width: `${explorerWidth}px`, minWidth: '220px', maxWidth: '400px' }}
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
              </div>
            )}

            {/* Drag Handle: Explorer to Center */}
            {showFiles && (
              <div
                onMouseDown={handleExplorerMouseDown}
                className="w-1 h-full cursor-col-resize bg-white/5 hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors select-none z-10 flex items-center justify-center group"
                title="Drag to resize File Explorer"
              >
                <div className="w-0.5 h-6 rounded bg-slate-600 group-hover:bg-indigo-300" />
              </div>
            )}

            {/* Panel 2: Center Workspace (min-width: 0, min-height: 0, flex-1) */}
            <div className="h-full min-h-0 min-w-0 flex flex-col bg-[#090a12] overflow-hidden">
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
                showTerminal={showTerminal}
                onToggleTerminal={() => {
                  setShowTerminal((prev) => !prev);
                  setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                    window.dispatchEvent(new Event('monaco-layout'));
                  }, 50);
                }}
              />

              {/* Center Content: Empty Canvas OR Code / Preview / Split */}
              <div className="flex-1 min-h-0 min-w-0 relative overflow-hidden">
                {/* EMPTY PROJECT OVERVIEW (No fake files!) */}
                {projectStatus === 'empty' && viewMode === 'code' && (
                  <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-[#090a14] select-none">
                    <div className="max-w-md mx-auto space-y-5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mx-auto shadow-2xl">
                        <Code2 className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          Empty Project: {project.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          No files created yet. Choose how you want to build this application:
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        <button
                          type="button"
                          onClick={() => {
                            setAiMode('build');
                            setShowAiPanel(true);
                          }}
                          className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 hover:bg-indigo-950/40 p-3.5 transition group"
                        >
                          <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs mb-1">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                            <span>AI Build Mode</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Describe your entire app (Next.js, Python, React, etc.) in the AI Assistant on the right.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setWorkspace('product')}
                          className="rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] p-3.5 transition group"
                        >
                          <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs mb-1">
                            <Compass className="h-3.5 w-3.5 text-purple-400" />
                            <span>Product Manager</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Define Vision, Personas, MVP, Features, and Roadmap before building.
                          </p>
                        </button>
                      </div>

                      <div className="pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleCreateFile('app/page.tsx')}
                          className="text-xs text-slate-400 hover:text-white gap-1.5"
                        >
                          <FilePlus className="h-3.5 w-3.5" />
                          <span>Or create file manually</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1. CODE ONLY VIEW */}
                {projectStatus === 'ready' && viewMode === 'code' && (
                  <div className="h-full w-full p-2.5 min-w-0 min-h-0 overflow-hidden">
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
                    webcontainerUrl={webcontainerUrl}
                    onSwitchToTerminal={() => {
                      setShowTerminal(true);
                      setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                        window.dispatchEvent(new Event('monaco-layout'));
                      }, 50);
                    }}
                  />
                )}

                {/* 3. SPLIT VIEW (Code + Preview side-by-side) */}
                {viewMode === 'split' && (
                  <div className="h-full w-full grid grid-cols-2 overflow-hidden min-w-0 min-h-0">
                    <div className="h-full w-full p-2 border-r border-white/10 min-w-0 min-h-0 overflow-hidden">
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

                    <div className="h-full w-full min-w-0 min-h-0 overflow-hidden">
                      <LivePreview
                        files={files}
                        dependencies={dependencies}
                        controlledViewport={viewport}
                        onPreviewError={setPreviewError}
                        onFixWithAI={fixWithAI}
                        webcontainerUrl={webcontainerUrl}
                        onSwitchToTerminal={() => {
                          setShowTerminal(true);
                          setTimeout(() => {
                            window.dispatchEvent(new Event('resize'));
                            window.dispatchEvent(new Event('monaco-layout'));
                          }, 50);
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 4. TERMINAL ONLY VIEW IN CENTER (Fallback) */}
                {viewMode === 'terminal' && (
                  <TerminalPanel
                    files={files}
                    onServerReady={(url) => setWebcontainerUrl(url)}
                    onErrorDetected={(err) => setPreviewError(err)}
                    onClose={() => setViewMode('code')}
                  />
                )}
              </div>
            </div>

            {/* Drag Handle: Center to Assistant */}
            {showAiPanel && (
              <div
                onMouseDown={handleAssistantMouseDown}
                className="w-1 h-full cursor-col-resize bg-white/5 hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors select-none z-10 flex items-center justify-center group"
                title="Drag to resize AI Assistant"
              >
                <div className="w-0.5 h-6 rounded bg-slate-600 group-hover:bg-indigo-300" />
              </div>
            )}

            {/* Panel 3: AI Assistant (min 320px, max 480px, default 360px) */}
            {showAiPanel && (
              <div
                className="h-full min-h-0 min-w-0 overflow-hidden flex flex-col bg-[#0a0b16] border-l border-white/10"
                style={{ width: `${assistantWidth}px`, minWidth: '320px', maxWidth: '480px' }}
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
                />
              </div>
            )}
          </div>

          {/* Bottom Panel: Terminal (default around 220px, resizable) */}
          {showTerminal && (
            <>
              {/* Drag Handle: Upper Workspace to Terminal */}
              <div
                onMouseDown={handleTerminalMouseDown}
                className="h-1 w-full cursor-row-resize bg-white/10 hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors select-none z-10 flex items-center justify-center group shrink-0"
                title="Drag to resize Terminal"
              >
                <div className="h-0.5 w-12 rounded bg-slate-600 group-hover:bg-indigo-300" />
              </div>

              {/* Terminal Container */}
              <div
                className="w-full shrink-0 overflow-hidden border-t border-white/10"
                style={{ height: `${terminalHeight}px`, minHeight: '140px', maxHeight: '50vh' }}
              >
                <TerminalPanel
                  files={files}
                  onServerReady={(url) => setWebcontainerUrl(url)}
                  onErrorDetected={(err) => setPreviewError(err)}
                  onClose={() => {
                    setShowTerminal(false);
                    setTimeout(() => {
                      window.dispatchEvent(new Event('resize'));
                      window.dispatchEvent(new Event('monaco-layout'));
                    }, 50);
                  }}
                />
              </div>
            </>
          )}
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
        onToggleTerminal={() => {
          setShowTerminal((prev) => !prev);
          setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        }}
        onSelectAiMode={(m) => {
          if (m === 'build' || m === 'code' || m === 'debug') {
            setAiMode(m);
            setShowAiPanel(true);
          }
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