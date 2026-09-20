'use client';

import React from 'react';
import Link from 'next/link';
import {
  FolderTree,
  MessageSquareCode,
  Save,
  Sparkles,
  Check,
  ChevronRight,
  Loader2,
  Download,
  Command,
  Code2,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Project } from '@/lib/types/database';

export interface WorkspaceHeaderProps {
  project: Project | null;
  activePath: string;
  dirty: boolean;
  isWorking: boolean;
  workspace?: 'developer' | 'product';
  onWorkspaceChange?: (ws: 'developer' | 'product') => void;
  onSave: () => void | Promise<unknown>;
  onExportZip: () => void | Promise<unknown>;
  onOpenCommandPalette: () => void;
  showFiles: boolean;
  onToggleFiles: () => void;
  showAiPanel: boolean;
  onToggleAiPanel: () => void;
}

export function WorkspaceHeader({
  project,
  activePath,
  dirty,
  isWorking,
  workspace = 'developer',
  onWorkspaceChange,
  onSave,
  onExportZip,
  onOpenCommandPalette,
  showFiles,
  onToggleFiles,
  showAiPanel,
  onToggleAiPanel,
}: WorkspaceHeaderProps) {
  return (
    <header className="relative flex h-12 shrink-0 items-center justify-between bg-[#0b0c18] border-b border-white/10 px-4 select-none z-10">
      {/* Bottom glowing line during active AI synthesis */}
      <div
        className={`absolute inset-x-0 bottom-0 h-[2px] transition-all duration-500 ${
          isWorking
            ? 'bg-gradient-to-r from-transparent via-indigo-500 to-purple-500 opacity-90 shadow-[0_0_10px_rgba(99,102,241,0.8)]'
            : 'bg-transparent'
        }`}
      />

      {/* Left: Brand + Project + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-lg py-1 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md transition-all duration-500 ${
              isWorking
                ? 'shadow-indigo-500/50 scale-105 ring-2 ring-indigo-400/50'
                : 'shadow-indigo-500/20'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="font-bold tracking-tight text-white hidden sm:inline">
            AI Studio
          </span>
        </Link>

        <ChevronRight className="h-3.5 w-3.5 text-slate-600 hidden sm:block" />

        {/* Project Name + Model */}
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="truncate text-xs sm:text-[13px] font-semibold text-slate-100 max-w-[150px] sm:max-w-[220px]">
            {project?.name ?? 'Loading…'}
          </h1>
          <Badge
            variant="outline"
            className="hidden md:inline-flex border-indigo-500/30 bg-indigo-500/10 text-[10px] font-medium text-indigo-300 py-0 px-1.5"
          >
            Gemini Flash
          </Badge>
        </div>
      </div>

      {/* Center: Workspace Switcher & Command Palette */}
      <div className="flex items-center gap-2">
        {onWorkspaceChange && (
          <div className="flex items-center rounded-lg bg-black/40 border border-white/10 p-0.5 shadow-inner">
            <button
              type="button"
              onClick={() => onWorkspaceChange('developer')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                workspace === 'developer'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Developer IDE</span>
            </button>
            <button
              type="button"
              onClick={() => onWorkspaceChange('product')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                workspace === 'product'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Product Manager</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden lg:flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
        >
          <Command className="h-3.5 w-3.5 text-slate-400" />
          <span>Command Palette…</span>
          <kbd className="rounded border border-white/10 bg-white/5 px-1 text-[10px] font-mono text-slate-400">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Actions, Panels, Save, Export */}
      <div className="flex items-center gap-2">
        {/* Toggle File Explorer */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFiles}
              className={`h-8 w-8 p-0 transition ${
                showFiles
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderTree className="h-4 w-4" />
              <span className="sr-only">Toggle Files</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {showFiles ? 'Hide Files' : 'Show Files'}
          </TooltipContent>
        </Tooltip>

        {/* Toggle AI Panel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleAiPanel}
              className={`h-8 w-8 p-0 transition ${
                showAiPanel
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquareCode className="h-4 w-4" />
              <span className="sr-only">Toggle AI Assistant</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {showAiPanel ? 'Hide AI Assistant' : 'Show AI Assistant'}
          </TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-white/10 mx-0.5 hidden sm:block" />

        {/* Export ZIP */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onExportZip()}
              className="h-8 px-2.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export ZIP</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Download full project as ZIP
          </TooltipContent>
        </Tooltip>

        {/* Save Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={() => void onSave()}
              disabled={!dirty || isWorking}
              className={`h-8 px-3 text-xs font-medium gap-1.5 transition shadow-sm ${
                dirty
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                  : 'bg-white/5 text-slate-500 hover:bg-white/5'
              }`}
            >
              {isWorking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>Save</span>
              <kbd className="hidden lg:inline text-[9px] font-mono opacity-60">⌘S</kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Save changes (Ctrl+S)
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
