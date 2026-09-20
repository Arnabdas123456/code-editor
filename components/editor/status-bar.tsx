'use client';

import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  Play,
} from 'lucide-react';

export interface StatusBarProps {
  dirty: boolean;
  language: string;
  cursorLine: number;
  cursorCol: number;
  previewError: string | null;
  isWorking: boolean;
  onOpenPreviewError?: () => void;
}

export function StatusBar({
  dirty,
  language,
  cursorLine,
  cursorCol,
  previewError,
  isWorking,
  onOpenPreviewError,
}: StatusBarProps) {
  const formatLanguage = (lang: string) => {
    switch (lang.toLowerCase()) {
      case 'typescript':
      case 'tsx':
        return 'TypeScript React';
      case 'javascript':
      case 'jsx':
        return 'JavaScript React';
      case 'json':
        return 'JSON';
      case 'css':
        return 'CSS';
      case 'html':
        return 'HTML';
      default:
        return lang || 'Plain Text';
    }
  };

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-white/10 bg-[#090a14] px-3 text-[11px] text-slate-400 select-none z-10">
      {/* Left side items */}
      <div className="flex items-center gap-3">
        {/* Saved state */}
        <div className="flex items-center gap-1.5">
          {dirty ? (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Unsaved Changes</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400/90 font-medium">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span>Saved</span>
            </span>
          )}
        </div>

        <span className="text-slate-600">•</span>

        {/* Language */}
        <span className="font-mono text-slate-300">{formatLanguage(language)}</span>

        <span className="text-slate-600">•</span>

        {/* Cursor Position */}
        <span className="font-mono text-slate-400">
          Ln {cursorLine}, Col {cursorCol}
        </span>
      </div>

      {/* Right side items */}
      <div className="flex items-center gap-3">
        {/* Preview State */}
        {previewError ? (
          <button
            type="button"
            onClick={onOpenPreviewError}
            className="flex items-center gap-1.5 text-red-400 hover:underline"
            title="Click to view error and fix with AI"
          >
            <AlertCircle className="h-3 w-3" />
            <span>Preview Error</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-400/80">
            <Play className="h-2.5 w-2.5 text-emerald-400" />
            <span>Preview Ready</span>
          </div>
        )}

        <span className="text-slate-600">•</span>

        {/* AI Agent Status */}
        {isWorking ? (
          <div className="flex items-center gap-1.5 text-indigo-400 font-medium">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Gemini Generating…</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-indigo-400/80 font-medium">
            <Sparkles className="h-3 w-3 text-indigo-400" />
            <span>Gemini Flash</span>
          </div>
        )}

        <span className="text-slate-600">•</span>
        <span className="hidden sm:inline text-slate-500 font-mono">UTF-8</span>
      </div>
    </footer>
  );
}
