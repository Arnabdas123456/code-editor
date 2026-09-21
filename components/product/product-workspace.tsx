'use client';

import React, { useState, useMemo } from 'react';
import {
  Compass,
  Lightbulb,
  Users,
  Target,
  Sparkles,
  Layers,
  CheckCircle2,
  Calendar,
  ListTodo,
  FileText,
  Search,
  ArrowRight,
  Code2,
  Loader2,
  Check,
  FileCode,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Plus,
  Filter,
  CheckCircle,
  Clock,
  Zap,
  Globe,
  TrendingUp,
  ShieldAlert,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { ProductPlan, DevelopmentTask } from '@/lib/ai/product-planner';
import type { TechnicalImplementationPlan } from '@/lib/ai/task-planner';
import type { Project, ProjectFile } from '@/lib/types/database';

export type PmSection =
  | 'overview'
  | 'vision'
  | 'personas'
  | 'mvp'
  | 'features'
  | 'stories'
  | 'acceptance'
  | 'roadmap'
  | 'tasks'
  | 'requirements'
  | 'research';

export interface ProductWorkspaceProps {
  project: Project | null;
  files: ProjectFile[];
  productPlan: ProductPlan | null;
  onPlanGenerated: (plan: ProductPlan) => void;
  onFilesUpdated: (newFiles: ProjectFile[], dependencies?: Array<{ name: string; version: string }>) => void;
  onSwitchToDeveloper: (targetFilePath?: string) => void;
}

const SECTIONS: Array<{ id: PmSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: Compass },
  { id: 'vision', label: 'Product Vision', icon: Lightbulb },
  { id: 'personas', label: 'Target Users & Personas', icon: Users },
  { id: 'mvp', label: 'MVP Scope', icon: Target },
  { id: 'features', label: 'Features', icon: Sparkles },
  { id: 'stories', label: 'User Stories', icon: Layers },
  { id: 'acceptance', label: 'Acceptance Criteria', icon: CheckCircle2 },
  { id: 'roadmap', label: 'Roadmap', icon: Calendar },
  { id: 'tasks', label: 'Development Tasks', icon: ListTodo },
  { id: 'requirements', label: 'Requirements', icon: FileText },
  { id: 'research', label: 'Research & Benchmarks', icon: Globe },
];

