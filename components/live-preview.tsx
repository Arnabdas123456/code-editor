"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from '@codesandbox/sandpack-react';
import {
  AlertTriangle,
  Sparkles,
  X,
  RotateCcw,
  ExternalLink,
  Loader2,
  Play,
  Terminal,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProjectFile } from '@/lib/types/database';
import { buildSandpackBundle } from '@/lib/preview/sandpack-adapter';
import {
  webcontainerManager,
  type WebContainerRuntimeSnapshot,
} from '@/lib/runtime/webcontainer-manager';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface LivePreviewProps {
  files: ProjectFile[];
  dependencies?: Array<{ name: string; version: string }>;
  mobile?: boolean;
  controlledViewport?: ViewportMode;
  onPreviewError?: (error: string) => void;
  onFixWithAI?: (error: string) => void;
  webcontainerUrl?: string | null;
  onSwitchToTerminal?: () => void;
}

export default function LivePreview({
  files,
  dependencies = [],
  mobile = false,
  controlledViewport,
  onPreviewError,
  onFixWithAI,
  webcontainerUrl,
  onSwitchToTerminal,
}: LivePreviewProps) {
  const [internalViewport, setInternalViewport] = useState<ViewportMode>(
    mobile ? 'mobile' : 'desktop'
  );
  const [activeError, setActiveError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<WebContainerRuntimeSnapshot>(
    webcontainerManager.getSnapshot()
  );

  const viewport = controlledViewport || internalViewport;

  // Subscribe to WebContainer state changes
  useEffect(() => {
    const unsub = webcontainerManager.subscribeSnapshot((snap) => {
      setRuntimeSnapshot(snap);
      if (snap.lastError) {
        setActiveError(snap.lastError.message);
        onPreviewError?.(snap.lastError.message);
      }
    });
    return unsub;
  }, [onPreviewError]);

  const effectiveUrl = webcontainerUrl || runtimeSnapshot.previewUrl;

  // Check if project is Next.js
  const isNextJs = files.some(
    (f) =>
      (f.path === 'package.json' && f.content.includes('"next"')) ||
      f.path.startsWith('app/') ||
      f.path.includes('next.config')
  );

  // Build sandpack bundle only for genuine compatible non-Next.js projects
  const bundle = useMemo(() => {
    if (isNextJs || files.length === 0) return null;
    return buildSandpackBundle(files, dependencies);
  }, [files, dependencies, isNextJs]);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const viewportWidthStyle = {
    desktop: 'w-full h-full',
    tablet: 'w-[768px] max-w-full h-full shadow-2xl rounded-t-xl border-x border-t border-white/10 overflow-hidden',
    mobile: 'w-[390px] max-w-full h-full shadow-2xl rounded-t-xl border-x border-t border-white/10 overflow-hidden',
  }[viewport];

  // Empty Project state
  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-[#0a0b16] select-none">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 mb-4 shadow-xl">
          <Play className="h-6 w-6 ml-0.5" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">
          No Files Generated Yet
        </h3>
        <p className="max-w-md text-xs text-slate-400 leading-relaxed mb-4">
          Start by describing your application in the AI Assistant (Build mode) on the right, or create files in the File Explorer.
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/10 text-slate-400 text-[11px] py-1 px-3">
            Build Mode: Full Application Generation
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#090a14] overflow-hidden select-none">
      {/* Top Preview Control Bar */}
      <div className="h-9 px-3 border-b border-white/10 bg-[#0c0e1c] flex items-center justify-between shrink-0 text-xs">
        {/* Left: Status / URL */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`flex h-2 w-2 rounded-full ${
              effectiveUrl
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : runtimeSnapshot.state === 'error'
                ? 'bg-red-500'
                : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="font-mono text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-[320px]">
            {effectiveUrl || 'http://localhost:3000'}
          </span>
          <Badge
            variant="outline"
            className={`text-[9px] uppercase py-0 px-1.5 ${
              effectiveUrl
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : runtimeSnapshot.state === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
          >
            {effectiveUrl ? 'WebContainer Live' : `Runtime: ${runtimeSnapshot.state}`}
          </Badge>
          {runtimeSnapshot.framework !== 'unknown' && (
            <span className="text-[10px] text-slate-500 hidden md:inline">
              • {runtimeSnapshot.framework.toUpperCase()}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {onSwitchToTerminal && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSwitchToTerminal}
              className="h-6 px-2 text-[11px] text-slate-400 hover:text-white hover:bg-white/5 gap-1"
              title="Open Terminal output"
            >
              <Terminal className="h-3 w-3" />
              <span className="hidden sm:inline">Terminal</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-white/5"
            title="Reload Preview"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>

          {effectiveUrl && (
            <a
              href={effectiveUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5"
              title="Open in new window"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Main Preview Frame */}
      <div className="flex-1 flex justify-center items-stretch overflow-hidden bg-[#070810] p-2 sm:p-3">
        <div className={`transition-all duration-300 flex flex-col ${viewportWidthStyle}`}>
          {effectiveUrl ? (
            /* Real WebContainer Live Application */
            <iframe
              key={iframeKey}
              src={effectiveUrl}
              className="w-full h-full border-0 bg-white rounded-md shadow-inner"
              title="WebContainer Live Application Preview"
              allow="cross-origin-isolated; autoplay; camera; microphone"
            />
          ) : runtimeSnapshot.state === 'installing' ||
            runtimeSnapshot.state === 'starting' ||
            runtimeSnapshot.state === 'mounting' ||
            runtimeSnapshot.state === 'initializing' ? (
            /* Live Build Progress State */
            <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-[#0a0c18] rounded-md border border-white/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 mb-3 animate-pulse">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              </div>
              <h4 className="text-sm font-semibold text-white mb-1 capitalize">
                {runtimeSnapshot.state === 'installing'
                  ? 'Installing Dependencies…'
                  : runtimeSnapshot.state === 'starting'
                  ? 'Starting Development Server…'
                  : runtimeSnapshot.state === 'mounting'
                  ? 'Mounting Project Files…'
                  : 'Booting WebContainer Runtime…'}
              </h4>
              <p className="max-w-sm text-xs text-slate-400 mb-4">
                {runtimeSnapshot.state === 'installing'
                  ? `Executing $ ${runtimeSnapshot.packageManager} install in virtual Node.js kernel`
                  : runtimeSnapshot.state === 'starting'
                  ? 'Launching dev server and waiting for port readiness…'
                  : 'Preparing virtual filesystem and environment'}
              </p>
              {onSwitchToTerminal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSwitchToTerminal}
                  className="h-7 text-xs border-white/10 text-slate-300 hover:bg-white/10 gap-1.5"
                >
                  <Terminal className="h-3 w-3" />
                  <span>View Live Output in Terminal</span>
                </Button>
              )}
            </div>
          ) : runtimeSnapshot.state === 'error' ? (
            /* Runtime Error Card with Fix with AI */
            <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-[#100808] rounded-md border border-red-500/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600/10 text-red-400 border border-red-500/30 mb-3">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <h4 className="text-sm font-semibold text-red-200 mb-1">Runtime Execution Error</h4>
              <p className="max-w-md text-xs text-red-400/80 mb-4 font-mono bg-red-950/40 p-2.5 rounded border border-red-500/20 text-left overflow-auto max-h-32">
                {activeError || runtimeSnapshot.lastError?.message || 'Development server encountered an error.'}
              </p>
              <div className="flex items-center gap-2">
                {onFixWithAI && (
                  <Button
                    size="sm"
                    onClick={() => onFixWithAI(activeError || runtimeSnapshot.lastError?.message || 'Runtime error')}
                    className="h-8 text-xs bg-red-600 hover:bg-red-500 text-white font-medium gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Fix with AI Debug Agent</span>
                  </Button>
                )}
                {onSwitchToTerminal && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSwitchToTerminal}
                    className="h-8 text-xs border-white/10 text-slate-300 hover:bg-white/10 gap-1.5"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    <span>Open Terminal</span>
                  </Button>
                )}
              </div>
            </div>
          ) : bundle && !bundle.adapterError ? (
            /* Sandpack Live Preview strictly for simple non-Next.js projects */
            <div className="w-full h-full rounded-md overflow-hidden bg-[#0d0f1e] relative">
              <SandpackProvider
                template="react-ts"
                theme="dark"
                files={bundle.sandpackFiles}
                customSetup={{
                  dependencies: bundle.dependencies,
                  entry: bundle.entryPath,
                }}
                options={{
                  recompileMode: 'delayed',
                  recompileDelay: 300,
                }}
              >
                <SandpackLayout className="!border-0 !h-full !w-full !rounded-none">
                  <SandpackPreview
                    className="!h-full !w-full"
                    showNavigator={false}
                    showOpenInCodeSandbox={false}
                    showRefreshButton={false}
                  />
                </SandpackLayout>
              </SandpackProvider>
            </div>
          ) : (
            /* Standby State */
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400 bg-[#0c0d16] rounded-md">
              <Server className="h-8 w-8 text-indigo-400 mb-2 opacity-60" />
              <p className="text-xs max-w-sm text-slate-300 mb-1">Development Server Ready to Launch</p>
              <p className="text-[11px] text-slate-500 mb-4">
                Click Build App in the AI Assistant, or run the dev server from the Terminal.
              </p>
              {onSwitchToTerminal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSwitchToTerminal}
                  className="h-7 text-xs border-white/10 text-slate-300 hover:bg-white/10 gap-1.5"
                >
                  <Terminal className="h-3 w-3" />
                  <span>Open Terminal</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Floating Banner with Fix with AI */}
      {activeError && (
        <div className="p-3 border-t border-red-500/30 bg-red-950/40 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2 truncate mr-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="truncate font-mono text-[11px]">{activeError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onFixWithAI && (
              <Button
                size="sm"
                onClick={() => onFixWithAI(activeError)}
                className="h-6 text-xs bg-red-600 hover:bg-red-500 text-white font-medium"
              >
                Fix with AI Debug Agent
              </Button>
            )}
            <button
              type="button"
              onClick={() => setActiveError(null)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
