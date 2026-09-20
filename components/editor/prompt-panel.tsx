'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Code2,
  FileCode,
  Loader2,
  Sparkles,
  Wand2,
  X,
  Bug,
  Lightbulb,
  CheckCircle,
  Play,
  ArrowRight,
  ListTodo,
  Layers,
  ChevronDown,
  ChevronRight,
  Send,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BorderBeam } from '@/components/ui/border-beam';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ProductPlan, DevelopmentTask } from '@/lib/ai/product-planner';
import { toast } from 'sonner';

export type AiMode = 'build' | 'code' | 'debug' | 'product';

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
  onOpenProductWorkspace?: () => void;
}

const BUILD_SUGGESTIONS = [
  'Build a modern analytics dashboard with stats cards and charts',
  'Create an interactive SaaS pricing calculator with feature tiers',
  'Build a responsive header with navigation links and user profile',
  'Create a product feature showcase grid with Lucide icons',
];

const CODE_SUGGESTIONS = [
  'Refactor into clean reusable functional components',
  'Add smooth hover micro-animations and active states',
  'Improve TypeScript type safety and prop interfaces',
  'Optimize performance and responsiveness for mobile devices',
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
  projectId,
  currentMode = 'build',
  onModeChange,
  onOpenProductWorkspace,
}: PromptPanelProps) {
  const [mode, setMode] = useState<AiMode>(currentMode);
  const [productIdea, setProductIdea] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [productPlan, setProductPlan] = useState<ProductPlan | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    vision: true,
    tasks: true,
    mvp: false,
    stories: false,
  });

  const activeMode = onModeChange ? currentMode : mode;

  const handleSetMode = (nextMode: AiMode) => {
    setMode(nextMode);
    onModeChange?.(nextMode);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isWorking && prompt.trim()) {
        void onGenerate();
      }
    }
  };

  // Generate Product Plan via /api/projects/[projectId]/plan
  const handleGeneratePlan = async () => {
    if (!projectId || !productIdea.trim()) return;
    setIsPlanning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: productIdea.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate product plan.');
      setProductPlan(data.plan);
      toast.success('Product roadmap and development tasks generated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Product planning failed.');
    } finally {
      setIsPlanning(false);
    }
  };

  // Execute development task via Coding Agent
  const handleBuildTask = async (task: DevelopmentTask) => {
    const taskPrompt = `Build feature: ${task.title}\n\nDescription: ${task.description}\n\nAffected files: ${task.affectedFiles.join(', ')}\n\nAcceptance criteria:\n${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`;
    handleSetMode('build');
    setPrompt(taskPrompt);
    await onGenerate(taskPrompt);
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

        {/* 4 AI Modes Segmented Control */}
        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-black/40 border border-white/10 text-[11px]">
          <button
            type="button"
            onClick={() => handleSetMode('build')}
            className={`py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
              activeMode === 'build'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>Build</span>
          </button>

          <button
            type="button"
            onClick={() => handleSetMode('code')}
            className={`py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
              activeMode === 'code'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Code2 className="h-3 w-3" />
            <span>Code</span>
          </button>

          <button
            type="button"
            onClick={() => handleSetMode('debug')}
            className={`py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
              activeMode === 'debug'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Bug className="h-3 w-3" />
            <span>Debug</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenProductWorkspace) {
                onOpenProductWorkspace();
              } else {
                handleSetMode('product');
              }
            }}
            className={`py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
              activeMode === 'product'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
            title="Open Dedicated Product Manager Workspace"
          >
            <Lightbulb className="h-3 w-3" />
            <span>Product</span>
          </button>
        </div>
      </div>

      {/* Main Mode Body */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ======================================================== */}
        {/* PRODUCT MANAGER MODE */}
        {/* ======================================================== */}
        {activeMode === 'product' && (
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {/* Product Idea Input */}
              <div className="rounded-xl border border-white/10 bg-[#121324] p-3 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span>Product Manager Workspace</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Describe your idea. The AI Product Manager will create a complete specification: Vision, Personas, MVP, Features, Stories, Roadmap, and Development Tasks.
                </p>
                <Textarea
                  value={productIdea}
                  onChange={(e) => setProductIdea(e.target.value)}
                  placeholder="e.g. Build an AI-powered personal financial tracker with bank sync, budget forecasting, and debt payoff calculator."
                  rows={3}
                  className="w-full bg-black/40 border-white/10 text-xs text-slate-200 resize-none focus-visible:ring-indigo-500"
                />
                <Button
                  onClick={() => void handleGeneratePlan()}
                  disabled={isPlanning || !productIdea.trim()}
                  size="sm"
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white text-xs font-medium gap-2"
                >
                  {isPlanning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Drafting Product Plan…</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" />
                      <span>Generate Product Plan</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Generated Plan Artifacts */}
              {productPlan && (
                <div className="space-y-3 pt-1">
                  {/* Vision Card */}
                  <div className="rounded-xl border border-white/10 bg-[#121324] p-3">
                    <button
                      type="button"
                      onClick={() => toggleSection('vision')}
                      className="flex w-full items-center justify-between font-semibold text-xs text-slate-200"
                    >
                      <span className="flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Product Vision</span>
                      </span>
                      {expandedSections.vision ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                      )}
                    </button>
                    {expandedSections.vision && (
                      <div className="mt-2 space-y-1.5 text-[11px] text-slate-400 border-t border-white/5 pt-2">
                        <p><strong className="text-slate-300">Purpose:</strong> {productPlan.vision.purpose}</p>
                        <p><strong className="text-slate-300">Value Proposition:</strong> {productPlan.vision.valueProposition}</p>
                        <p><strong className="text-slate-300">Target Outcome:</strong> {productPlan.vision.targetOutcome}</p>
                      </div>
                    )}
                  </div>

                  {/* Development Tasks List */}
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/10 p-3 space-y-2.5">
                    <div className="flex items-center justify-between font-semibold text-xs text-indigo-300">
                      <span className="flex items-center gap-1.5">
                        <ListTodo className="h-3.5 w-3.5" />
                        <span>Development Tasks ({productPlan.developmentTasks.length})</span>
                      </span>
                      <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300 text-[10px]">
                        Ready to Build
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {productPlan.developmentTasks.map((task, idx) => (
                        <div
                          key={task.id || idx}
                          className="rounded-lg border border-white/10 bg-[#121324] p-2.5 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-[11px] text-slate-200">
                              {idx + 1}. {task.title}
                            </span>
                            <Badge variant="outline" className="border-white/10 text-[9px] uppercase px-1 py-0">
                              {task.category}
                            </Badge>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {task.description}
                          </p>

                          {task.affectedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {task.affectedFiles.map((f) => (
                                <span
                                  key={f}
                                  className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                          )}

                          <Button
                            onClick={() => void handleBuildTask(task)}
                            disabled={isWorking}
                            size="sm"
                            className="w-full h-7 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium gap-1.5 mt-1 shadow-sm"
                          >
                            <Zap className="h-3 w-3 text-amber-300" />
                            <span>Build This Feature</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* ======================================================== */}
        {/* BUILD / CODE / DEBUG MODES */}
        {/* ======================================================== */}
        {activeMode !== 'product' && (
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
                  <span>Full project context automatically selected</span>
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
                      title="Dismiss error"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
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
                  activeMode === 'code'
                    ? 'Describe specific changes to make to the active file or selected code…'
                    : activeMode === 'debug'
                    ? 'Describe the issue or click below to auto-repair the preview error…'
                    : 'Describe components, features, styling, or pages to generate… (Ctrl+Enter to send)'
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
                      <span>Generate</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="shrink-0 space-y-1.5 pt-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Suggested ideas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(activeMode === 'code' ? CODE_SUGGESTIONS : BUILD_SUGGESTIONS).map((quickText) => (
                  <button
                    key={quickText}
                    type="button"
                    disabled={isWorking}
                    onClick={() => setPrompt(quickText)}
                    className="rounded-md border border-white/5 bg-white/5 px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-200 active:scale-95 transition text-left"
                  >
                    {quickText}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
