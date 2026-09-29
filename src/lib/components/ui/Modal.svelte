<script lang="ts">
  import type { Snippet } from 'svelte';
  import { monorepoStore } from '$lib/stores/monorepo.svelte';

  interface Props {
    id: string;
    title: string;
    isOpen: boolean;
    onclose: () => void;
    children?: Snippet;
  }

  let { id, title, isOpen, onclose, children }: Props = $props();

  $effect(() => {
    if (isOpen) {
      monorepoStore.setOpenModal(id);
    } else if (monorepoStore.openModalId === id) {
      monorepoStore.setOpenModal(null);
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-neutral-900 border border-neutral-800 rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800">
        <h2 class="text-sm font-bold text-neutral-200 uppercase tracking-wider">{title}</h2>
        <button
          type="button"
          onclick={onclose}
          class="text-neutral-400 hover:text-neutral-100 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
          aria-label="Close dialog"
        >
          ✕
        </button>
      </div>
      <div class="p-5 overflow-y-auto flex-1">
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  </div>
{/if}
