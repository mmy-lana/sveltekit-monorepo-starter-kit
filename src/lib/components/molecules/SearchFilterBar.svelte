<script lang="ts">
  import type { PackageType } from '$lib/types';
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import Input from '$lib/components/ui/Input.svelte';

  const types: PackageType[] = ['app', 'lib', 'tool', 'config'];
</script>

<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
  <div class="flex-1">
    <Input
      bind:value={monorepoStore.searchQuery}
      placeholder="Search packages, tags or dependencies..."
      ariaLabel="Search workspace packages"
      onclear={() => (monorepoStore.searchQuery = '')}
    />
  </div>
  <div class="flex items-center gap-1.5 flex-wrap">
    {#each types as t}
      <button
        type="button"
        onclick={() => monorepoStore.toggleTypeFilter(t)}
        class="px-3 py-2 text-xs font-mono rounded-lg border min-h-[44px] transition-colors {monorepoStore.selectedTypes.includes(t) ? 'bg-blue-600/20 text-blue-400 border-blue-500' : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700'}"
      >
        {t.toUpperCase()}
      </button>
    {/each}
  </div>
</div>
