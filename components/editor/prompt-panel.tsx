'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Code2,
  FileCode,
  Loader2,
  Sparkles,
  X,
  Bug,
  Send,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BorderBeam } from '@/components/ui/border-beam';

export type AiMode = 'build' | 'code' | 'debug';

export interface PromptPanelProps {
  prompt: string;
  setPrompt: (value: string) => void;
  activePath: string;
  selectedCode: string;
  onClearSelectedCode?: () => void;
  previewError: string;
  onClearPreviewError?: () => void;
  isWorking: boolean;
  onGenerate: (overridePrompt?: string) => Promise<unknown> | void;
  projectId?: string;
  currentMode?: AiMode;
  onModeChange?: (mode: AiMode) => void;
}

const BUILD_SUGGESTIONS = [
  'Build a modern developer portfolio with hero, about, projects, skills, and contact',
  'Create a full SaaS analytics dashboard with chart widgets and stat cards',
  'Build a modern responsive landing page with testimonial carousels and pricing tiers',
  'Create a Python CLI tool with argument parsing and formatted table output',
];

const CODE_SUGGESTIONS = [
  'Refactor into clean reusable functional components',
  'Add smooth hover micro-animations and active states',
  'Improve TypeScript type safety and prop interfaces',
  'Add dark mode theme toggle and local storage persistence',
];

const DEBUG_SUGGESTIONS = [
  'Diagnose and fix the active preview/runtime error',
  'Fix TypeScript module resolution and missing import statements',
  'Repair hydration mismatch and client-side rendering issues',
  'Resolve package dependency conflict and dev server startup error',
];

