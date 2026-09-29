<script lang="ts">
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import { pipelineStore } from '$lib/stores/pipeline.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import DependencyListRow from '$lib/components/molecules/DependencyListRow.svelte';
  import Select from '$lib/components/ui/Select.svelte';

  let activePkg = $derived(monorepoStore.activePackage);
  let availableLinkTargets = $derived.by(() => {
    if (!activePkg) return [];
    return monorepoStore.packages
      .filter((p) => p.id !== activePkg.id && !activePkg.dependencies.some((d) => d.id === p.id))
      .map((p) => ({ label: p.name, value: p.id }));
  });

  let selectedLinkTarget = $state('');
  let linkError = $state<string | null>(null);

  function handleAddLink() {
    if (!activePkg || !selectedLinkTarget) return;
    linkError = null;
    const res = monorepoStore.linkDependency(activePkg.id, selectedLinkTarget);
    if (!res.success) {
      linkError = res.error || 'Failed to link dependency';
    } else {
      selectedLinkTarget = '';
    }
  }

  function handleDelete() {
    if (!activePkg) return;
    if (confirm(`Are you sure you want to delete ${activePkg.name}?`)) {
      monorepoStore.removePackage(activePkg.id, true);
    }
  }
</script>

{#if activePkg}
  <div
    class="fixed inset-0 z-40 lg:hidden bg-black/60 backdrop-blur-xs"
    role="button"
    tabindex="0"
    onclick={() => monorepoStore.setActiveWorkspace(null)}
    onkeydown={(e) => {
      if (e.key === 'Escape') monorepoStore.setActiveWorkspace(null);
    }}
  ></div>

  <aside
    class="fixed top-0 right-0 z-50 h-screen w-full sm:w-[460px] bg-neutral-900 border-l border-neutral-800 p-6 flex flex-col justify-between overflow-y-auto shadow-2xl transition-transform"
  >
    <div class="space-y-6">
      <div class="flex items-start justify-between border-b border-neutral-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-base font-bold font-mono text-neutral-100">{activePkg.name}</h2>
            <Badge type={activePkg.type} />
          </div>
          <p class="text-xs text-neutral-500 font-mono mt-1">{activePkg.path} (v{activePkg.version})</p>
        </div>
        <button
          type="button"
          onclick={() => monorepoStore.setActiveWorkspace(null)}
          class="text-neutral-400 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      <div>
        <h4 class="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">Description</h4>
        <p class="text-xs text-neutral-300 leading-relaxed bg-neutral-950 p-3 rounded-lg border border-neutral-800">
          {activePkg.description || 'No description provided.'}
        </p>
      </div>

      <div>
        <h4 class="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">Scripts Manifest</h4>
        <div class="space-y-2">
          {#each activePkg.scripts as script}
            <div class="flex items-center justify-between p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
              <span class="font-mono text-xs text-neutral-300">{script.name}</span>
              <Button
                variant="outline"
                size="sm"
                onclick={() => pipelineStore.runPipeline(script.name as 'build' | 'test' | 'lint')}
              >
                Run
              </Button>
            </div>
          {/each}
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-mono uppercase tracking-wider text-neutral-400">Workspace Dependencies</h4>
          <span class="text-xs font-mono text-neutral-500">{activePkg.dependencies.length}</span>
        </div>

        <div class="space-y-2">
          {#if activePkg.dependencies.length === 0}
            <div class="text-xs text-neutral-500 italic p-3 bg-neutral-950 rounded-lg border border-neutral-800">
              No internal or external dependencies linked.
            </div>
          {:else}
            {#each activePkg.dependencies as dep}
              <DependencyListRow
                dependency={dep}
                onunlink={() => monorepoStore.unlinkDependency(activePkg.id, dep.id)}
                onselect={(id) => monorepoStore.setActiveWorkspace(id)}
              />
            {/each}
          {/if}
        </div>

        {#if availableLinkTargets.length > 0}
          <div class="mt-4 p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-2">
            <span class="text-[11px] font-mono text-neutral-400">Link Monorepo Package:</span>
            <div class="flex items-center gap-2">
              <Select
                options={[{ label: 'Select workspace...', value: '' }, ...availableLinkTargets]}
                bind:value={selectedLinkTarget}
              />
              <Button variant="primary" size="sm" onclick={handleAddLink} disabled={!selectedLinkTarget}>
                Link
              </Button>
            </div>
            {#if linkError}
              <p class="text-xs text-red-400 font-mono">{linkError}</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div class="pt-6 border-t border-neutral-800">
      <Button variant="danger" size="md" class="w-full" onclick={handleDelete}>
        Delete Workspace
      </Button>
    </div>
  </aside>
{/if}
