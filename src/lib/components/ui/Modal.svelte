<script lang="ts">
  import type { Snippet } from 'svelte';
  import { monorepoStore } from '$lib/stores/monorepo.svelte';

  interface Props {
    id: string;
    title: string;
    isOpen: boolean;
    onclose: () => void;
    children?: Snippet;
    footer?: Snippet;
    labelledBy?: string;
  }

  let { id, title, isOpen, onclose, children, footer, labelledBy }: Props = $props();

  let dialogEl = $state<HTMLDivElement | undefined>();
  let previouslyFocused: HTMLElement | null = null;

  const FOCUSABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusable(): HTMLElement[] {
    if (!dialogEl) return [];
    return Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
  }

  // Global stacking rule: only one modal/drawer may be registered at a time.
  $effect(() => {
    if (isOpen) {
      monorepoStore.setOpenModal(id);
    } else if (monorepoStore.openModalId === id) {
      monorepoStore.setOpenModal(null);
    }
  });

  // Focus management + body scroll lock. Every listener and style touched here is
  // released on teardown, so no dangling document handlers survive unmount.
  $effect(() => {
    if (!isOpen) return;

    previouslyFocused = document.activeElement as HTMLElement | null;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Defer so the dialog subtree exists before we query focusable nodes.
    const focusFrame = requestAnimationFrame(() => {
      const [first] = focusable();
      (first ?? dialogEl)?.focus();
    });

    const handleKeydown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onclose();
        return;
      }

      if (e.key !== 'Tab') return;

      const nodes = focusable();
      if (nodes.length === 0) {
        e.preventDefault();
        dialogEl?.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || active === dialogEl)) {
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
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-xs"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) onclose();
    }}
  >
    <div
      bind:this={dialogEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy ?? `${id}-title`}
      aria-describedby={`${id}-body`}
      tabindex="-1"
      class="bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-xl max-w-lg w-full sm:max-h-[90vh] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl focus:outline-none"
      data-testid="modal-dialog"
    >
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 shrink-0">
        <h2 id={`${id}-title`} class="text-sm font-bold text-neutral-200 uppercase tracking-wider">
          {title}
        </h2>
        <button
          type="button"
          onclick={onclose}
          class="text-neutral-400 hover:text-neutral-100 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
          aria-label="Close dialog"
        >
          &#10005;
        </button>
      </div>

      <div id={`${id}-body`} class="p-5 overflow-y-auto flex-1 overscroll-contain">
        {#if children}
          {@render children()}
        {/if}
      </div>

      {#if footer}
        <div class="px-5 py-3.5 border-t border-neutral-800 shrink-0">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
