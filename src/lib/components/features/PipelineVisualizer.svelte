<script lang="ts">
  import { pipelineStore } from '$lib/stores/pipeline.svelte';
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { formatDuration } from '$lib/utils/formatters';

  let currentRun = $derived(pipelineStore.activeRun);
  let history = $derived(pipelineStore.runs);
  let expandedStepId = $state<string | null>(null);

  function getPkgName(pkgId: string): string {
    const pkg = monorepoStore.packages.find((p) => p.id === pkgId);
    return pkg ? pkg.name : pkgId;
  }
</script>

<div class="space-y-4">
  <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
    <div class="flex items-center justify-between gap-3 border-b border-neutral-800 pb-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 shrink-0">
          Active Execution Run
        </span>
        {#if currentRun}
          <Badge status={currentRun.status} />
        {/if}
      </div>
      {#if currentRun}
        <span class="text-xs font-mono text-neutral-400 shrink-0">
          Total: {formatDuration(currentRun.totalDurationMs)}
        </span>
      {/if}
    </div>

    {#if !currentRun}
      <div class="text-xs text-neutral-500 font-mono py-8 text-center" data-testid="pipeline-no-run">
        No pipeline run active. Trigger a command from the control bar above.
      </div>
    {:else if currentRun.steps.length === 0}
      <div class="text-xs text-neutral-500 font-mono py-8 text-center">
        No workspace in this repository defines a <span class="text-neutral-400">{currentRun.command}</span> script.
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
        {#each currentRun.steps as step (step.id)}
          <div
            data-testid="pipeline-step"
            data-status={step.status}
            class="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg flex flex-col justify-between space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-mono font-medium text-neutral-200 truncate pr-2">
                {getPkgName(step.workspaceId)}
              </span>
              <Badge status={step.status} />
            </div>

            <div class="flex items-center justify-between gap-2 text-[11px] font-mono text-neutral-500">
              <span class="truncate">script: {step.scriptName}</span>
              <span class="shrink-0">{step.cached ? 'cached' : formatDuration(step.durationMs)}</span>
            </div>

            {#if step.stdout.length > 0 || step.stderr.length > 0}
              <button
                type="button"
                class="text-[10px] font-mono text-blue-400 hover:text-blue-300 min-h-[32px] text-left"
                aria-expanded={expandedStepId === step.id}
                onclick={() => (expandedStepId = expandedStepId === step.id ? null : step.id)}
              >
                {expandedStepId === step.id ? 'Hide output' : 'View output'}
              </button>

              {#if expandedStepId === step.id}
                <pre
                  class="text-[10px] font-mono bg-black/60 border border-neutral-800 rounded p-2 overflow-x-auto whitespace-pre text-neutral-400 max-h-40 overflow-y-auto"
                >{step.stdout.join('\n')}{#if step.stderr.length > 0}
{step.stderr.join('\n')}{/if}</pre>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
    <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-3">
      Run History
    </h3>

    {#if history.length === 0}
      <p class="text-xs text-neutral-500 font-mono py-6 text-center">No runs recorded yet.</p>
    {:else}
      <ul class="divide-y divide-neutral-800/70 mt-2">
        {#each history as run (run.id)}
          <li class="py-2.5 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-mono text-neutral-200 truncate">
                {run.command}
                <span class="text-neutral-600">· {run.trigger}</span>
              </p>
              <p class="text-[10px] font-mono text-neutral-500 truncate">
                {new Date(run.createdAt).toLocaleString()} · {run.steps.length} steps
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[10px] font-mono text-neutral-500">
                {formatDuration(run.totalDurationMs)}
              </span>
              <Badge status={run.status} />
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
