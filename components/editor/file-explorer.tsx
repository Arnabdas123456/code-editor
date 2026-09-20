'use client';

import React, { useMemo, useState } from 'react';
import {
  FileCode,
  FileJson,
  FileText,
  Search,
  Hash,
  Layers,
  Folder,
  FolderOpen,
  Settings,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  FilePlus,
  Trash2,
  Edit2,
  Copy,
  X,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { ProjectFile } from '@/lib/types/database';

export interface FileExplorerProps {
  files: ProjectFile[];
  activePath: string;
  dirtyPaths?: Set<string>;
  onOpenFile: (file: ProjectFile) => void;
  onCreateFile: (path: string) => Promise<void> | void;
  onCreateFolder: (path: string) => Promise<void> | void;
  onRenameFile: (file: ProjectFile, newPath: string) => Promise<void> | void;
  onDeleteFile: (file: ProjectFile) => Promise<void> | void;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  file?: ProjectFile;
  children: Map<string, TreeNode>;
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
  dirtyPaths = new Set(),
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
}: FileExplorerProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(['app', 'components', 'lib'])
  );

  // Dialog states
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [targetItem, setTargetItem] = useState<ProjectFile | null>(null);
  const [dialogInput, setDialogInput] = useState('');

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Build the hierarchical tree from files
  const rootTree = useMemo(() => {
    const root: TreeNode = {
      name: 'root',
      path: '',
      isFolder: true,
      children: new Map(),
    };

    for (const file of files) {
      const parts = file.path.split('/');
      let current = root;
      let accumulated = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        accumulated = accumulated ? `${accumulated}/${part}` : part;
        const isLast = i === parts.length - 1;

        if (!current.children.has(part)) {
          current.children.set(part, {
            name: part,
            path: accumulated,
            isFolder: !isLast || file.is_folder,
            file: isLast ? file : undefined,
            children: new Map(),
          });
        }
        current = current.children.get(part)!;
        if (isLast && !file.is_folder) {
          current.file = file;
          current.isFolder = false;
        }
      }
    }

    return root;
  }, [files]);

  const nonFolderCount = useMemo(
    () => files.filter((f) => !f.is_folder).length,
    [files]
  );

  // Handlers for File Actions
  const handleOpenCreateFile = (baseFolder?: string) => {
    setDialogInput(baseFolder ? `${baseFolder}/` : '');
    setIsNewFileDialogOpen(true);
  };

  const handleOpenCreateFolder = (baseFolder?: string) => {
    setDialogInput(baseFolder ? `${baseFolder}/` : '');
    setIsNewFolderDialogOpen(true);
  };

  const handleOpenRename = (file: ProjectFile) => {
    setTargetItem(file);
    setDialogInput(file.path);
    setIsRenameDialogOpen(true);
  };

  const handleOpenDelete = (file: ProjectFile) => {
    setTargetItem(file);
    setIsDeleteDialogOpen(true);
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    toast.success('Path copied to clipboard');
  };

  const confirmCreateFile = async () => {
    const trimmed = dialogInput.trim().replace(/^\/+/, '');
    if (!trimmed) return;
    setIsNewFileDialogOpen(false);
    await onCreateFile(trimmed);
  };

  const confirmCreateFolder = async () => {
    const trimmed = dialogInput.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!trimmed) return;
    setIsNewFolderDialogOpen(false);
    await onCreateFolder(trimmed);
  };

  const confirmRename = async () => {
    if (!targetItem) return;
    const trimmed = dialogInput.trim().replace(/^\/+/, '');
    if (!trimmed || trimmed === targetItem.path) {
      setIsRenameDialogOpen(false);
      return;
    }
    setIsRenameDialogOpen(false);
    await onRenameFile(targetItem, trimmed);
  };

  const confirmDelete = async () => {
    if (!targetItem) return;
    setIsDeleteDialogOpen(false);
    await onDeleteFile(targetItem);
  };

  // Render tree node recursively
  const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    // If filtering, check if node matches or has matching children
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      const matchesSelf = node.path.toLowerCase().includes(q) || node.name.toLowerCase().includes(q);
      const hasMatchingChild = (n: TreeNode): boolean => {
        if (n.path.toLowerCase().includes(q) || n.name.toLowerCase().includes(q)) return true;
        for (const child of Array.from(n.children.values())) {
          if (hasMatchingChild(child)) return true;
        }
        return false;
      };

      if (!matchesSelf && !hasMatchingChild(node)) {
        return null;
      }
    }

    const isFolder = node.isFolder;
    const isExpanded = filterQuery.trim() ? true : expandedFolders.has(node.path);
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
      if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
      return a.isFolder ? -1 : 1;
    });

    if (isFolder) {
      return (
        <div key={node.path} className="w-full">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <button
                type="button"
                onClick={() => toggleFolder(node.path)}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                className="group flex w-full items-center gap-1.5 py-1 text-left text-xs text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] rounded-md transition-all duration-150"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="h-3.5 w-3.5 text-indigo-400/90 shrink-0" />
                ) : (
                  <Folder className="h-3.5 w-3.5 text-indigo-400/80 shrink-0" />
                )}
                <span className="font-medium truncate text-[11px]">{node.name}</span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48 bg-[#121324] border-white/10 text-slate-200 text-xs">
              <ContextMenuItem
                onClick={() => handleOpenCreateFile(node.path)}
                className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
              >
                <FilePlus className="h-3.5 w-3.5" />
                <span>New File Here</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleOpenCreateFolder(node.path)}
                className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>New Folder Here</span>
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-white/10" />
              <ContextMenuItem
                onClick={() => handleCopyPath(node.path)}
                className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Path</span>
              </ContextMenuItem>
              {node.file && (
                <>
                  <ContextMenuItem
                    onClick={() => handleOpenRename(node.file!)}
                    className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Rename Folder</span>
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => handleOpenDelete(node.file!)}
                    className="gap-2 cursor-pointer text-red-400 focus:bg-red-600 focus:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Folder</span>
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>

          {isExpanded && (
            <div className="w-full">
              {sortedChildren.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // File Node
    const file = node.file!;
    const isActive = activePath === file.path;
    const isDirty = dirtyPaths.has(file.path);

    return (
      <ContextMenu key={file.path}>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => onOpenFile(file)}
            style={{ paddingLeft: `${depth * 12 + 18}px` }}
            className={`group relative flex w-full items-center gap-2 py-[5px] pr-2 text-left text-xs transition-all duration-150 rounded-md ${
              isActive
                ? 'bg-indigo-500/15 text-indigo-200 font-medium'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
            }`}
          >
            {isActive && (
              <span className="absolute left-0.5 top-1.5 bottom-1.5 w-[3px] rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
            )}

            {getFileIcon(file.path)}

            <span className="truncate font-mono text-[11px]">{node.name}</span>

            {isDirty && (
              <span
                className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.6)] animate-pulse"
                title="Unsaved changes"
              />
            )}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48 bg-[#121324] border-white/10 text-slate-200 text-xs">
          <ContextMenuItem
            onClick={() => onOpenFile(file)}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Open</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => handleCopyPath(file.path)}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copy Path</span>
          </ContextMenuItem>
          <ContextMenuSeparator className="bg-white/10" />
          <ContextMenuItem
            onClick={() => handleOpenRename(file)}
            className="gap-2 cursor-pointer focus:bg-indigo-600 focus:text-white"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Rename</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => handleOpenDelete(file)}
            className="gap-2 cursor-pointer text-red-400 focus:bg-red-600 focus:text-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const rootChildren = Array.from(rootTree.children.values()).sort((a, b) => {
    if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
    return a.isFolder ? -1 : 1;
  });

  return (
    <aside className="flex h-full flex-col bg-[#0b0c16] border-r border-white/10 text-xs select-none">
      {/* Explorer Top Header Bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 px-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">
            Files
          </span>
          <Badge
            variant="secondary"
            className="h-[18px] px-1.5 text-[10px] font-mono bg-white/5 text-slate-400 hover:bg-white/5 border-0"
          >
            {nonFolderCount}
          </Badge>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenCreateFile()}
            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 hover:bg-white/5"
            title="New File"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenCreateFolder()}
            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 hover:bg-white/5"
            title="New Folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Filter / Search input */}
      <div className="p-2 border-b border-white/5">
        <div
          className={`relative flex items-center rounded-lg border transition-all duration-200 ${
            searchFocused
              ? 'border-indigo-500/50 bg-white/[0.04] shadow-[0_0_0_1px_rgba(99,102,241,0.2)]'
              : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <Search
            className={`absolute left-2.5 h-3 w-3 pointer-events-none transition-colors ${
              searchFocused ? 'text-indigo-400' : 'text-slate-500'
            }`}
          />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search files…"
            className="w-full bg-transparent py-1.5 pl-7 pr-7 text-xs text-slate-200 placeholder:text-slate-500 outline-none"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-2 text-slate-500 hover:text-slate-200"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* File Tree List */}
      <ScrollArea className="flex-1 p-1.5">
        {rootChildren.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No files in project
          </div>
        ) : (
          <div className="space-y-0.5">
            {rootChildren.map((child) => renderNode(child, 0))}
          </div>
        )}
      </ScrollArea>

      {/* Create File Dialog */}
      <Dialog open={isNewFileDialogOpen} onOpenChange={setIsNewFileDialogOpen}>
        <DialogContent className="bg-[#121324] border-white/10 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FilePlus className="h-4 w-4 text-indigo-400" />
              <span>Create New File</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              placeholder="e.g. components/Pricing.tsx"
              className="bg-black/30 border-white/10 text-xs font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmCreateFile();
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNewFileDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void confirmCreateFile()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
            >
              Create File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent className="bg-[#121324] border-white/10 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-indigo-400" />
              <span>Create New Folder</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              placeholder="e.g. components/pricing"
              className="bg-black/30 border-white/10 text-xs font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmCreateFolder();
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNewFolderDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void confirmCreateFolder()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
            >
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="bg-[#121324] border-white/10 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-indigo-400" />
              <span>Rename {targetItem?.is_folder ? 'Folder' : 'File'}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              className="bg-black/30 border-white/10 text-xs font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmRename();
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRenameDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void confirmRename()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#121324] border-white/10 text-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold text-red-400">
              Delete {targetItem?.is_folder ? 'Folder' : 'File'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-400">
              Are you sure you want to delete <strong className="text-white font-mono">{targetItem?.path}</strong>?
              {targetItem?.is_folder && ' All nested files will also be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-xs text-slate-300 hover:bg-white/5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-red-600 hover:bg-red-500 text-white text-xs"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
