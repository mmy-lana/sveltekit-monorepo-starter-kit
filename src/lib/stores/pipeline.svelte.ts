import type { PipelineRun, PipelineStep, TaskStatus } from '$lib/types';
import { monorepoStore } from '$lib/stores/monorepo.svelte';
import { getTopologicalOrder } from '$lib/utils/dag';

let runs = $state<PipelineRun[]>([]);
let activeRunId = $state<string | null>(null);
let isExecuting = $state<boolean>(false);
let terminalLogs = $state<string[]>([
  'System initialized. Monorepo execution engine ready.',
  'Topological batch ordering active.'
]);

export const pipelineStore = {
  get runs() {
    return runs;
  },
  get activeRunId() {
    return activeRunId;
  },
  get activeRun(): PipelineRun | undefined {
    return runs.find((r) => r.id === activeRunId);
  },
  get isExecuting() {
    return isExecuting;
  },
  get terminalLogs() {
    return terminalLogs;
  },

  clearLogs() {
    terminalLogs = [];
  },

  appendLog(line: string) {
    terminalLogs = [...terminalLogs, `[${new Date().toLocaleTimeString()}] ${line}`];
  },

  async runPipeline(command: 'build' | 'test' | 'lint') {
    if (isExecuting) return;

    const packages = monorepoStore.packages;
    const { executionBatches, hasCycle, cyclePath } = getTopologicalOrder(packages);

    if (hasCycle) {
      pipelineStore.appendLog(`ERROR: Pipeline execution blocked. Cycle detected: ${cyclePath?.join(' -> ')}`);
      return;
    }

    isExecuting = true;
    const runId = `run-${Date.now()}`;
    activeRunId = runId;

    const initialSteps: PipelineStep[] = [];
    for (const batch of executionBatches) {
      for (const pkgId of batch) {
        const pkg = packages.find((p) => p.id === pkgId);
        if (!pkg) continue;
        const hasScript = pkg.scripts.some((s) => s.name === command);
        if (hasScript) {
          initialSteps.push({
            id: `step-${pkgId}-${command}`,
            workspaceId: pkgId,
            scriptName: command,
            status: 'queued',
            exitCode: null,
            durationMs: 0,
            stdout: [],
            stderr: [],
            cached: false,
            startedAt: null,
            completedAt: null
          });
        }
      }
    }

    const newRun: PipelineRun = {
      id: runId,
      trigger: 'manual',
      command,
      scope: packages.map((p) => p.name),
      status: 'running',
      totalDurationMs: 0,
      steps: initialSteps,
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    runs = [newRun, ...runs];
    pipelineStore.appendLog(`Starting execution pipeline '${command}' across ${initialSteps.length} target steps`);

    const startTime = Date.now();

    for (const batch of executionBatches) {
      const stepIdsInBatch = initialSteps
        .filter((s) => batch.includes(s.workspaceId))
        .map((s) => s.id);

      if (stepIdsInBatch.length === 0) continue;

      const batchPromises = stepIdsInBatch.map(async (stepId) => {
        const step = newRun.steps.find((s) => s.id === stepId);
        if (!step) return;

        const pkg = packages.find((p) => p.id === step.workspaceId);
        if (!pkg) return;

        step.status = 'running';
        step.startedAt = new Date().toISOString();
        pipelineStore.appendLog(`[${pkg.name}] Running '${command}'...`);

        const isMockCached = Math.random() > 0.6;

        if (isMockCached) {
          await new Promise((r) => setTimeout(r, 120));
          step.status = 'cached';
          step.exitCode = 0;
          step.durationMs = 0;
          step.cached = true;
          step.completedAt = new Date().toISOString();
          pipelineStore.appendLog(`[${pkg.name}] Cached output hit (0ms).`);
        } else {
          const simulatedMs = Math.floor(Math.random() * 400) + 180;
          await new Promise((r) => setTimeout(r, simulatedMs));
          step.status = 'success';
          step.exitCode = 0;
          step.durationMs = simulatedMs;
          step.cached = false;
          step.completedAt = new Date().toISOString();
          pipelineStore.appendLog(`[${pkg.name}] Completed successfully in ${simulatedMs}ms.`);
        }
      });

      await Promise.all(batchPromises);
    }

    const totalDuration = Date.now() - startTime;
    newRun.status = 'success';
    newRun.totalDurationMs = totalDuration;
    newRun.completedAt = new Date().toISOString();
    runs = [...runs];
    isExecuting = false;
    pipelineStore.appendLog(`Pipeline '${command}' finished in ${totalDuration}ms.`);
  }
};
