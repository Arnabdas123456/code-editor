'use client';

import React from 'react';
import {
  Code2,
  Play,
  Columns2,
  Save,
  FilePlus,
  FolderPlus,
  Download,
  Sparkles,
  Bug,
  Lightbulb,
  FileCode,
  Layers,
  Terminal as TerminalIcon,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import type { ProjectFile } from '@/lib/types/database';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: ProjectFile[];
  onOpenFile: (file: ProjectFile) => void;
  onSave: () => void;
  onExportZip: () => void;
  onSelectViewMode: (mode: 'code' | 'preview' | 'split') => void;
  onToggleTerminal?: () => void;
  onSelectAiMode: (mode: 'build' | 'code' | 'debug' | 'product') => void;
  onNewFile: () => void;
  onNewFolder: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  files,
  onOpenFile,
  onSave,
  onExportZip,
  onSelectViewMode,
  onToggleTerminal,
  onSelectAiMode,
  onNewFile,
  onNewFolder,
}: CommandPaletteProps) {
  const sourceFiles = files.filter((f) => !f.is_folder);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search files…" />
      <CommandList className="bg-[#101222] text-slate-200 text-xs">
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              onSave();
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Save className="h-4 w-4" />
            <span>Save Current File</span>
            <kbd className="ml-auto text-[10px] font-mono opacity-60">Ctrl+S</kbd>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onNewFile();
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <FilePlus className="h-4 w-4" />
            <span>Create New File…</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onNewFolder();
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <FolderPlus className="h-4 w-4" />
            <span>Create New Folder…</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onExportZip();
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Download className="h-4 w-4" />
            <span>Export Project as ZIP</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="bg-white/10" />

        <CommandGroup heading="View Modes">
          <CommandItem
            onSelect={() => {
              onSelectViewMode('code');
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Code2 className="h-4 w-4 text-blue-400" />
            <span>Switch to Code View</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onSelectViewMode('preview');
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Play className="h-4 w-4 text-emerald-400" />
            <span>Switch to Live Preview</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onSelectViewMode('split');
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Columns2 className="h-4 w-4 text-cyan-400" />
            <span>Switch to Split View (Code + Preview)</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onToggleTerminal?.();
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <TerminalIcon className="h-4 w-4 text-emerald-400" />
            <span>Toggle Bottom Terminal Panel</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="bg-white/10" />

        <CommandGroup heading="AI Modes">
          <CommandItem
            onSelect={() => {
              onSelectAiMode('build');
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span>AI Build Mode</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onSelectAiMode('code');
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Code2 className="h-4 w-4 text-indigo-400" />
            <span>AI Code Edit Mode</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onSelectAiMode('debug');
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Bug className="h-4 w-4 text-red-400" />
            <span>AI Debug & Fix Mode</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onSelectAiMode('product');
              onOpenChange(false);
            }}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <span>AI Product Manager Mode</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="bg-white/10" />

        <CommandGroup heading="Files">
          {sourceFiles.slice(0, 15).map((file) => (
            <CommandItem
              key={file.path}
              onSelect={() => {
                onOpenFile(file);
                onOpenChange(false);
              }}
              className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
            >
              {file.path.endsWith('.tsx') ? (
                <Layers className="h-4 w-4 text-cyan-400" />
              ) : (
                <FileCode className="h-4 w-4 text-blue-400" />
              )}
              <span className="font-mono text-[11px]">{file.path}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
