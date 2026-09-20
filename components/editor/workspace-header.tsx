'use client';

import React from 'react';
import Link from 'next/link';
import {
  Code2,
  FolderTree,
  MessageSquareCode,
  Play,
  Save,
  Sparkles,
  Check,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Project } from '@/lib/types/database';

interface WorkspaceHeaderProps {
  project: Project | null;
  activePath: string;
  dirty: boolean;
  isWorking: boolean;
  onSave: () => void | Promise<unknown>;
  tab: 'preview' | 'code';
  setTab: (tab: 'preview' | 'code') => void;
  showFiles: boolean;
  onToggleFiles: () => void;
  showPrompt: boolean;
  onTogglePrompt: () => void;
}

export function WorkspaceHeader({
  project,
  activePath,
  dirty,
  isWorking,
  onSave,
  tab,
  setTab,
  showFiles,
  onToggleFiles,
  showPrompt,
  onTogglePrompt,
}: WorkspaceHeaderProps) {
  return (
    <header className="relative flex h-12 shrink-0 items-center justify-between bg-[var(--ide-bg-elevated)] px-4 select-none">
      {/* Bottom border with subtle glow when AI is active */}
      <div
        className={`absolute inset-x-0 bottom-0 h-px transition-all duration-500 ${
          isWorking
            ? 'bg-gradient-to-r from-transparent via-[var(--ide-accent)] to-transparent opacity-60'
            : 'bg-[var(--ide-border)]'
        }`}
      />

      {/* Left: Brand + Project + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-lg py-1 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-500/90 to-purple-600 shadow-md transition-shadow duration-500 ${
              isWorking
                ? 'shadow-indigo-500/40 animate-pulse-glow'
                : 'shadow-indigo-500/20'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="hidden sm:inline font-bold tracking-tight text-white">
            Codatron
          </span>
        </Link>

        <ChevronRight className="h-3.5 w-3.5 text-[var(--ide-text-faint)] hidden sm:block" />

        {/* Project Name + Model */}
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="truncate text-[13px] font-semibold text-[var(--ide-text-primary)]">
            {project?.name ?? 'Loading…'}
          </h1>
          <Badge
            variant="outline"
            className="hidden md:inline-flex border-indigo-500/25 bg-indigo-500/8 text-[10px] font-medium text-indigo-300 py-0 px-1.5"
          >
            Gemini Flash
          </Badge>
        </div>

        {activePath && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs min-w-0">
            <ChevronRight className="h-3 w-3 shrink-0 text-[var(--ide-text-faint)]" />
            <span className="font-mono text-[11px] text-[var(--ide-text-muted)] truncate max-w-[200px]">
              {activePath}
            </span>
          </div>
        )}
      </div>

      {/* Center: View Switcher with sliding pill */}
      <div className="flex items-center rounded-lg border border-[var(--ide-border)] bg-[var(--ide-bg-surface)] p-0.5 gap-0.5">
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`relative flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
            tab === 'preview'
              ? 'bg-[var(--ide-accent)] text-white shadow-sm shadow-indigo-500/25'
              : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text-primary)] hover:bg-white/5'
          }`}
        >
          <Play className="h-3 w-3" />
          <span>Preview</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('code')}
          className={`relative flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
            tab === 'code'
              ? 'bg-[var(--ide-accent)] text-white shadow-sm shadow-indigo-500/25'
              : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text-primary)] hover:bg-white/5'
          }`}
        >
          <Code2 className="h-3 w-3" />
          <span>Code</span>
          {dirty && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Right: Panel Toggles + Save Status + Save Button */}
      <div className="flex items-center gap-1.5">
        {/* AI Working Indicator */}
        {isWorking && (
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/8 px-2.5 py-1 mr-1">
            <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
            <span className="text-[11px] font-medium text-indigo-300">Generating…</span>
          </div>
        )}

        {/* Toggle Files Panel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFiles}
              className={`h-8 w-8 p-0 transition-all duration-200 ${
                showFiles
                  ? 'bg-white/8 text-white shadow-sm'
                  : 'text-[var(--ide-text-muted)] hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderTree className="h-4 w-4" />
              <span className="sr-only">Toggle File Explorer</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {showFiles ? 'Hide Files' : 'Show Files'}
          </TooltipContent>
        </Tooltip>

        {/* Toggle Prompt Panel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onTogglePrompt}
              className={`h-8 w-8 p-0 transition-all duration-200 ${
                showPrompt
                  ? 'bg-white/8 text-white shadow-sm'
                  : 'text-[var(--ide-text-muted)] hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquareCode className="h-4 w-4" />
              <span className="sr-only">Toggle AI Prompt</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {showPrompt ? 'Hide AI' : 'Show AI'}
          </TooltipContent>
        </Tooltip>

        {/* Dirty State Badge */}
        <div className="hidden sm:flex items-center ml-1">
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/8 px-2.5 py-1 text-[10px] font-medium text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Unsaved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
              <Check className="h-3 w-3 text-emerald-400" />
              Saved
            </span>
          )}
        </div>

        {/* Save Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onSave()}
              disabled={!dirty || isWorking}
              className={`h-8 text-xs transition-all duration-200 border-[var(--ide-border)] ${
                dirty
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-white hover:border-indigo-500/40'
                  : 'text-[var(--ide-text-faint)] hover:bg-white/5 hover:text-[var(--ide-text-secondary)]'
              }`}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              <span>Save</span>
              <kbd className="hidden lg:inline ml-1.5 text-[9px] font-mono opacity-50">⌘S</kbd>
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
