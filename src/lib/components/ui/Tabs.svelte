<script lang="ts">
  interface TabItem {
    id: string;
    label: string;
  }

  interface Props {
    id?: string;
    tabs: TabItem[];
    activeTab: string;
    /** Id of the panel associated with each tab id, for aria-controls. */
    panelIdPrefix?: string;
    onchange: (id: string) => void;
  }

  let { id, tabs, activeTab, panelIdPrefix, onchange }: Props = $props();

  /**
   * Roving tabindex: the active tab is the only one in the tab sequence, which
   * matches the WAI-ARIA tabs pattern. Arrow keys move between tabs and wrap.
   */
  function handleKeydown(e: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    let nextIndex: number | null = null;

    if (e.key === 'ArrowRight') nextIndex = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft') nextIndex = index === 0 ? last : index - 1;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = last;
    else return;

    e.preventDefault();
    const next = tabs[nextIndex];
    if (!next) return;
    onchange(next.id);
    document.getElementById(`${id ?? 'tab'}-${next.id}`)?.focus();
  }
</script>

<div
  {id}
  role="tablist"
  aria-label="Workspace sections"
  class="border-b border-neutral-800 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
>
  {#each tabs as tab, index (tab.id)}
    <button
      type="button"
      id="{id ?? 'tab'}-{tab.id}"
      role="tab"
      aria-selected={activeTab === tab.id}
      aria-controls={panelIdPrefix ? `${panelIdPrefix}-${tab.id}` : undefined}
      tabindex={activeTab === tab.id ? 0 : -1}
      onclick={() => onchange(tab.id)}
      onkeydown={(e) => handleKeydown(e, index)}
      class="px-4 py-2.5 min-h-[44px] text-xs font-mono font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-t {activeTab === tab.id
        ? 'border-blue-500 text-blue-400'
        : 'border-transparent text-neutral-400 hover:text-neutral-200'}"
    >
      {tab.label}
    </button>
  {/each}
</div>