export function ProductWorkspace({
  project,
  files,
  productPlan,
  onPlanGenerated,
  onFilesUpdated,
  onSwitchToDeveloper,
}: ProductWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<PmSection>('overview');
  const [idea, setIdea] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [showIdeaModal, setShowIdeaModal] = useState(false);

  // Active task execution state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStage, setTaskStage] = useState<'idle' | 'architecting' | 'coding' | 'done'>('idle');
  const [selectedTaskForReqs, setSelectedTaskForReqs] = useState<DevelopmentTask | null>(null);
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('all');
  const [taskSearch, setTaskSearch] = useState('');

  // Generate complete product specification
  const handleGeneratePlan = async () => {
    if (!project || !idea.trim()) {
      toast.error('Please describe your product idea first.');
      return;
    }
    setIsGeneratingPlan(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: idea.trim(),
          existingPaths: files.map((f) => f.path),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate product plan.');
      onPlanGenerated(data.plan);
      setShowIdeaModal(false);
      toast.success('Complete product plan & roadmap generated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Product planning failed.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Build This Feature pipeline:
  // Product Task -> Software Architect Agent -> Technical Plan -> Coding Agent -> Validated File Operations -> Supabase project_files
  const handleBuildFeature = async (task: DevelopmentTask) => {
    if (!project) return;
    setActiveTaskId(task.id);
    setTaskStage('architecting');

    try {
      // 1. Software Architect Agent formulate technical plan
      toast.info(`Architecting technical plan for "${task.title}"…`);
      const archRes = await fetch(`/api/projects/${project.id}/architect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, files }),
      });
      const archData = await archRes.json();
      if (!archRes.ok) throw new Error(archData.message || 'Architect agent failed.');

      const plan: TechnicalImplementationPlan = archData.plan;
      setTaskStage('coding');

      // 2. Coding Agent generates modular files and writes to Supabase
      toast.info(`Coding Agent generating files…`);
      const genRes = await fetch(`/api/projects/${project.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: plan.codingAgentPrompt,
          files,
        }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.message || 'Coding agent generation failed.');

      const updatedFiles: ProjectFile[] = genData.files ?? [];
      onFilesUpdated(updatedFiles, genData.dependencies);

      // Update task status in plan
      if (productPlan) {
        const updatedTasks = productPlan.developmentTasks.map((t) =>
          t.id === task.id ? { ...t, status: 'completed' as const } : t
        );
        onPlanGenerated({ ...productPlan, developmentTasks: updatedTasks });
      }

      setTaskStage('done');
      toast.success(`Feature "${task.title}" built & persisted!`, {
        action: {
          label: 'View in IDE',
          onClick: () => {
            const primaryFile = plan.filesToCreate[0] || plan.filesToUpdate[0];
            onSwitchToDeveloper(primaryFile);
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Build pipeline failed.');
      setTaskStage('idle');
      setActiveTaskId(null);
    }
  };

  const devTasks = productPlan?.developmentTasks;

  const tasksList = useMemo(() => {
    if (!devTasks) return [];
    return devTasks.filter((t) => {
      const matchesStatus = taskFilterStatus === 'all' || t.status === taskFilterStatus;
      const matchesSearch =
        !taskSearch.trim() ||
        t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.description.toLowerCase().includes(taskSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [devTasks, taskFilterStatus, taskSearch]);

  const completedCount = useMemo(() => {
    return devTasks?.filter((t) => t.status === 'completed').length || 0;
  }, [devTasks]);

  const totalTasks = productPlan?.developmentTasks.length || 0;

  return (
    <div className="flex-1 flex h-full bg-[#080914] text-slate-100 overflow-hidden select-none">
      {/* ========================================================================= */}
      {/* LEFT NAVIGATION SIDEBAR */}
      {/* ========================================================================= */}
      <aside className="w-64 shrink-0 bg-[#0d0f22] border-r border-white/10 flex flex-col justify-between">
        <div className="flex flex-col">
          {/* Header */}
          <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
                <Compass className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-xs font-bold text-white tracking-wide uppercase">
                  Product Manager
                </h2>
                <p className="text-[10px] text-slate-400">Planning & Architecture</p>
              </div>
            </div>
          </div>

          {/* Nav List */}
          <ScrollArea className="px-2 py-3">
            <div className="space-y-1">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;
                const isTasks = sec.id === 'tasks';

                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSection(sec.id)}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{sec.label}</span>
                    </div>
                    {isTasks && totalTasks > 0 && (
                      <Badge
                        variant="secondary"
                        className={`h-4 px-1 text-[10px] ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {completedCount}/{totalTasks}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Footer: Switch to IDE */}
        <div className="p-3 border-t border-white/10 bg-black/20 space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSwitchToDeveloper()}
            className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs justify-between"
          >
            <div className="flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-indigo-400" />
              <span>Developer IDE</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          </Button>
          <div className="text-[10px] text-center text-slate-500">
            {files.filter((f) => !f.is_folder).length} active project files
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#080914] overflow-hidden">
        {/* Top Header */}
        <header className="h-14 px-6 border-b border-white/10 bg-[#0d0f22] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-white capitalize tracking-wide">
              {SECTIONS.find((s) => s.id === activeSection)?.label}
            </h1>
            <Badge
              variant="outline"
              className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px]"
            >
              {project?.name ?? 'AI Project'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowIdeaModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 font-medium shadow-sm shadow-indigo-600/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{productPlan ? 'Evolve / Update Plan' : 'Define Product Idea'}</span>
            </Button>
          </div>
        </header>

        {/* Dynamic Section Content */}
        <ScrollArea className="flex-1 p-6">
          <div className="max-w-5xl mx-auto space-y-6 pb-12">
            {/* If no plan exists yet, show prominent welcome banner */}
            {!productPlan && (
              <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-[#0e112a] to-[#0a0b16] p-8 text-center relative overflow-hidden shadow-2xl">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mx-auto">
                    <Compass className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Architect Your Product Plan
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Codatron Product Manager transforms raw ideas into complete product specifications: Target Personas, MVP boundaries, Features, User Stories, Acceptance Criteria, and actionable Development Tasks.
                  </p>
                  <Button
                    onClick={() => setShowIdeaModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-2 px-5 py-2 font-medium shadow-lg shadow-indigo-600/30"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Describe Product Idea</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Active Execution Banner */}
            {activeTaskId && (
              <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/40 p-4 backdrop-blur shadow-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {taskStage === 'architecting' && 'Phase 1: Software Architect Agent formulating technical plan…'}
                      {taskStage === 'coding' && 'Phase 2: Coding Agent writing and persisting modular source files…'}
                      {taskStage === 'done' && 'Phase 3: Source files committed and persisted to Supabase!'}
                    </h4>
                    <p className="text-xs text-indigo-300/80">
                      Task: {productPlan?.developmentTasks.find((t) => t.id === activeTaskId)?.title}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => onSwitchToDeveloper()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
                >
                  <span>Open in IDE</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Render Selected Section */}
            {productPlan && (
              <>
                {/* 1. OVERVIEW */}
                {activeSection === 'overview' && (
                  <div className="space-y-6">
                    <div className="rounded-xl border border-white/10 bg-[#0f1128] p-5 shadow-lg space-y-3">
                      <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
                        <Compass className="h-4 w-4" />
                        <span>Executive Summary</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {productPlan.overview?.summary || productPlan.vision.purpose}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-xl border border-white/10 bg-[#0f1128] p-4">
                        <span className="text-[11px] text-slate-400 uppercase font-semibold">
                          Total Features
                        </span>
                        <div className="text-2xl font-bold text-white mt-1">
                          {productPlan.features.length}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0f1128] p-4">
                        <span className="text-[11px] text-slate-400 uppercase font-semibold">
                          Development Tasks
                        </span>
                        <div className="text-2xl font-bold text-white mt-1">
                          {productPlan.developmentTasks.length}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0f1128] p-4">
                        <span className="text-[11px] text-slate-400 uppercase font-semibold">
                          Tasks Completed
                        </span>
                        <div className="text-2xl font-bold text-emerald-400 mt-1">
                          {completedCount} / {totalTasks}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-2">
                      <h4 className="text-xs font-semibold text-slate-200">
                        Target Audience & Differentiator
                      </h4>
                      <p className="text-xs text-slate-400">
                        <strong>Audience:</strong> {productPlan.overview?.targetAudience || 'Modern web application users and teams'}
                      </p>
                      <p className="text-xs text-slate-400">
                        <strong>Differentiator:</strong> {productPlan.overview?.keyDifferentiator || productPlan.vision.valueProposition}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. PRODUCT VISION */}
                {activeSection === 'vision' && (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-2">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        Core Purpose
                      </h4>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {productPlan.vision.purpose}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-2">
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                        Value Proposition
                      </h4>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {productPlan.vision.valueProposition}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-2">
                      <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                        Target Outcome & Success Metrics
                      </h4>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {productPlan.vision.targetOutcome}
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. TARGET USERS / PERSONAS */}
                {activeSection === 'personas' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {productPlan.personas.map((persona, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-3 shadow-md"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 font-bold text-xs">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-semibold text-white">
                            {persona.role}
                          </h4>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-slate-500 font-semibold uppercase text-[10px]">
                              Core Needs
                            </span>
                            <p className="text-slate-300 mt-0.5">{persona.needs}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 font-semibold uppercase text-[10px]">
                              Pain Points
                            </span>
                            <p className="text-slate-300 mt-0.5">{persona.painPoints}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. MVP SCOPE */}
                {activeSection === 'mvp' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Must Have */}
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-5 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>MVP In-Scope (Must-Have)</span>
                      </div>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {productPlan.mvp.mustHave.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Exclusions */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-5 space-y-3">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                        <AlertCircle className="h-4 w-4" />
                        <span>Out of Scope / Post-MVP Exclusions</span>
                      </div>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {productPlan.mvp.exclusions.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* 5. FEATURES */}
                {activeSection === 'features' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {productPlan.features.map((feat) => (
                      <div
                        key={feat.id}
                        className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-white">{feat.title}</h4>
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase ${
                              feat.priority === 'high'
                                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                : feat.priority === 'medium'
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                            }`}
                          >
                            {feat.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {feat.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 6. USER STORIES */}
                {activeSection === 'stories' && (
                  <div className="space-y-4">
                    {productPlan.userStories.map((story) => (
                      <div
                        key={story.id}
                        className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-3"
                      >
                        <div className="text-xs text-slate-200 leading-relaxed">
                          <span className="text-indigo-400 font-semibold">As a</span> {story.asA},{' '}
                          <span className="text-purple-400 font-semibold">I want</span> {story.iWant},{' '}
                          <span className="text-cyan-400 font-semibold">so that</span> {story.soThat}.
                        </div>
                        {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                          <div className="pt-2 border-t border-white/5 space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">
                              Acceptance Criteria
                            </span>
                            <ul className="space-y-1 text-xs text-slate-400">
                              {story.acceptanceCriteria.map((ac, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                                  <span>{ac}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 7. ACCEPTANCE CRITERIA */}
                {activeSection === 'acceptance' && (
                  <div className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs uppercase tracking-wider">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>System-Wide Acceptance Criteria & Quality Gates</span>
                    </div>
                    <ul className="space-y-3 text-xs text-slate-300">
                      {(productPlan.acceptanceCriteria || [
                        'Application builds and compiles without syntax or TypeScript errors',
                        'All modular components render responsively across Desktop, Tablet, and Mobile viewports',
                        'State updates cleanly without full-page reloads',
                        'Interactions and navigation links execute with visual feedback',
                      ]).map((crit, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                          <span>{crit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 8. ROADMAP */}
                {activeSection === 'roadmap' && (
                  <div className="space-y-4">
                    {productPlan.roadmap.map((phase, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-white/10 bg-[#0f1128] p-5 flex items-start gap-4"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 font-bold text-xs shrink-0">
                          {idx + 1}
                        </span>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-white">{phase.milestone}</h4>
                            {phase.targetWeek && (
                              <Badge variant="outline" className="text-[10px] text-slate-400">
                                {phase.targetWeek}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {phase.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 9. DEVELOPMENT TASKS */}
                {activeSection === 'tasks' && (
                  <div className="space-y-4">
                    {/* Filters & Search */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0d0f22] p-3 rounded-xl border border-white/10">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                        <input
                          type="text"
                          value={taskSearch}
                          onChange={(e) => setTaskSearch(e.target.value)}
                          placeholder="Search tasks by keyword or component…"
                          className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {['all', 'todo', 'in-progress', 'completed'].map((statusKey) => (
                          <button
                            key={statusKey}
                            type="button"
                            onClick={() => setTaskFilterStatus(statusKey)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition ${
                              taskFilterStatus === statusKey
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                            }`}
                          >
                            {statusKey}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Task Cards */}
                    <div className="space-y-3">
                      {tasksList.map((task) => (
                        <div
                          key={task.id}
                          className="rounded-xl border border-white/10 bg-[#0f1128] p-4 transition hover:border-white/20 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-white">{task.title}</h4>
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase ${
                                  task.priority === 'high'
                                    ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                    : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                }`}
                              >
                                {task.priority}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-[10px] border-purple-500/30 bg-purple-500/10 text-purple-300 uppercase"
                              >
                                {task.type || task.category || 'component'}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {task.status === 'completed' && (
                                <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                                  <Check className="h-3 w-3" />
                                  <span>Built</span>
                                </Badge>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-slate-400 leading-relaxed">
                            {task.description}
                          </p>

                          {/* Affected Files & Dependencies */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(task.affectedFiles || []).map((file, fIdx) => (
                              <span
                                key={fIdx}
                                className="font-mono text-[10px] rounded bg-white/5 border border-white/5 px-2 py-0.5 text-slate-300"
                              >
                                {file}
                              </span>
                            ))}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedTaskForReqs(task)}
                              className="h-7 text-xs border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 gap-1.5"
                            >
                              <FileText className="h-3 w-3 text-slate-400" />
                              <span>View Requirements</span>
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => void handleBuildFeature(task)}
                              disabled={activeTaskId === task.id || isGeneratingPlan}
                              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 font-medium shadow-sm shadow-indigo-600/30"
                            >
                              {activeTaskId === task.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Building Feature…</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="h-3 w-3" />
                                  <span>Build This Feature</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 10. REQUIREMENTS */}
                {activeSection === 'requirements' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-3">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        Functional Requirements
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {(productPlan.requirements?.functional || [
                          'Stateful interactive components with local storage persistence',
                          'Responsive layout adapting cleanly across desktop and mobile',
                          'Data visualization charts and real-time activity metrics',
                        ]).map((req, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-3">
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                        Non-Functional & Performance
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {(productPlan.requirements?.nonFunctional || [
                          'Sub-second page load times with code-splitting',
                          'ARIA-compliant accessible keyboard navigation',
                          'Zero critical vulnerabilities or unhandled runtime exceptions',
                        ]).map((req, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* 11. RESEARCH */}
                {activeSection === 'research' && (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-2">
                      <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                        Market Analysis
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {productPlan.research?.marketAnalysis ||
                          'Strong user demand for unified AI developer tools that blend rapid product ideation with automated, multi-file code generation.'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0f1128] p-5 space-y-3">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        Competitive Benchmarks
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {(productPlan.research?.competitiveBenchmarks || [
                          'Vercel v0: Excellent component generation, but limited to single-file isolated previews',
                          'Cursor / Claude Code: Strong coding capabilities, but lacking dedicated Product Planning workspace',
                          'Replit: WebContainers and runtime hosting, but higher latency for full-stack scaffolding',
                        ]).map((bench, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                            <span>{bench}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* ========================================================================= */}
      {/* IDEA INTAKE MODAL */}
      {/* ========================================================================= */}
      <Dialog open={showIdeaModal} onOpenChange={setShowIdeaModal}>
        <DialogContent className="bg-[#0f1128] border-white/10 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>Describe Product Idea</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              The AI Product Manager will formulate a comprehensive specification with Vision, Personas, MVP Scope, Features, User Stories, and actionable Development Tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. Build a modern SaaS Analytics Dashboard with dark mode, revenue charts, conversion funnels, activity feed, and responsive navigation."
              rows={4}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowIdeaModal(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGeneratePlan}
              disabled={isGeneratingPlan || !idea.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 font-medium shadow-sm"
            >
              {isGeneratingPlan ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Architecting Specification…</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>Generate Plan</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* VIEW REQUIREMENTS DIALOG */}
      {/* ========================================================================= */}
      {selectedTaskForReqs && (
        <Dialog open={Boolean(selectedTaskForReqs)} onOpenChange={() => setSelectedTaskForReqs(null)}>
          <DialogContent className="bg-[#0f1128] border-white/10 text-slate-100 sm:max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-[10px] border-indigo-500/30 bg-indigo-500/10 text-indigo-300 uppercase"
                >
                  {selectedTaskForReqs.type || selectedTaskForReqs.category}
                </Badge>
                <DialogTitle className="text-sm font-bold text-white">
                  {selectedTaskForReqs.title}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-400">
                Detailed requirements and technical implementation plan
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 py-3 pr-2">
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">
                    Description
                  </span>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    {selectedTaskForReqs.description}
                  </p>
                </div>

                {selectedTaskForReqs.requirements && (
                  <div>
                    <span className="text-slate-500 font-semibold uppercase text-[10px]">
                      Functional Requirements
                    </span>
                    <p className="text-slate-300 mt-1 leading-relaxed">
                      {selectedTaskForReqs.requirements}
                    </p>
                  </div>
                )}

                {selectedTaskForReqs.acceptanceCriteria && selectedTaskForReqs.acceptanceCriteria.length > 0 && (
                  <div>
                    <span className="text-slate-500 font-semibold uppercase text-[10px]">
                      Acceptance Criteria
                    </span>
                    <ul className="space-y-1 mt-1 text-slate-300">
                      {selectedTaskForReqs.acceptanceCriteria.map((crit, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                          <span>{crit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">
                    Affected Files
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(selectedTaskForReqs.affectedFiles || []).map((file, idx) => (
                      <span
                        key={idx}
                        className="font-mono text-[10px] rounded bg-white/5 border border-white/10 px-2 py-0.5 text-indigo-300"
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="pt-2 border-t border-white/5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTaskForReqs(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const task = selectedTaskForReqs;
                  setSelectedTaskForReqs(null);
                  void handleBuildFeature(task);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 font-medium shadow-sm"
              >
                <Zap className="h-3 w-3" />
                <span>Build This Feature</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
