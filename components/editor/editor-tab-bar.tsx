'use client';

import React from 'react';
import {
  Code2,
  FileCode,
  FileJson,
  FileText,
  Hash,
  Layers,
  Play,
  Smartphone,
  Tablet,
  Monitor,
  Columns2,
  X,
  Plus,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ProjectFile } from '@/lib/types/database';

import { Terminal as TerminalIcon } from 'lucide-react';

export type WorkspaceViewMode = 'code' | 'preview' | 'split' | 'terminal';
export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface EditorTabBarProps {
  files: ProjectFile[];
  openTabs: string[];
  activePath: string;
  dirtyPaths: Set<string>;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  viewMode: WorkspaceViewMode;
  setViewMode: (mode: WorkspaceViewMode) => void;
  viewport: ViewportMode;
  setViewport: (viewport: ViewportMode) => void;
  showTerminal?: boolean;
  onToggleTerminal?: () => void;
}

function getFileIcon(path: string) {
  if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
    return <Layers className="h-3.5 w-3.5 text-cyan-400 shrink-0" />;
  }
  if (path.endsWith('.ts')) {
    return <FileCode className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
  }
  if (path.endsWith('.js') || path.endsWith('.mjs')) {
    return <FileCode className="h-3.5 w-3.5 text-yellow-400 shrink-0" />;
  }
  if (path.endsWith('.py')) {
    return <FileCode className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  }
  if (path.endsWith('.java')) {
    return <FileCode className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
  }
  if (path.endsWith('.cpp') || path.endsWith('.cc') || path.endsWith('.cxx') || path.endsWith('.h') || path.endsWith('.hpp') || path.endsWith('.c')) {
    return <FileCode className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
  }
  if (path.endsWith('.go')) {
    return <FileCode className="h-3.5 w-3.5 text-teal-400 shrink-0" />;
  }
  if (path.endsWith('.rs')) {
    return <FileCode className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  }
  if (path.endsWith('.json')) {
    return <FileJson className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  }
  if (path.endsWith('.css') || path.endsWith('.scss')) {
    return <Hash className="h-3.5 w-3.5 text-pink-400 shrink-0" />;
  }
  if (path.endsWith('.md') || path.endsWith('.markdown')) {
    return <FileText className="h-3.5 w-3.5 text-indigo-300 shrink-0" />;
  }
  return <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
}

export function EditorTabBar({
  files,
  openTabs,
  activePath,
  dirtyPaths,
  onSelectTab,
  onCloseTab,
  viewMode,
  setViewMode,
  viewport,
  setViewport,
  showTerminal,
  onToggleTerminal,
}: EditorTabBarProps) {
  // Breadcrumb segments derived from activePath
  const breadcrumbs = activePath ? activePath.split('/') : [];

  // All non-folder files for the quick "+" open dropdown
  const unopenedFiles = files.filter(
    (f) => !f.is_folder && !openTabs.includes(f.path)
  );

  return (
    <div className="flex flex-col border-b border-white/10 bg-[#0c0e1a] select-none shrink-0">
      {/* Upper Row: Tabs Bar & View Switchers */}
      <div className="flex h-10 items-center justify-between px-2 overflow-hidden">
        {/* Left: Tab Items */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[65%]">
          {openTabs.map((path) => {
            const isActive = activePath === path;
            const isDirty = dirtyPaths.has(path);
            const fileName = path.split('/').pop() || path;

            return (
              <div
                key={path}
                className={`group flex h-8 items-center gap-2 rounded-t-md px-3 text-xs font-medium transition cursor-pointer border-t border-x ${
                  isActive
                    ? 'border-white/10 bg-[#121324] text-white shadow-sm'
                    : 'border-transparent bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
                onClick={() => onSelectTab(path)}
              >
                {getFileIcon(path)}
                <span className="truncate max-w-[120px] font-mono text-[11px]">{fileName}</span>

                {/* Dirty indicator or close button */}
                <div className="flex items-center ml-1">
                  {isDirty && (
                    <span
                      className="h-2 w-2 rounded-full bg-amber-400 group-hover:hidden"
                      title="Unsaved changes"
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(path);
                    }}
                    className={`rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white transition ${
                      isDirty ? 'hidden group-hover:flex' : 'flex'
                    }`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* "+" Quick Add Tab dropdown */}
          {unopenedFiles.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/5 hover:text-slate-200 transition"
                  title="Open another file in tab"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-64 overflow-y-auto bg-[#121324] border-white/10 text-slate-200 text-xs">
                {unopenedFiles.map((f) => (
                  <DropdownMenuItem
                    key={f.path}
                    onClick={() => onSelectTab(f.path)}
                    className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
                  >
                    {getFileIcon(f.path)}
                    <span className="font-mono text-[11px]">{f.path}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Right: Code / Preview / Split Mode Switcher + Viewport Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Viewport controls when in preview or split mode */}
          {viewMode !== 'code' && (
            <div className="hidden sm:flex items-center rounded-lg border border-white/10 bg-white/[0.02] p-0.5 gap-0.5 mr-1">
              <button
                type="button"
                onClick={() => setViewport('desktop')}
                className={`p-1 rounded transition ${
                  viewport === 'desktop'
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Desktop viewport"
              >
                <Monitor className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setViewport('tablet')}
                className={`p-1 rounded transition ${
                  viewport === 'tablet'
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tablet viewport (768px)"
              >
                <Tablet className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setViewport('mobile')}
                className={`p-1 rounded transition ${
                  viewport === 'mobile'
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Mobile viewport (390px)"
              >
                <Smartphone className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Mode pills */}
          <div className="flex items-center rounded-lg border border-white/10 bg-[#0e101f] p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'code'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Code2 className="h-3 w-3" />
              <span className="hidden md:inline">Code</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'preview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Play className="h-3 w-3 text-emerald-400" />
              <span className="hidden md:inline">Preview</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'split'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Columns2 className="h-3 w-3 text-cyan-400" />
              <span className="hidden md:inline">Split</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onToggleTerminal) {
                  onToggleTerminal();
                } else {
                  setViewMode('terminal');
                }
              }}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                showTerminal || viewMode === 'terminal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={showTerminal ? 'Hide Bottom Terminal' : 'Show Bottom Terminal'}
            >
              <TerminalIcon className="h-3 w-3 text-emerald-400" />
              <span className="hidden md:inline">Terminal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lower Row: Breadcrumbs (only when viewing code) */}
      {breadcrumbs.length > 0 && (viewMode === 'code' || viewMode === 'split') && (
        <div className="flex h-6 items-center gap-1.5 border-t border-white/5 px-3 text-[11px] text-slate-500 bg-[#090b14]">
          {breadcrumbs.map((segment, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-2.5 w-2.5 text-slate-600 shrink-0" />}
                <span
                  className={`font-mono truncate ${
                    isLast ? 'text-indigo-300 font-medium' : 'text-slate-400'
                  }`}
                >
                  {segment}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