export function PromptPanel({
  prompt,
  setPrompt,
  activePath,
  selectedCode,
  onClearSelectedCode,
  previewError,
  onClearPreviewError,
  isWorking,
  onGenerate,
  currentMode = 'build',
  onModeChange,
}: PromptPanelProps) {
  const [internalMode, setInternalMode] = useState<AiMode>(currentMode);
  const activeMode = onModeChange ? currentMode : internalMode;

  const handleSetMode = (nextMode: AiMode) => {
    setInternalMode(nextMode);
    onModeChange?.(nextMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isWorking && prompt.trim()) {
        void onGenerate();
      }
    }
  };

  const handleFixActiveError = () => {
    if (!previewError) return;
    handleSetMode('debug');
    const fixPrompt = `Diagnose and fix this error: ${previewError}`;
    setPrompt(fixPrompt);
    void onGenerate(fixPrompt);
  };

  return (
    <section className="flex h-full flex-col bg-[#0a0b16] border-l border-white/10 text-xs text-slate-200 select-none">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col border-b border-white/10 bg-[#0d0f20] px-3 pt-2 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-sm shadow-indigo-500/30">
              <Sparkles className="h-3 w-3 text-white" />
            </span>
            <span className="font-semibold text-xs text-white tracking-wide">
              AI Assistant
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-indigo-500/30 bg-indigo-500/10 text-[10px] text-indigo-300 py-0"
          >
            Gemini Flash
          </Badge>
        </div>

        {/* 3 AI Modes Segmented Control */}
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-black/40 border border-white/10 text-[11px]">
          <button
            type="button"
            onClick={() => handleSetMode('build')}
            className={`py-1 rounded-md font-medium transition flex items-center justify-center gap-1.5 ${
              activeMode === 'build'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
            title="Full application generation from prompt"
          >
            <Sparkles className="h-3 w-3" />
            <span>Build</span>
          </button>

          <button
            type="button"
            onClick={() => handleSetMode('code')}
            className={`py-1 rounded-md font-medium transition flex items-center justify-center gap-1.5 ${
              activeMode === 'code'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
            title="Targeted modifications and component edits"
          >
            <Code2 className="h-3 w-3" />
            <span>Code</span>
          </button>

          <button
            type="button"
            onClick={() => handleSetMode('debug')}
            className={`py-1 rounded-md font-medium transition flex items-center justify-center gap-1.5 ${
              activeMode === 'debug'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
            title="Diagnose and repair errors"
          >
            <Bug className="h-3 w-3" />
            <span>Debug</span>
          </button>
        </div>

        {/* Mode subtitle */}
        <div className="mt-1.5 text-[10px] text-slate-400">
          {activeMode === 'build' && (
            <span>Generates complete multi-file project architecture & files.</span>
          )}
          {activeMode === 'code' && (
            <span>Performs targeted edits, additions, and refactors on files.</span>
          )}
          {activeMode === 'debug' && (
            <span>Diagnoses runtime, build, terminal, or TypeScript errors.</span>
          )}
        </div>
      </div>

      {/* Main Composer Area */}
      <div className="flex-1 flex flex-col p-3 min-h-0 space-y-3">
        {/* Context chips */}
        <div className="space-y-1.5 shrink-0">
          {activePath ? (
            <div className="flex items-center justify-between gap-1 rounded-md bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 truncate">
                <FileCode className="h-3 w-3 text-blue-400 shrink-0" />
                <span className="truncate">
                  Active: <strong className="font-mono text-slate-300">{activePath}</strong>
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-[11px] text-slate-500">
              <span>Full project context automatically indexed</span>
            </div>
          )}

          {selectedCode && (
            <div className="flex items-center justify-between gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-300">
              <span className="flex items-center gap-1.5 truncate">
                <Code2 className="h-3 w-3 text-cyan-400 shrink-0" />
                <span>Selection ({selectedCode.length} chars)</span>
              </span>
              {onClearSelectedCode && (
                <button
                  type="button"
                  onClick={onClearSelectedCode}
                  className="rounded p-0.5 hover:bg-cyan-500/20 text-cyan-400"
                  title="Clear selection"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {previewError && (
            <div className="flex flex-col gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-300">
              <div className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                  <span>Error captured</span>
                </span>
                {onClearPreviewError && (
                  <button
                    type="button"
                    onClick={onClearPreviewError}
                    className="rounded p-0.5 hover:bg-red-500/20 text-red-400"
                    title="Dismiss error"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="font-mono text-[10px] text-red-200/80 line-clamp-2 bg-black/30 p-1 rounded">
                {previewError}
              </p>
              <Button
                size="sm"
                onClick={handleFixActiveError}
                disabled={isWorking}
                className="h-6 w-full bg-red-600 hover:bg-red-500 text-white text-[11px] font-medium gap-1.5 shadow-sm"
              >
                <Wrench className="h-3 w-3" />
                <span>Fix with AI Debug Agent</span>
              </Button>
            </div>
          )}
        </div>

        {/* Prompt Composer */}
        <div className="relative flex-1 flex flex-col rounded-xl border border-white/10 bg-slate-950/60 p-1 focus-within:border-indigo-500/50 transition">
          {isWorking && (
            <BorderBeam size={80} duration={4} colorFrom="#8b5cf6" colorTo="#3b82f6" />
          )}

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isWorking}
            placeholder={
              activeMode === 'build'
                ? 'Describe the complete app or feature to generate (e.g. Next.js portfolio, Python CLI, React dashboard)… (Ctrl+Enter)'
                : activeMode === 'code'
                ? 'Describe targeted changes or refactoring to perform on current files…'
                : 'Describe the bug to diagnose or paste terminal/console output…'
            }
            className="flex-1 w-full resize-none border-0 bg-transparent p-3 text-xs leading-relaxed text-slate-200 placeholder:text-slate-500 focus-visible:ring-0"
          />

          <div className="flex items-center justify-between border-t border-white/5 px-2.5 py-2">
            <span className="text-[10px] text-slate-500">
              Ctrl+Enter to send
            </span>

            <Button
              onClick={() => void onGenerate()}
              disabled={isWorking || !prompt.trim()}
              size="sm"
              className="h-7 gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 text-xs font-medium text-white shadow-md shadow-indigo-500/20 active:scale-95 disabled:opacity-50 transition"
            >
              {isWorking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing…</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {activeMode === 'build' ? 'Build App' : activeMode === 'code' ? 'Apply Code' : 'Debug Fix'}
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Suggestions Chips */}
        <div className="shrink-0 space-y-1.5 pt-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Suggested {activeMode} prompts
          </p>
          <div className="flex flex-col gap-1.5">
            {(activeMode === 'build'
              ? BUILD_SUGGESTIONS
              : activeMode === 'code'
              ? CODE_SUGGESTIONS
              : DEBUG_SUGGESTIONS
            ).map((quickText) => (
              <button
                key={quickText}
                type="button"
                disabled={isWorking}
                onClick={() => setPrompt(quickText)}
                className="rounded-md border border-white/5 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-200 active:scale-95 transition text-left truncate"
                title={quickText}
              >
                {quickText}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
