'use client';

import React from 'react';
import {
  AlertTriangle,
  Code2,
  FileCode,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BorderBeam } from '@/components/ui/border-beam';

interface PromptPanelProps {
  prompt: string;
  setPrompt: (value: string) => void;
  activePath: string;
  selectedCode: string;
  onClearSelectedCode?: () => void;
  previewError: string;
  onClearPreviewError?: () => void;
  isWorking: boolean;
  onGenerate: () => void | Promise<unknown>;
}

const QUICK_PROMPTS = [
  'Add dark mode toggle',
  'Improve mobile responsive layout',
  'Add smooth hover animations',
  'Create pricing cards with checkout button',
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
}: PromptPanelProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isWorking && prompt.trim()) {
        void onGenerate();
      }
    }
  };

  return (
    <section className="flex h-full flex-col bg-[#0b0d18] border-r border-white/10 text-xs text-slate-200">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 px-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-300">
            Build with AI
          </span>
        </div>
        <Badge
          variant="outline"
          className="border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-300 py-0"
        >
          Gemini 2.5
        </Badge>
      </div>

      <div className="flex-1 flex flex-col p-3.5 min-h-0 space-y-3">
        {/* Context Information Chips */}
        <div className="space-y-1.5 shrink-0">
          {activePath ? (
            <div className="flex items-center justify-between gap-1 rounded-md bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 truncate">
                <FileCode className="h-3 w-3 text-blue-400 shrink-0" />
                <span className="truncate">Target: <strong className="font-mono text-slate-300">{activePath}</strong></span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-[11px] text-slate-500">
              <span>Full project context automatically selected</span>
            </div>
          )}

          {selectedCode && (
            <div className="flex items-center justify-between gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-300">
              <span className="flex items-center gap-1.5 truncate">
                <Code2 className="h-3 w-3 text-cyan-400 shrink-0" />
                <span>Code snippet selected ({selectedCode.length} chars)</span>
              </span>
              {onClearSelectedCode && (
                <button
                  type="button"
                  onClick={onClearSelectedCode}
                  className="rounded p-0.5 hover:bg-cyan-500/20 text-cyan-400"
                  title="Clear snippet selection"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {previewError && (
            <div className="flex items-center justify-between gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-300">
              <span className="flex items-center gap-1.5 truncate">
                <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                <span className="truncate">Preview error attached for repair</span>
              </span>
              {onClearPreviewError && (
                <button
                  type="button"
                  onClick={onClearPreviewError}
                  className="rounded p-0.5 hover:bg-red-500/20 text-red-400"
                  title="Dismiss error context"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Prompt Input Container with BorderBeam during active generation */}
        <div className="relative flex-1 flex flex-col rounded-xl border border-white/10 bg-slate-950/60 p-1 focus-within:border-violet-500/50 transition">
          {isWorking && (
            <BorderBeam
              size={80}
              duration={4}
              colorFrom="#8b5cf6"
              colorTo="#3b82f6"
            />
          )}

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isWorking}
            placeholder="Ask Gemini to generate components, refine styling, fix bugs, or build new pages… (Ctrl+Enter to send)"
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
              className="h-7 gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-xs font-medium text-white shadow-md shadow-indigo-500/20 hover:brightness-110 active:scale-95 disabled:opacity-50 transition"
            >
              {isWorking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing…</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>Generate</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="shrink-0 space-y-1.5 pt-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Suggested ideas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((quickText) => (
              <button
                key={quickText}
                type="button"
                disabled={isWorking}
                onClick={() => setPrompt(quickText)}
                className="rounded-md border border-white/5 bg-white/5 px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-200 active:scale-95 transition"
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
