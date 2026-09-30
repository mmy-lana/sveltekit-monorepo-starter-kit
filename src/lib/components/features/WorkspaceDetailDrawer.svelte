<script lang="ts">
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import { pipelineStore } from '$lib/stores/pipeline.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import DependencyListRow from '$lib/components/molecules/DependencyListRow.svelte';
  import Select from '$lib/components/ui/Select.svelte';

  let activePkg = $derived(monorepoStore.drawerOpen ? monorepoStore.activePackage : undefined);
  let availableLinkTargets = $derived.by(() => {
    if (!activePkg) return [];
    return monorepoStore.packages
      .filter((p) => p.id !== activePkg.id && !activePkg.dependencies.some((d) => d.id === p.id))
      .map((p) => ({ label: p.name, value: p.id }));
  });

  let selectedLinkTarget = $state('');
  let linkError = $state<string | null>(null);
  let drawerEl = $state<HTMLDivElement | undefined>();
  let previouslyFocused: HTMLElement | null = null;

  const FOCUSABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusable(): HTMLElement[] {
    if (!drawerEl) return [];
    return Array.from(drawerEl.querySelectorAll<HTMLElement>(FOCUSABLE));
  }

  // Focus trap, body scroll lock and focus restore. Every listener and inline
  // style touched here is released on teardown, so unmounting the drawer leaves
  // nothing dangling on the document.
  $effect(() => {
    if (!activePkg) return;

    previouslyFocused = document.activeElement as HTMLElement | null;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const focusFrame = requestAnimationFrame(() => {
      const [first] = focusable();
      (first ?? drawerEl)?.focus();
    });

    const handleKeydown = (e: KeyboardEvent) => {
      if (!activePkg) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        monorepoStore.closeDrawer();
        return;
      }

      if (e.key !== 'Tab') return;

      const nodes = focusable();
      if (nodes.length === 0) {
        e.preventDefault();
        drawerEl?.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || active === drawerEl)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeydown, true);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeydown, true);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      previouslyFocused?.focus?.();
      previouslyFocused = null;
    };
  });

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

  let isConfirmingDelete = $state(false);

  function handleDelete() {
    if (!activePkg) return;
    if (!isConfirmingDelete) {
      isConfirmingDelete = true;
      return;
    }
    monorepoStore.removePackage(activePkg.id, true);
    monorepoStore.closeDrawer();
    isConfirmingDelete = false;
  }
</script>

{#if activePkg}
  <!-- Backdrop doubles as the click-outside close control. Escape is handled by
       the document-level trap below, so this stays a plain button. -->
  <button
    type="button"
    class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs cursor-default"
    aria-label="Close workspace details"
    onclick={() => monorepoStore.closeDrawer()}
  ></button>

  <!-- Bottom sheet below 1024px, right-docked drawer from 1024px up. -->
  <div
    bind:this={drawerEl}
    role="dialog"
    aria-modal="true"
    aria-label="Workspace details for {activePkg.name}"
    tabindex="-1"
    data-testid="workspace-drawer"
    class="fixed z-50 bg-neutral-900 border-neutral-800 p-5 sm:p-6 flex flex-col overflow-y-auto shadow-2xl
           inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl border-t
           lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[460px] lg:max-h-none lg:h-screen lg:rounded-none lg:rounded-l-2xl lg:border-t-0 lg:border-l"
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
          onclick={() => monorepoStore.closeDrawer()}
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

    <div class="pt-6 border-t border-neutral-800 flex gap-2">
      {#if isConfirmingDelete}
        <Button variant="ghost" size="md" class="w-1/2" onclick={() => (isConfirmingDelete = false)}>
          Cancel
        </Button>
        <Button variant="danger" size="md" class="w-1/2" onclick={handleDelete}>
          Confirm Delete
        </Button>
      {:else}
        <Button variant="danger" size="md" class="w-full" onclick={handleDelete}>
          Delete Workspace
        </Button>
      {/if}
    </div>
  </div>
{/if}
