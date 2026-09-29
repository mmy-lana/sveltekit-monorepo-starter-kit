<script lang="ts">
  import { pipelineStore } from '$lib/stores/pipeline.svelte';
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { formatDuration } from '$lib/utils/formatters';

  let currentRun = $derived(pipelineStore.activeRun);

  function getPkgName(pkgId: string): string {
    const pkg = monorepoStore.packages.find((p) => p.id === pkgId);
    return pkg ? pkg.name : pkgId;
  }
</script>

<div class="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
  <div class="flex items-center justify-between border-b border-neutral-800 pb-3">
    <div class="flex items-center space-x-2">
      <span class="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">Active Execution Run</span>
      {#if currentRun}
        <Badge status={currentRun.status} />
      {/if}
    </div>
    {#if currentRun}
      <span class="text-xs font-mono text-neutral-400">Total: {formatDuration(currentRun.totalDurationMs)}</span>
    {/if}
  </div>

  {#if !currentRun}
    <div class="text-xs text-neutral-500 font-mono py-8 text-center">
      No pipeline run active. Trigger a command from the control bar above.
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {#each currentRun.steps as step}
        <div class="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg flex flex-col justify-between space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-medium text-neutral-200 truncate pr-2">{getPkgName(step.workspaceId)}</span>
            <Badge status={step.status} />
          </div>
          <div class="flex items-center justify-between text-[11px] font-mono text-neutral-500">
            <span>script: {step.scriptName}</span>
            <span>{step.cached ? 'cached' : formatDuration(step.durationMs)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
