<script lang="ts">
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  interface Props {
    onScaffoldClick: () => void;
  }

  let { onScaffoldClick }: Props = $props();

  let list = $derived(monorepoStore.filteredPackages());
</script>

{#if list.length === 0}
  <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-8 sm:p-12 text-center max-w-md mx-auto my-12">
    <div class="w-12 h-12 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto mb-4 font-mono text-xl">
      [0]
    </div>
    <h3 class="text-sm font-bold uppercase tracking-wider text-neutral-200">No Packages Detected</h3>
    <p class="text-xs text-neutral-400 mt-2 mb-6">
      No workspaces matching your query. Scaffold a new application or shared library module to get started.
    </p>
    <Button variant="primary" size="md" onclick={onScaffoldClick}>
      Scaffold New Package
    </Button>
  </div>
{:else}
  <div data-testid="workspace-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
    {#each list as pkg (pkg.id)}
      <Card
        title={pkg.name}
        subtitle={`${pkg.path} (v${pkg.version})`}
        onclick={() => monorepoStore.setActiveWorkspace(pkg.id)}
      >
        {#snippet actions()}
          <Badge type={pkg.type} />
        {/snippet}

        <div class="space-y-3 mt-1 min-w-0">
          <p class="text-xs text-neutral-400 line-clamp-2 leading-relaxed break-words">
            {pkg.description || 'No description available'}
          </p>

          <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono pt-3 border-t border-neutral-800/50">
            <span class="text-neutral-500">Deps: {pkg.dependencies.length}</span>
            <span class="text-neutral-500">Scripts: {pkg.scripts.length}</span>
            <span class="text-blue-400">Configure &rarr;</span>
          </div>
        </div>
      </Card>
    {/each}
  </div>
{/if}
