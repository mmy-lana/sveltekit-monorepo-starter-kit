<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    children?: Snippet;
    actions?: Snippet;
    class?: string;
    onclick?: () => void;
    ariaLabel?: string;
  }

  let { title, subtitle, children, actions, class: className = '', onclick, ariaLabel }: Props =
    $props();

  const SURFACE =
    'bg-[#111115] border border-neutral-800/80 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all text-left min-w-0 max-w-full';
</script>

{#snippet body()}
  {#if title || actions}
    <div class="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-neutral-800/50">
      <div class="min-w-0">
        {#if title}
          <h3 class="text-sm font-semibold text-neutral-200 tracking-tight break-words">{title}</h3>
        {/if}
        {#if subtitle}
          <p class="text-xs text-neutral-500 mt-0.5 break-all">{subtitle}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex items-center gap-2 shrink-0">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}

  {#if children}
    <div class="w-full flex-1 min-w-0">
      {@render children()}
    </div>
  {/if}
{/snippet}

{#if onclick}
  <!-- Native button semantics: keyboard activation and focus come for free. -->
  <button
    type="button"
    onclick={onclick}
    aria-label={ariaLabel ?? title}
    class="{SURFACE} w-full cursor-pointer hover:border-neutral-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 {className}"
  >
    {@render body()}
  </button>
{:else}
  <div class="{SURFACE} hover:border-neutral-700/80 {className}">
    {@render body()}
  </div>
{/if}
