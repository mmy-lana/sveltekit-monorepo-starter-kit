<script lang="ts">
  interface TabItem {
    id: string;
    label: string;
  }

  interface Props {
    tabs: TabItem[];
    activeTab: string;
    onchange: (id: string) => void;
  }

  let { tabs, activeTab, onchange }: Props = $props();
</script>

<div class="border-b border-neutral-800 flex space-x-1 overflow-x-auto no-scrollbar">
  {#each tabs as tab}
    <button
      type="button"
      onclick={() => onchange(tab.id)}
      class="px-4 py-2.5 min-h-[44px] text-xs font-mono font-medium border-b-2 transition-colors whitespace-nowrap {activeTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'}"
    >
      {tab.label}
    </button>
  {/each}
</div>
