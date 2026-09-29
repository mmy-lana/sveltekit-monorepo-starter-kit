<script lang="ts">
  import GraphCanvas from '$lib/components/features/GraphCanvas.svelte';
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import MetricBadge from '$lib/components/molecules/MetricBadge.svelte';

  let totalNodes = $derived(monorepoStore.packages.length);
  let totalEdges = $derived(
    monorepoStore.packages.reduce((acc, p) => acc + p.dependencies.filter((d) => d.isInternal).length, 0)
  );
</script>

<svelte:head>
  <title>Dependency Graph | Monorepo Platform</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-lg font-bold font-mono text-white uppercase tracking-wider">Dependency Graph Matrix</h1>
      <p class="text-xs text-neutral-400 mt-1">Interactive topological package visualizer and circular reference monitor</p>
    </div>
    <div class="flex items-center gap-3">
      <MetricBadge label="Nodes" value={totalNodes} />
      <MetricBadge label="Edges" value={totalEdges} />
    </div>
  </div>

  <GraphCanvas />
</div>
