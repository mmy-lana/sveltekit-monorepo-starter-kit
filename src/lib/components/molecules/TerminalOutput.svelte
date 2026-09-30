<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';

  interface Props {
    logs: string[];
    onclear: () => void;
  }

  let { logs, onclear }: Props = $props();
  let filterText = $state('');

  let displayedLogs = $derived.by(() => {
    if (!filterText) return logs;
    return logs.filter((l) => l.toLowerCase().includes(filterText.toLowerCase()));
  });

  function copyAll() {
    navigator.clipboard?.writeText(logs.join('\n'));
  }
</script>

<div class="bg-black/90 border border-neutral-800 rounded-xl overflow-hidden flex flex-col h-full font-mono text-xs">
  <div class="flex items-center justify-between px-3 py-2 bg-neutral-900 border-b border-neutral-800 gap-2">
    <div class="flex items-center space-x-1.5">
      <span class="w-2.5 h-2.5 rounded-full bg-red-500/70 inline-block"></span>
      <span class="w-2.5 h-2.5 rounded-full bg-yellow-500/70 inline-block"></span>
      <span class="w-2.5 h-2.5 rounded-full bg-green-500/70 inline-block"></span>
      <span class="ml-2 font-mono text-neutral-400 text-[11px]">telemetry.stdout</span>
    </div>
    <div class="flex items-center gap-2">
      <input
        type="text"
        placeholder="Filter logs..."
        bind:value={filterText}
        class="bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300 px-2 py-1 rounded focus:outline-none min-h-[32px] w-28 sm:w-44"
      />
      <Button variant="ghost" size="sm" onclick={copyAll} class="min-h-[32px] min-w-[32px]">Copy</Button>
      <Button variant="ghost" size="sm" onclick={onclear} class="min-h-[32px] min-w-[32px]">Clear</Button>
    </div>
  </div>

  <div class="p-3 overflow-x-auto overflow-y-auto max-h-72 min-h-48 text-neutral-300 space-y-1">
    {#if displayedLogs.length === 0}
      <div class="text-neutral-600 italic">No output logs present.</div>
    {:else}
      {#each displayedLogs as log, i (i)}
        <div class="flex items-start space-x-3 leading-relaxed whitespace-pre font-mono">
          <span class="text-neutral-600 select-none text-right w-6 shrink-0">{i + 1}</span>
          <span class="break-all" data-testid="terminal-line">{log}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>
