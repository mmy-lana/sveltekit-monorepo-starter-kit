<script lang="ts">
  import type { PackageType, TaskStatus } from '$lib/types';
  import type { Snippet } from 'svelte';

  interface Props {
    type?: PackageType;
    status?: TaskStatus;
    label?: string;
    children?: Snippet;
  }

  let { type, status, label, children }: Props = $props();

  const typeConfig: Record<PackageType, { bg: string; text: string; border: string }> = {
    app: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
    lib: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    tool: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    config: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' }
  };

  const statusConfig: Record<TaskStatus, { bg: string; text: string; border: string }> = {
    idle: { bg: 'bg-neutral-800', text: 'text-neutral-400', border: 'border-neutral-700' },
    queued: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    running: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    success: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
    failure: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
    cached: { bg: 'bg-cyan-500/10', text: 'text-cyan-300', border: 'border-cyan-500/30' }
  };

  let styling = $derived.by(() => {
    if (type && type in typeConfig) return typeConfig[type];
    if (status && status in statusConfig) return statusConfig[status];
    return { bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-neutral-700' };
  });

  let display = $derived(label || (type ? type.toUpperCase() : status ? status.toUpperCase() : ''));
</script>

<span
  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border {styling.bg} {styling.text} {styling.border}"
>
  {#if children}
    {@render children()}
  {:else}
    {display}
  {/if}
</span>
