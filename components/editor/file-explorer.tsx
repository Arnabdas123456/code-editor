'use client';

import React, { useMemo, useState } from 'react';
import {
  FileCode,
  FileJson,
  FileText,
  Search,
  Hash,
  Layers,
  FolderOpen,
  Settings,
  Image as ImageIcon,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { ProjectFile } from '@/lib/types/database';

interface FileExplorerProps {
  files: ProjectFile[];
  activePath: string;
  dirty: boolean;
  onOpenFile: (file: ProjectFile) => void;
}

function getFileIcon(path: string) {
  if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
    return <Layers className="h-3.5 w-3.5 text-cyan-400 shrink-0" />;
  }
  if (path.endsWith('.ts') || path.endsWith('.js')) {
    return <FileCode className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
  }
  if (path.endsWith('.json')) {
    return <FileJson className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  }
  if (path.endsWith('.css') || path.endsWith('.scss')) {
    return <Hash className="h-3.5 w-3.5 text-pink-400 shrink-0" />;
  }
  if (path.endsWith('.svg') || path.endsWith('.png') || path.endsWith('.ico')) {
    return <ImageIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  }
  if (path.endsWith('.config.ts') || path.endsWith('.config.js') || path === 'next.config.js') {
    return <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
  }
  return <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
}

export function FileExplorer({
  files,
  activePath,
  dirty,
  onOpenFile,
}: FileExplorerProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const filteredFiles = useMemo(() => {
    if (!filterQuery.trim()) return files;
    const query = filterQuery.toLowerCase();
    return files.filter(
      (f) =>
        f.path.toLowerCase().includes(query) ||
        f.name.toLowerCase().includes(query)
    );
  }, [files, filterQuery]);

  const nonFolderCount = useMemo(
    () => files.filter((f) => !f.is_folder).length,
    [files]
  );

  return (
    <aside className="flex h-full flex-col bg-[var(--ide-bg-surface)] border-r border-[var(--ide-border)] text-xs select-none">
      {/* Explorer Top Bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--ide-border)] px-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-[var(--ide-text-muted)]">
            Explorer
          </span>
          <Badge
            variant="secondary"
            className="h-[18px] px-1.5 text-[10px] font-mono bg-white/5 text-[var(--ide-text-muted)] hover:bg-white/5 border-0"
          >
            {nonFolderCount}
          </Badge>
        </div>
      </div>

      {/* Quick Search / Filter */}
      <div className="p-2 border-b border-[var(--ide-border-subtle)]">
        <div
          className={`relative flex items-center rounded-lg border transition-all duration-200 ${
            searchFocused
              ? 'border-[var(--ide-border-focus)] bg-white/[0.04] shadow-[0_0_0_1px_rgba(99,102,241,0.1)]'
              : 'border-[var(--ide-border)] bg-white/[0.02]'
          }`}
        >
          <Search
            className={`absolute left-2.5 h-3 w-3 pointer-events-none transition-colors ${
              searchFocused ? 'text-indigo-400' : 'text-[var(--ide-text-faint)]'
            }`}
          />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Filter files…"
            className="w-full bg-transparent py-1.5 pl-7 pr-2 text-xs text-[var(--ide-text-primary)] placeholder:text-[var(--ide-text-faint)] outline-none"
          />
        </div>
      </div>

      {/* File List */}
      <ScrollArea className="flex-1 p-1.5">
        {filteredFiles.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--ide-text-faint)]">
            No files match &quot;{filterQuery}&quot;
          </div>
        ) : (
          <div className="space-y-px">
            {filteredFiles.map((file) => {
              if (file.is_folder) {
                return (
                  <div
                    key={file.path}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-[var(--ide-text-muted)] font-medium text-[11px] rounded-md"
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-indigo-400/70" />
                    <span>{file.name}</span>
                  </div>
                );
              }

              const isActive = activePath === file.path;
              const isModified = isActive && dirty;

              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => onOpenFile(file)}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2 py-[6px] text-left text-xs transition-all duration-150 relative ${
                    isActive
                      ? 'bg-indigo-500/10 text-indigo-200'
                      : 'text-[var(--ide-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--ide-text-primary)]'
                  }`}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                  )}

                  {getFileIcon(file.path)}

                  <span className="truncate font-mono text-[11px]">
                    {file.path}
                  </span>

                  {isModified && (
                    <span
                      className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.5)]"
                      title="Unsaved changes"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
