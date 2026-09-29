<script lang="ts">
  import type { WorkspaceDependency } from '$lib/types';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  interface Props {
    dependency: WorkspaceDependency;
    onunlink?: () => void;
    onselect?: (id: string) => void;
  }

  let { dependency, onunlink, onselect }: Props = $props();
</script>

<div class="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-800/80 text-xs">
  <div class="flex items-center space-x-2">
    {#if dependency.isInternal}
      <button
        type="button"
        onclick={() => onselect?.(dependency.id)}
        class="font-mono font-semibold text-blue-400 hover:underline min-h-[32px] flex items-center"
      >
        {dependency.name}
      </button>
      <Badge label="workspace" />
    {:else}
      <span class="font-mono text-neutral-300">{dependency.name}</span>
      <Badge label="npm" />
    {/if}
    <span class="font-mono text-neutral-500">{dependency.version}</span>
  </div>

  {#if onunlink}
    <Button variant="ghost" size="sm" onclick={onunlink} class="text-red-400 hover:text-red-300 min-h-[32px] min-w-[32px]">
      ✕
    </Button>
  {/if}
</div>
