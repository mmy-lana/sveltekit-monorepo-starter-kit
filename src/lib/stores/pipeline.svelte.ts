import type { PipelineRun, PipelineStep, TaskStatus, WorkspacePackage } from '$lib/types';
import { monorepoStore } from '$lib/stores/monorepo.svelte';
import { getTopologicalOrder } from '$lib/utils/dag';

/**
 * Seeded from persisted state so run history survives a route change or reload.
 * `monorepoStore.pipelineRuns` is hydrated from localStorage by the storage
 * module before this store is ever constructed.
 */
let runs = $state<PipelineRun[]>(monorepoStore.pipelineRuns);
let activeRunId = $state<string | null>(runs[0]?.id ?? null);
let isExecuting = $state<boolean>(false);

function buildInitialLogs(): string[] {
  const header = [
    'System initialized. Monorepo execution engine ready.',
    'Topological batch ordering active.'
  ];
  const last = runs[0];
  if (!last) return header;

  const restored = last.steps.flatMap((step) => [
    ...step.stdout.map((line) => `[restored] ${line}`),
    ...step.stderr.map((line) => `[restored] ${line}`)
  ]);

  return restored.length > 0 ? [...header, `Restored ${last.steps.length} steps from run ${last.id}.`, ...restored] : header;
}

let terminalLogs = $state<string[]>(buildInitialLogs());

/**
 * Cache key for a workspace: its own `updatedAt` combined with the `updatedAt`
 * of every transitive internal dependency. Per the cache contract, a step may
 * only resolve to `cached` when this fingerprint is unchanged since the prior
 * successful run for the same script.
 */
