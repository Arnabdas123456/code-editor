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
  Monitor,
} from 'lucide-react';
import type { ProjectFile } from '@/lib/types/database';

interface EditorTabBarProps {
  activeFile: ProjectFile | null;
  dirty: boolean;
  tab: 'preview' | 'code';
  setTab: (tab: 'preview' | 'code') => void;
  mobile: boolean;
  setMobile: (mobile: boolean | ((prev: boolean) => boolean)) => void;
}

function getFileIcon(path: string) {
  if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
    return <Layers className="h-3.5 w-3.5 text-cyan-400" />;
  }
  if (path.endsWith('.ts') || path.endsWith('.js')) {
    return <FileCode className="h-3.5 w-3.5 text-blue-400" />;
  }
  if (path.endsWith('.json')) {
    return <FileJson className="h-3.5 w-3.5 text-amber-400" />;
  }
  if (path.endsWith('.css')) {
    return <Hash className="h-3.5 w-3.5 text-pink-400" />;
  }
  return <FileText className="h-3.5 w-3.5 text-slate-400" />;
}

export function EditorTabBar({
  activeFile,
  dirty,
  tab,
  setTab,
  mobile,
  setMobile,
}: EditorTabBarProps) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d0f1a] px-3 select-none">
      {/* Left: Tab selectors */}
      <div className="flex items-center gap-1.5 h-full">
        {/* Code Tab (Active File) */}
        <button
          type="button"
          onClick={() => setTab('code')}
          className={`flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium transition border ${
            tab === 'code'
              ? 'border-white/10 bg-white/10 text-white shadow-sm'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          {activeFile ? getFileIcon(activeFile.path) : <Code2 className="h-3.5 w-3.5" />}
          <span>{activeFile?.name ?? 'Code Editor'}</span>
          {dirty && (
            <span
              className="h-2 w-2 rounded-full bg-amber-400"
              title="Unsaved changes"
            />
          )}
        </button>

        {/* Live Preview Tab */}
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition border ${
            tab === 'preview'
              ? 'border-white/10 bg-white/10 text-white shadow-sm'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Play className="h-3.5 w-3.5 text-emerald-400" />
          <span>Live Preview</span>
        </button>
      </div>

      {/* Right: Quick actions for current view */}
      <div className="flex items-center gap-2">
        {tab === 'preview' && (
          <button
            type="button"
            onClick={() => setMobile((prev) => !prev)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 transition"
            title={mobile ? 'Switch to desktop view' : 'Switch to mobile view'}
          >
            {mobile ? (
              <>
                <Monitor className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Desktop</span>
              </>
            ) : (
              <>
                <Smartphone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mobile</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
