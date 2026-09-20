"use client";

import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
  useSandpackConsole,
} from '@codesandbox/sandpack-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Monitor,
  Smartphone,
  Sparkles,
  Tablet,
  X,
} from 'lucide-react';
import type { ProjectFile } from '@/lib/types/database';
import {
  buildSandpackBundle,
} from '@/lib/preview/sandpack-adapter';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

interface LivePreviewProps {
  files: ProjectFile[];
  dependencies?: Array<{ name: string; version: string }>;
  mobile?: boolean;
  controlledViewport?: ViewportMode;
  onPreviewError?: (error: string) => void;
  onFixWithAI?: (error: string) => void;
}

/**
 * Dedicated Sandpack Live Preview Component.
 * Powered by buildSandpackBundle adapter:
 * - Next.js shims for link, image, navigation, router, fonts
 * - Safe Tailwind Play CDN configuration in preview iframe
 * - Preserves user source files untouched
 * - Real React compile and runtime error reporting
 * - 1-click "Fix with AI" integration
 */
export default function LivePreview({
  files,
  dependencies = [],
  mobile = false,
  controlledViewport,
  onPreviewError,
  onFixWithAI,
}: LivePreviewProps) {
  const [internalViewport, setInternalViewport] = useState<ViewportMode>(
    mobile ? 'mobile' : 'desktop'
  );
  const [showDetections, setShowDetections] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);

  const viewport = controlledViewport || internalViewport;

  // Run the Sandpack Preview Adapter on the current frontend files state
  const bundle = useMemo(() => {
    return buildSandpackBundle(files, dependencies);
  }, [files, dependencies]);

  // Report errors up to the editor state for AI debugging
  const handleErrorOccurred = (errorText: string) => {
    setActiveError(errorText);
    onPreviewError?.(errorText);
  };

  const handleClearError = () => {
    setActiveError(null);
  };

  if (bundle.adapterError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400 bg-[#0c0d16]">
        <div className="mb-4 rounded-full bg-blue-500/10 p-3 text-blue-400">
          <Info className="h-6 w-6" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-slate-200">
          Preview Ready to Start
        </h3>
        <p className="max-w-md text-sm text-slate-400">
          {bundle.adapterError}
        </p>
      </div>
    );
  }

  const viewportClasses = {
    desktop: 'w-full h-full',
    tablet: 'mx-auto max-w-[768px] h-full shadow-2xl rounded-t-xl overflow-hidden border-x border-t border-white/10',
    mobile: 'mx-auto max-w-[390px] h-full shadow-2xl rounded-t-xl overflow-hidden border-x border-t border-white/10',
  }[viewport];

  return (
    <div className="flex h-full flex-col bg-[#090a12]">
      {/* Top Preview Control Bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d0f1a] px-3 text-xs text-slate-300">
        {/* Left: Responsive Viewport Switcher */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setInternalViewport('desktop')}
            title="Desktop view"
            className={`flex items-center gap-1 rounded px-2 py-1 transition ${viewport === 'desktop'
              ? 'bg-blue-500/20 text-blue-400 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setInternalViewport('tablet')}
            title="Tablet view (768px)"
            className={`flex items-center gap-1 rounded px-2 py-1 transition ${viewport === 'tablet'
              ? 'bg-blue-500/20 text-blue-400 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
          >
            <Tablet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => setInternalViewport('mobile')}
            title="Mobile view (390px)"
            className={`flex items-center gap-1 rounded px-2 py-1 transition ${viewport === 'mobile'
              ? 'bg-blue-500/20 text-blue-400 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Right: Compatibility Status Badges */}
        <div className="flex items-center gap-2">
          {bundle.hasTailwind && (
            <span className="hidden items-center rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-400 md:inline-flex">
              Tailwind CDN
            </span>
          )}

          {bundle.nextJsDetections.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDetections((prev) => !prev)}
              className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-300 hover:bg-blue-500/20 transition"
              title="Next.js Compatibility Status"
            >
              <CheckCircle2 className="h-3 w-3 text-blue-400" />
              <span>{bundle.nextJsDetections.length} Next.js API{bundle.nextJsDetections.length > 1 ? 's' : ''} shimmed</span>
              {showDetections ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Detections Drawer */}
      {showDetections && bundle.nextJsDetections.length > 0 && (
        <div className="border-b border-white/10 bg-[#121422] p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-slate-300">
              Next.js Preview Compatibility Layer
            </span>
            <button
              type="button"
              onClick={() => setShowDetections(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {bundle.nextJsDetections.map((det, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded bg-white/5 px-2 py-1 text-[11px]"
              >
                <span className="font-mono text-cyan-400">{det.api}</span>
                <span className="text-slate-400">in {det.path}</span>
                <span className="ml-auto text-slate-500">{det.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sandpack Provider & Frame */}
      <div className="relative min-h-0 flex-1 overflow-hidden p-2">
        <div className={viewportClasses}>
          <SandpackProvider
            template="react-ts"
            theme="dark"
            files={bundle.sandpackFiles}
            customSetup={{
              dependencies: bundle.dependencies,
            }}
            options={{
              autorun: true,
              recompileMode: 'delayed',
              recompileDelay: 300,
            }}
          >
            {/* Real-time Error Interceptor */}
            <SandpackErrorReporter
              onError={handleErrorOccurred}
              onClearError={handleClearError}
            />

            <SandpackLayout className="!h-full !rounded-none !border-0">
              <SandpackPreview
                className="!h-full !min-h-0 !bg-[#0f0f1a]"
                showOpenInCodeSandbox={false}
                showRefreshButton
              />
            </SandpackLayout>
          </SandpackProvider>
        </div>

        {/* Floating Error Banner with "Fix with AI" */}
        {activeError && (
          <div className="absolute inset-x-4 bottom-4 z-20 rounded-xl border border-red-500/40 bg-[#160f1c]/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-red-500/10 p-2 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-red-200">
                    Preview Compilation or Runtime Error
                  </h4>
                  <p className="mt-1 line-clamp-2 text-xs font-mono text-red-300/90">
                    {activeError}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {onFixWithAI && (
                  <button
                    type="button"
                    onClick={() => onFixWithAI(activeError)}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-indigo-500/20 hover:brightness-110 active:scale-95 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    Fix with AI
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearError}
                  className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
                  title="Dismiss error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sandpack Error Reporter Hook
// -----------------------------------------------------------------------------

function SandpackErrorReporter({
  onError,
  onClearError,
}: {
  onError: (errorText: string) => void;
  onClearError: () => void;
}) {
  const { sandpack } = useSandpack();
  const { logs } = useSandpackConsole({
    resetOnPreviewRestart: true,
    showSyntaxError: true,
  });

  // Listen to bundler compilation / syntax errors
  useEffect(() => {
    if (sandpack.error) {
      const errorMsg = sandpack.error.message || String(sandpack.error);
      onError(errorMsg);
    } else if (sandpack.status === 'done') {
      onClearError();
    }
  }, [sandpack.error, sandpack.status, onError, onClearError]);

  // Listen to runtime console errors
  useEffect(() => {
    const errorLogs = logs.filter((log) => log.method === 'error');
    if (errorLogs.length > 0) {
      const lastError = errorLogs[errorLogs.length - 1];
      const details = (lastError.data || [])
        .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
        .join(' ');

      if (details.trim()) {
        onError(details);
      }
    }
  }, [logs, onError]);

  return null;
}