function computeCacheFingerprint(pkg: WorkspacePackage, packages: WorkspacePackage[]): string {
  const byId = new Map(packages.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const stamps: string[] = [];

  const visit = (current: WorkspacePackage): void => {
    if (seen.has(current.id)) return;
    seen.add(current.id);
    stamps.push(`${current.id}@${current.updatedAt}`);
    for (const dep of current.dependencies) {
      if (!dep.isInternal) continue;
      const target = byId.get(dep.id);
      if (target) visit(target);
    }
  };

  visit(pkg);
  return stamps.sort().join('|');
}

function newRunId(command: string): string {
  return `run-${Date.now()}-${command}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Deterministic, seedable pseudo-random so simulated durations are stable per run. */
function seededDuration(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const span = Math.abs(hash % (max - min + 1));
  return min + span;
}

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

  resetRuns() {
    runs = [];
    activeRunId = null;
    isExecuting = false;
    monorepoStore.syncPipelineRuns([]);
  },

  async runPipeline(command: 'build' | 'test' | 'lint') {
    if (isExecuting) return;

    const packages = monorepoStore.packages;
    const { executionBatches, hasCycle, cyclePath } = getTopologicalOrder(packages);
    const startedAt = new Date().toISOString();

    if (hasCycle) {
      // DATA-02: a cyclic graph is a first-class outcome, not a silent no-op.
      // Record it so the run history and visualizer can surface the diagnosis.
      const diagnostic = cyclePath?.join(' -> ') ?? 'unknown cycle';
      const diagnosticSteps: PipelineStep[] = [
        {
          id: `step-blocked-${Date.now()}`,
          workspaceId: 'pipeline-engine',
          scriptName: command,
          status: 'failure',
          exitCode: 1,
          durationMs: 0,
          stdout: [],
          stderr: [
            'Pipeline dispatch aborted: workspace graph contains a circular dependency.',
            `Detected cycle: ${diagnostic}`,
            'Resolve the cycle before dispatching a topological build.'
          ],
          cached: false,
          startedAt,
          completedAt: new Date().toISOString()
        }
      ];

      const blockedRun: PipelineRun = {
        id: newRunId(command),
        trigger: 'manual',
        command,
        scope: packages.map((p) => p.name),
        status: 'failure',
        totalDurationMs: 0,
        steps: diagnosticSteps,
        createdAt: startedAt,
        completedAt: new Date().toISOString()
      };

      runs = [blockedRun, ...runs];
      activeRunId = blockedRun.id;
      monorepoStore.syncPipelineRuns(runs);
      pipelineStore.appendLog(`ERROR: pipeline blocked by circular dependency: ${diagnostic}`);
      for (const line of diagnosticSteps[0].stderr) {
        pipelineStore.appendLog(line);
      }
      return;
    }

    isExecuting = true;
    const runId = newRunId(command);
    activeRunId = runId;

    // Fingerprints are captured *before* the run so the next run can compare
    // against them. Deterministic and derived purely from workspace timestamps.
    const previousSuccess = new Map<string, string>();
    for (const run of runs) {
      if (run.status !== 'success' || run.command !== command) continue;
      for (const step of run.steps) {
        if (step.status !== 'success' && step.status !== 'cached') continue;
        const pkg = packages.find((p) => p.id === step.workspaceId);
        if (!pkg) continue;
        if (!previousSuccess.has(step.workspaceId)) {
          previousSuccess.set(step.workspaceId, computeCacheFingerprint(pkg, packages));
        }
      }
    }

    const steps: PipelineStep[] = [];
    for (const batch of executionBatches) {
      for (const pkgId of batch) {
        const pkg = packages.find((p) => p.id === pkgId);
        if (!pkg) continue;
        if (!pkg.scripts.some((s) => s.name === command)) continue;

        const isCacheHit =
          previousSuccess.get(pkgId) !== undefined &&
          previousSuccess.get(pkgId) === computeCacheFingerprint(pkg, packages);

        steps.push({
          id: `step-${pkgId}-${command}`,
          workspaceId: pkgId,
          scriptName: command,
          status: 'queued',
          exitCode: null,
          durationMs: 0,
          stdout: [],
          stderr: [],
          cached: isCacheHit,
          startedAt: null,
          completedAt: null
        });
      }
    }

    const newRun: PipelineRun = {
      id: runId,
      trigger: 'manual',
      command,
      scope: packages.map((p) => p.name),
      status: 'running',
      totalDurationMs: 0,
      steps,
      createdAt: startedAt,
      completedAt: null
    };

    runs = [newRun, ...runs];
    monorepoStore.syncPipelineRuns(runs);
    pipelineStore.appendLog(`Starting '${command}' across ${steps.length} target steps`);

    // Read steps back *through* the $state proxy so in-flight mutations are
    // reactive; mutating the raw pre-state object would not notify consumers.
    const reactiveRun = runs.find((r) => r.id === runId);
    if (!reactiveRun) {
      isExecuting = false;
      return;
    }

    const startTime = Date.now();
    let anyFailed = false;

    for (const batch of executionBatches) {
      const batchSteps = reactiveRun.steps.filter((s) => batch.includes(s.workspaceId));
      if (batchSteps.length === 0) continue;

      await Promise.all(
        batchSteps.map(async (step) => {
          const pkg = packages.find((p) => p.id === step.workspaceId);
          if (!pkg) return;

          step.status = 'running';
          step.startedAt = new Date().toISOString();
          pipelineStore.appendLog(`[${pkg.name}] ${command} started`);

          if (step.cached) {
            // Cache contract: exitCode 0, durationMs 0, cached true.
            await new Promise((resolve) => setTimeout(resolve, 90));
            step.status = 'cached';
            step.exitCode = 0;
            step.durationMs = 0;
            step.cached = true;
            step.stdout = [`> ${pkg.name}@${pkg.version} ${command}`, 'Restored from execution cache.'];
            step.completedAt = new Date().toISOString();
            pipelineStore.appendLog(`[${pkg.name}] cache hit (0ms)`);
            return;
          }

          const script = pkg.scripts.find((s) => s.name === command);
          const scriptCommand = script?.command ?? `${command}`;
          const simulatedMs = seededDuration(`${runId}:${step.workspaceId}`, 180, 620);
          await new Promise((resolve) => setTimeout(resolve, simulatedMs));

          // Deterministic failure injection: a hash of the run + workspace id.
          // Reproducible for a given run id, so the simulation is stable and
          // testable rather than an unseeded coin flip.
          const fails = seededDuration(`${runId}:${step.workspaceId}:fail`, 0, 99) < 12;

          step.durationMs = simulatedMs;
          step.completedAt = new Date().toISOString();
          step.stdout = [
            `> ${pkg.name}@${pkg.version} ${command}`,
            `$ ${scriptCommand}`,
            `resolved ${pkg.dependencies.length} workspace dependencies`
          ];

          if (fails) {
            anyFailed = true;
            step.status = 'failure';
            step.exitCode = 1;
            step.stderr = [
              `error: '${command}' failed in ${pkg.name}`,
              `  at ${pkg.path} (${scriptCommand})`
            ];
            pipelineStore.appendLog(`[${pkg.name}] FAILED (exit 1) after ${simulatedMs}ms`);
          } else {
            step.status = 'success';
            step.exitCode = 0;
            step.cached = false;
            pipelineStore.appendLog(`[${pkg.name}] succeeded in ${simulatedMs}ms`);
          }
        })
      );
    }

    const totalDuration = Date.now() - startTime;
    reactiveRun.status = anyFailed ? 'failure' : 'success';
    reactiveRun.totalDurationMs = totalDuration;
    reactiveRun.completedAt = new Date().toISOString();

    // Re-assign to commit the completed run object into the reactive list.
    runs = [reactiveRun, ...runs.filter((r) => r.id !== runId)];
    isExecuting = false;
    monorepoStore.syncPipelineRuns(runs);
    pipelineStore.appendLog(
      `Pipeline '${command}' ${reactiveRun.status} in ${totalDuration}ms`
    );
  }
};

/** Latest known status for a workspace, used by package cards. */
export function getLatestRunStatus(workspaceId: string): TaskStatus | null {
  for (const run of runs) {
    const step = run.steps.find((s) => s.workspaceId === workspaceId);
    if (step) return step.status;
  }
  return null;
}
