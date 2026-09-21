'use client';

import React, { useState } from 'react';
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
  Play,
  Edit2,
  X,
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
  onRenameProject?: (newName: string) => Promise<void> | void;
  onRunPreview?: () => void;
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
  onRenameProject,
  onRunPreview,
}: WorkspaceHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const handleStartRename = () => {
    setNameInput(project?.name ?? 'Untitled Project');
    setIsEditingName(true);
  };

  const handleConfirmRename = async () => {
    if (!nameInput.trim()) {
      setIsEditingName(false);
      return;
    }
    if (onRenameProject && nameInput.trim() !== project?.name) {
      await onRenameProject(nameInput.trim());
    }
    setIsEditingName(false);
  };

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
            Codatron.ai
          </span>
        </Link>

        <ChevronRight className="h-3.5 w-3.5 text-slate-600 hidden sm:block" />

        {/* Project Name (Editable) */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleConfirmRename();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                autoFocus
                className="rounded border border-indigo-500/50 bg-black/60 px-2 py-0.5 text-xs text-white outline-none w-36 sm:w-48"
              />
              <button
                type="button"
                onClick={() => void handleConfirmRename()}
                className="rounded p-1 text-emerald-400 hover:bg-white/10"
                title="Save Name"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="rounded p-1 text-slate-400 hover:bg-white/10"
                title="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-1.5">
              <h1
                onClick={handleStartRename}
                className="truncate text-xs sm:text-[13px] font-semibold text-slate-100 max-w-[150px] sm:max-w-[220px] cursor-pointer hover:text-indigo-300 transition"
                title="Click to rename project"
              >
                {project?.name ?? 'Loading…'}
              </h1>
              <button
                type="button"
                onClick={handleStartRename}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-white transition"
                title="Rename Project"
              >
                <Edit2 className="h-2.5 w-2.5" />
              </button>
            </div>
          )}

          <Badge
            variant="outline"
            className="hidden md:inline-flex border-indigo-500/30 bg-indigo-500/10 text-[10px] font-medium text-indigo-300 py-0 px-1.5"
          >
            Gemini
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

      {/* Right: Actions, Run/Preview, Save, Export, Panel Toggles */}
      <div className="flex items-center gap-2">
        {/* Run / Preview button */}
        {onRunPreview && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onRunPreview}
                className="h-8 px-2.5 text-xs font-medium border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 gap-1.5"
              >
                <Play className="h-3 w-3 fill-emerald-400 text-emerald-400" />
                <span className="hidden sm:inline">Preview</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Run & Preview Application
            </TooltipContent>
          </Tooltip>
        )}

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
