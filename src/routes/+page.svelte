<script lang="ts">
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import { pipelineStore } from '$lib/stores/pipeline.svelte';
  import MetricBadge from '$lib/components/molecules/MetricBadge.svelte';
  import SearchFilterBar from '$lib/components/molecules/SearchFilterBar.svelte';
  import WorkspaceGrid from '$lib/components/features/WorkspaceGrid.svelte';
  import ScaffoldWizardModal from '$lib/components/features/ScaffoldWizardModal.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let isWizardOpen = $state(false);

  let totalPackages = $derived(monorepoStore.packages.length);
  let appCount = $derived(monorepoStore.packages.filter((p) => p.type === 'app').length);
  let libCount = $derived(monorepoStore.packages.filter((p) => p.type === 'lib' || p.type === 'tool').length);
  let internalLinks = $derived(
    monorepoStore.packages.reduce((acc, p) => acc + p.dependencies.filter((d) => d.isInternal).length, 0)
  );
</script>

<svelte:head>
  <title>Monorepo Workspaces | Platform Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <!-- Telemetry HUD Overview -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <MetricBadge label="Workspaces" value={totalPackages} sublabel="Active packages" />
    <MetricBadge label="Apps" value={appCount} sublabel="Deployable targets" />
    <MetricBadge label="Libraries" value={libCount} sublabel="Shared packages" />
    <MetricBadge label="Interlinks" value={internalLinks} sublabel="Dependency edges" />
  </div>

  <!-- Action Bar & Filter -->
  <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
    <div class="flex-1">
      <SearchFilterBar />
    </div>
    <div class="flex items-center gap-2">
      <Button
        variant="secondary"
        size="md"
        onclick={() => pipelineStore.runPipeline('build')}
        loading={pipelineStore.isExecuting}
      >
        Build All
      </Button>
      <Button variant="primary" size="md" onclick={() => (isWizardOpen = true)}>
        + New Package
      </Button>
    </div>
  </div>

  <!-- Workspace Grid -->
  <WorkspaceGrid onScaffoldClick={() => (isWizardOpen = true)} />

  <!-- Scaffold Generator Modal -->
  <ScaffoldWizardModal isOpen={isWizardOpen} onclose={() => (isWizardOpen = false)} />
</div>
