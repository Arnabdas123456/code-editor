'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  RotateCcw,
  Trash2,
  AlertCircle,
  Play,
  Square,
  X,
  Server,
  TerminalSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProjectFile } from '@/lib/types/database';
import {
  webcontainerManager,
  type RuntimeState,
  type WebContainerRuntimeSnapshot,
} from '@/lib/runtime/webcontainer-manager';
import '@xterm/xterm/css/xterm.css';

export interface TerminalPanelProps {
  files: ProjectFile[];
  onServerReady?: (url: string) => void;
  onErrorDetected?: (error: string) => void;
  onClose?: () => void;
  className?: string;
}

export function TerminalPanel({
  files,
  onServerReady,
  onErrorDetected,
  onClose,
  className = '',
}: TerminalPanelProps) {
  const [activeTab, setActiveTab] = useState<'shell' | 'server'>('shell');
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<WebContainerRuntimeSnapshot>(
    webcontainerManager.getSnapshot()
  );

  const shellTerminalRef = useRef<HTMLDivElement>(null);
  const serverTerminalRef = useRef<HTMLDivElement>(null);

  const shellXterm = useRef<any>(null);
  const shellFitAddon = useRef<any>(null);
  const serverXterm = useRef<any>(null);
  const serverFitAddon = useRef<any>(null);

  // Subscribe to WebContainer snapshot updates
  useEffect(() => {
    const unsub = webcontainerManager.subscribeSnapshot((snap) => {
      setRuntimeSnapshot(snap);
      if (snap.previewUrl) {
        onServerReady?.(snap.previewUrl);
      }
      if (snap.lastError) {
        onErrorDetected?.(snap.lastError.message);
      }
    });
    return unsub;
  }, [onServerReady, onErrorDetected]);

  // Initialize Shell XTerm instance
  useEffect(() => {
    let term: any = null;
    let fitAddon: any = null;
    let disposed = false;

    async function initShell() {
      if (!shellTerminalRef.current) return;

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      term = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontSize: 12,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#0a0b16',
          foreground: '#e2e8f0',
          cursor: '#818cf8',
          selectionBackground: '#4338ca',
          black: '#0f172a',
          red: '#f87171',
          green: '#4ade80',
          yellow: '#facc15',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#38bdf8',
          white: '#f8fafc',
        },
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(shellTerminalRef.current);
      fitAddon.fit();

      shellXterm.current = term;
      shellFitAddon.current = fitAddon;

      term.writeln('\x1b[1;34m=== Codatron.ai Interactive Shell ===\x1b[0m');
      term.writeln('\x1b[90mConnected to WebContainer persistent kernel.\x1b[0m');

      // Forward user keystrokes directly to WebContainer persistent shell
      term.onData((data: string) => {
        webcontainerManager.writeShell(data);
      });

      // Subscribe to shell output
      const unsubShell = webcontainerManager.subscribeShellOutput((chunk) => {
        if (!disposed && term) {
          term.write(chunk);
        }
      });

      // Boot and initialize shell
      void webcontainerManager.boot();

      return () => {
        unsubShell();
      };
    }

    const cleanupPromise = initShell();

    return () => {
      disposed = true;
      void cleanupPromise.then((cleanup) => cleanup?.());
      try {
        term?.dispose();
      } catch {}
    };
  }, []);

  // Initialize Server Logs XTerm instance
  useEffect(() => {
    let term: any = null;
    let fitAddon: any = null;
    let disposed = false;

    async function initServerLogs() {
      if (!serverTerminalRef.current) return;

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      term = new Terminal({
        convertEol: true,
        cursorBlink: false,
        disableStdin: true,
        fontSize: 12,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#0a0b16',
          foreground: '#e2e8f0',
          selectionBackground: '#4338ca',
          black: '#0f172a',
          red: '#f87171',
          green: '#4ade80',
          yellow: '#facc15',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#38bdf8',
          white: '#f8fafc',
        },
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(serverTerminalRef.current);
      fitAddon.fit();

      serverXterm.current = term;
      serverFitAddon.current = fitAddon;

      term.writeln('\x1b[1;36m=== Codatron.ai Dev Server & Build Output ===\x1b[0m');

      // Subscribe to dev output
      const unsubDev = webcontainerManager.subscribeDevOutput((chunk) => {
        if (!disposed && term) {
          term.write(chunk);
        }
      });

      return () => {
        unsubDev();
      };
    }

    const cleanupPromise = initServerLogs();

    return () => {
      disposed = true;
      void cleanupPromise.then((cleanup) => cleanup?.());
      try {
        term?.dispose();
      } catch {}
    };
  }, []);

  // Refit when tab changes or window resizes
  useEffect(() => {
    const handleResize = () => {
      try {
        if (activeTab === 'shell') {
          shellFitAddon.current?.fit();
          const cols = shellXterm.current?.cols || 80;
          const rows = shellXterm.current?.rows || 24;
          webcontainerManager.resizeShell(cols, rows);
        } else {
          serverFitAddon.current?.fit();
        }
      } catch {}
    };

    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [activeTab]);

  const handleClear = () => {
    if (activeTab === 'shell') {
      shellXterm.current?.clear();
    } else {
      serverXterm.current?.clear();
    }
  };

  const handleRestart = () => {
    void webcontainerManager.restartDevServer(files);
  };

  const handleInterrupt = () => {
    webcontainerManager.sendInterrupt();
  };

  // Compute status badge styling
  const statusConfig = {
    idle: { label: 'Idle', color: 'border-slate-500/30 bg-slate-500/10 text-slate-400' },
    initializing: { label: 'Initializing', color: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
    ready: { label: 'Ready', color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
    mounting: { label: 'Mounting', color: 'border-purple-500/30 bg-purple-500/10 text-purple-300' },
    installing: { label: 'Installing', color: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
    starting: { label: 'Starting', color: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' },
    running: { label: 'Ready', color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
    error: { label: 'Error', color: 'border-red-500/30 bg-red-500/10 text-red-300' },
    stopped: { label: 'Stopped', color: 'border-slate-600/30 bg-slate-600/10 text-slate-400' },
  }[runtimeSnapshot.state];

  return (
    <div className={`flex flex-col h-full bg-[#0a0b16] min-w-0 min-h-0 overflow-hidden ${className}`}>
      {/* Terminal Title Bar */}
      <div className="h-9 px-3 border-b border-white/10 bg-[#0d0f20] flex items-center justify-between shrink-0 select-none">
        {/* Left: Tab selectors & Status badge */}
        <div className="flex items-center gap-2 min-w-0">
          <TerminalIcon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          
          {/* Tabs: Shell vs Server Output */}
          <div className="flex items-center bg-white/5 rounded-md p-0.5 border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('shell')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeTab === 'shell'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TerminalSquare className="h-3 w-3" />
              <span>Shell</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('server')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeTab === 'server'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="h-3 w-3" />
              <span>Dev Server</span>
            </button>
          </div>

          <Badge variant="outline" className={`text-[9px] uppercase px-1.5 py-0 ${statusConfig.color}`}>
            {statusConfig.label}
          </Badge>

          {runtimeSnapshot.framework !== 'unknown' && (
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              • {runtimeSnapshot.framework.toUpperCase()} ({runtimeSnapshot.packageManager})
            </span>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!runtimeSnapshot.isIsolated && (
            <button
              type="button"
              onClick={async () => {
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (const reg of regs) {
                    await reg.unregister();
                  }
                }
                window.location.reload();
              }}
              className="flex items-center gap-1 text-[10px] text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded border border-amber-500/30 transition-colors"
              title="Reload to activate Cross-Origin Isolation headers"
            >
              <AlertCircle className="h-3 w-3 text-amber-400" />
              <span>Reload to Activate Isolation</span>
            </button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleInterrupt}
            className="h-6 px-2 text-[11px] text-slate-400 hover:text-amber-300 hover:bg-white/5 gap-1"
            title="Send Ctrl+C (Interrupt)"
          >
            <Square className="h-2.5 w-2.5 fill-current" />
            <span className="hidden sm:inline">Ctrl+C</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRestart}
            className="h-6 px-2 text-[11px] text-slate-400 hover:text-white hover:bg-white/5 gap-1"
            title="Restart Dev Server"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Restart</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 px-2 text-[11px] text-slate-400 hover:text-white hover:bg-white/5 gap-1"
            title="Clear Output"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden sm:inline">Clear</span>
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-white/10"
              title="Close Terminal"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Displays (Keep both mounted to preserve buffer state) */}
      <div className="flex-1 min-h-0 min-w-0 p-2 overflow-hidden relative">
        <div
          ref={shellTerminalRef}
          className={`h-full w-full ${activeTab === 'shell' ? 'block' : 'hidden'}`}
        />
        <div
          ref={serverTerminalRef}
          className={`h-full w-full ${activeTab === 'server' ? 'block' : 'hidden'}`}
        />
      </div>
    </div>
  );
}
