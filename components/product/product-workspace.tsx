'use client';

import React, { useState } from 'react';
import {
  Lightbulb,
  Sparkles,
  CheckCircle2,
  ListTodo,
  Users,
  Target,
  Layers,
  ArrowRight,
  Code2,
  Calendar,
  Compass,
  Loader2,
  Check,
  FileCode,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { ProductPlan, DevelopmentTask } from '@/lib/ai/product-planner';
import type { TechnicalImplementationPlan } from '@/lib/ai/task-planner';
import type { Project, ProjectFile } from '@/lib/types/database';

export interface ProductWorkspaceProps {
  project: Project | null;
  files: ProjectFile[];
  productPlan: ProductPlan | null;
  onPlanGenerated: (plan: ProductPlan) => void;
  onFilesUpdated: (newFiles: ProjectFile[], dependencies?: Array<{ name: string; version: string }>) => void;
  onSwitchToDeveloper: (targetFilePath?: string) => void;
}

export function ProductWorkspace({
  project,
  files,
  productPlan,
  onPlanGenerated,
  onFilesUpdated,
  onSwitchToDeveloper,
}: ProductWorkspaceProps) {
  const [idea, setIdea] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStage, setTaskStage] = useState<'idle' | 'architecting' | 'coding' | 'done'>('idle');
  const [architectPlan, setArchitectPlan] = useState<TechnicalImplementationPlan | null>(null);

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
      toast.success('Complete product plan & roadmap generated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Product planning failed.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Controlled multi-agent development workflow:
  // Product Task -> Technical Architect Agent -> Coding Agent -> /generate -> project_files
  const handleBuildFeature = async (task: DevelopmentTask) => {
    if (!project) return;
    setActiveTaskId(task.id);
    setTaskStage('architecting');

    try {
      // 1. Technical Architect Agent formulate implementation plan
      toast.info(`Architecting technical plan for "${task.title}"...`);
      const archRes = await fetch(`/api/projects/${project.id}/architect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, files }),
      });
      const archData = await archRes.json();
      if (!archRes.ok) throw new Error(archData.message || 'Architect agent failed.');

      const plan: TechnicalImplementationPlan = archData.plan;
      setArchitectPlan(plan);
      setTaskStage('coding');

      // 2. Coding Agent performs source-file operations via /generate
      toast.info(`Coding Agent generating ${plan.filesToCreate.length + plan.filesToUpdate.length} files...`);
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

      setTaskStage('done');
      toast.success(`Feature "${task.title}" built successfully!`);

      // If primary file was created, open it in developer workspace
      const primaryFile = plan.filesToCreate[0] || plan.filesToUpdate[0];
      if (primaryFile) {
        onSwitchToDeveloper(primaryFile);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Build pipeline failed.');
      setTaskStage('idle');
      setActiveTaskId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080914] text-slate-100 overflow-hidden">
      {/* Top Header Banner */}
      <div className="border-b border-white/10 bg-[#0d0f22] px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
              <Compass className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-wide">
              Product Manager Workspace
            </h2>
            <Badge variant="outline" className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300 text-[10px]">
              AI Architect & PM
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Define requirements, target personas, MVP scope, and dispatch tasks to the Coding Agent.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onSwitchToDeveloper()}
          className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs gap-1.5"
        >
          <Code2 className="h-3.5 w-3.5 text-indigo-400" />
          <span>Switch to Developer IDE</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
          {/* Idea Input Card */}
          <div className="rounded-2xl border border-white/10 bg-[#0f1128] p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-2 text-indigo-300 font-semibold text-sm">
              <Lightbulb className="h-4 w-4 text-indigo-400" />
              <span>Describe Product Vision & Features</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Enter your product idea. The AI Product Manager will analyze the project and craft a comprehensive specification with Vision, Personas, MVP boundaries, Features, User Stories, Roadmap, and actionable Development Tasks.
            </p>

            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. Build a modern SaaS Analytics Dashboard with dark mode, interactive revenue charts, user conversion funnels, activity feed, and responsive navigation."
              rows={3}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition"
            />

            <div className="mt-3 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                Operating on current project: <span className="text-slate-300 font-medium">{project?.name ?? 'AI Studio Project'}</span> ({files.filter(f => !f.is_folder).length} files)
              </div>
              <Button
                onClick={handleGeneratePlan}
                disabled={isGeneratingPlan || !idea.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-2 font-medium px-4 shadow-lg shadow-indigo-600/30"
              >
                {isGeneratingPlan ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Architecting Product Plan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Generate Product Plan</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Active Generation Status Modal/Banner */}
          {activeTaskId && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-4 backdrop-blur shadow-2xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {taskStage === 'architecting' && 'Phase 1: Technical Architect Agent formulating plan...'}
                      {taskStage === 'coding' && 'Phase 2: Coding Agent writing modular source files...'}
                      {taskStage === 'done' && 'Phase 3: Source files committed and persisted!'}
                    </h4>
                    <p className="text-xs text-indigo-300/80">
                      Task: {productPlan?.developmentTasks.find(t => t.id === activeTaskId)?.title}
                    </p>
                  </div>
                </div>

                {architectPlan && (
                  <Button
                    size="sm"
                    onClick={() => onSwitchToDeveloper()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
                  >
                    <span>View in Editor</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Plan Render Section */}
          {productPlan && (
            <div className="space-y-6">
              {/* Row 1: Vision & MVP Scope */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Product Vision */}
                <div className="rounded-2xl border border-white/10 bg-[#0d0f22] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                    <Target className="h-4 w-4" />
                    <span>Product Vision</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-300">Core Purpose: </span>
                      <span className="text-slate-400">{productPlan.vision.purpose}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-300">Value Proposition: </span>
                      <span className="text-slate-400">{productPlan.vision.valueProposition}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-300">Target Outcome: </span>
                      <span className="text-slate-400">{productPlan.vision.targetOutcome}</span>
                    </div>
                  </div>
                </div>

                {/* MVP Scope */}
                <div className="rounded-2xl border border-white/10 bg-[#0d0f22] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>MVP Boundaries</span>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-semibold text-emerald-300 block mb-1">Must-Have (In Scope):</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                        {productPlan.mvp.mustHave.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-rose-300 block mb-1">Exclusions (Out of Scope):</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                        {productPlan.mvp.exclusions.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Target Personas */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0f22] p-5 space-y-4">
                <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                  <Users className="h-4 w-4" />
                  <span>Target User Personas</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {productPlan.personas.map((p, idx) => (
                    <div key={idx} className="rounded-xl border border-white/5 bg-black/30 p-3 space-y-1.5 text-xs">
                      <div className="font-semibold text-indigo-300 text-xs">{p.role}</div>
                      <div>
                        <span className="text-slate-400 font-medium">Needs: </span>
                        <span className="text-slate-300 text-[11px]">{p.needs}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Pain Points: </span>
                        <span className="text-rose-300/80 text-[11px]">{p.painPoints}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 3: Feature Matrix */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0f22] p-5 space-y-4">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                  <Layers className="h-4 w-4" />
                  <span>Feature Prioritization</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {productPlan.features.map((feat) => (
                    <div key={feat.id} className="rounded-xl border border-white/5 bg-black/30 p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{feat.title}</span>
                        <Badge
                          variant="secondary"
                          className={`text-[9px] uppercase tracking-wider ${
                            feat.priority === 'high'
                              ? 'bg-red-500/15 text-red-300 border-red-500/20'
                              : feat.priority === 'medium'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                              : 'bg-slate-500/15 text-slate-300 border-slate-500/20'
                          }`}
                        >
                          {feat.priority}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400">{feat.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 4: Roadmap Milestones */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0f22] p-5 space-y-4">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Release Roadmap</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {productPlan.roadmap.map((milestone, idx) => (
                    <div key={idx} className="rounded-xl border border-white/5 bg-black/30 p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-300 text-xs">Phase {idx + 1}</span>
                        {milestone.targetWeek && (
                          <span className="text-[10px] text-slate-500 font-mono">{milestone.targetWeek}</span>
                        )}
                      </div>
                      <div className="font-medium text-slate-200 text-xs">{milestone.milestone}</div>
                      <p className="text-[11px] text-slate-400">{milestone.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 5: Actionable Development Tasks */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0f22] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                    <ListTodo className="h-4 w-4" />
                    <span>Actionable Development Tasks ({productPlan.developmentTasks.length})</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Each task passes through the Technical Architect before the Coding Agent writes files
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {productPlan.developmentTasks.map((task, idx) => {
                    const isBuildingThis = activeTaskId === task.id;
                    return (
                      <div
                        key={task.id}
                        className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
                          isBuildingThis
                            ? 'border-indigo-500/60 bg-indigo-950/20 shadow-md ring-1 ring-indigo-500/40'
                            : 'border-white/10 bg-black/40 hover:border-white/20'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-white">
                              {idx + 1}. {task.title}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase tracking-wider font-mono border-indigo-500/30 text-indigo-300 bg-indigo-500/10"
                            >
                              {task.category}
                            </Badge>
                          </div>

                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {task.description}
                          </p>

                          {/* Affected Files */}
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            {task.affectedFiles.map((fPath) => (
                              <span
                                key={fPath}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-400"
                              >
                                <FileCode className="h-2.5 w-2.5 text-indigo-400" />
                                <span>{fPath}</span>
                              </span>
                            ))}
                          </div>

                          {/* Acceptance Criteria */}
                          <div className="pt-2 border-t border-white/5 space-y-1">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                              Acceptance Criteria:
                            </span>
                            <ul className="space-y-0.5 text-[11px] text-slate-300">
                              {task.acceptanceCriteria.map((crit, cIdx) => (
                                <li key={cIdx} className="flex items-start gap-1.5">
                                  <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                                  <span>{crit}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Build Action Button */}
                        <div className="pt-4 mt-3 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-mono">
                            Status: {isBuildingThis ? 'Building...' : 'Ready'}
                          </span>
                          <Button
                            size="sm"
                            disabled={Boolean(activeTaskId)}
                            onClick={() => handleBuildFeature(task)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 font-medium px-3 shadow-md shadow-indigo-600/30"
                          >
                            {isBuildingThis ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Building...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3" />
                                <span>Build This Feature</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
