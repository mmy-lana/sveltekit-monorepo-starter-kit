<script lang="ts">
  import type { PackageType, TaskStatus } from '$lib/types';
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';

  const types: PackageType[] = ['app', 'lib', 'tool', 'config'];

  const statusOptions = [
    { label: 'Any status', value: 'all' },
    { label: 'Success', value: 'success' },
    { label: 'Cached', value: 'cached' },
    { label: 'Failure', value: 'failure' },
    { label: 'Running', value: 'running' },
    { label: 'Queued', value: 'queued' },
    { label: 'Idle', value: 'idle' }
  ];

  let statusValue = $derived(monorepoStore.selectedStatus);
</script>

<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full min-w-0">
  <div class="flex-1 min-w-0">
    <Input
      bind:value={monorepoStore.searchQuery}
      placeholder="Search packages, tags or dependencies..."
      ariaLabel="Search workspace packages"
      onclear={() => (monorepoStore.searchQuery = '')}
    />
  </div>

  <div class="flex items-center gap-1.5 flex-wrap">
    <div class="w-full sm:w-40 shrink-0">
      <Select
        options={statusOptions}
        value={statusValue}
        ariaLabel="Filter packages by latest build status"
        onchange={(val) => (monorepoStore.selectedStatus = val as TaskStatus | 'all')}
      />
    </div>

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
