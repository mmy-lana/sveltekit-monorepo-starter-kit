<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    children?: Snippet;
    actions?: Snippet;
    class?: string;
    onclick?: () => void;
  }

  let { title, subtitle, children, actions, class: className = '', onclick }: Props = $props();
</script>

<div
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : undefined}
  {onclick}
  onkeydown={(e) => {
    if (onclick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onclick();
    }
  }}
  class="bg-[#111115] border border-neutral-800/80 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:border-neutral-700/80 text-left {onclick ? 'cursor-pointer' : ''} {className}"
>
  {#if title || actions}
    <div class="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-neutral-800/50">
      <div>
        {#if title}
          <h3 class="text-sm font-semibold text-neutral-200 tracking-tight">{title}</h3>
        {/if}
        {#if subtitle}
          <p class="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex items-center gap-2">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}

  {#if children}
    <div class="w-full flex-1">
      {@render children()}
    </div>
  {/if}
</div>
