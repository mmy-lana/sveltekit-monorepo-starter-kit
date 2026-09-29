<script lang="ts">
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import { buildGraph } from '$lib/utils/dag';
  import Badge from '$lib/components/ui/Badge.svelte';

  let graphData = $derived(buildGraph(monorepoStore.packages));

  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isDragging = $state(false);
  let dragStartX = $state(0);
  let dragStartY = $state(0);

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    dragStartX = e.clientX - panX;
    dragStartY = e.clientY - panY;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    panX = e.clientX - dragStartX;
    panY = e.clientY - dragStartY;
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function handleZoom(delta: number) {
    zoom = Math.min(2.5, Math.max(0.4, zoom + delta));
  }

  function getNodeCoordinates(index: number, total: number) {
    const centerX = 320;
    const centerY = 220;
    const radius = Math.min(centerX, centerY) - 70;
    const angle = (index / Math.max(1, total)) * 2 * Math.PI - Math.PI / 2;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  }

  let nodeCoords = $derived.by(() => {
    const map = new Map<string, { x: number; y: number }>();
    graphData.nodes.forEach((node, i) => {
      map.set(node.id, getNodeCoordinates(i, graphData.nodes.length));
    });
    return map;
  });
</script>

{#if graphData.nodes.length === 0}
  <div class="p-12 text-center text-xs text-neutral-500 font-mono bg-neutral-900 border border-neutral-800 rounded-xl">
    No packages present to render graph topology.
  </div>
{:else}
  <!-- Small viewport fallback (<640px) -->
  <div class="block sm:hidden bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3 font-mono text-xs">
    <div class="text-neutral-400 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-800 pb-2">
      Workspace Hierarchy Tree
    </div>
    {#each graphData.nodes as node}
      <div class="p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-neutral-200">{node.name}</span>
          <Badge type={node.type} />
        </div>
        <div class="mt-2 text-[11px] text-neutral-500">
          Internal Dependencies: {node.dependenciesCount} | Dependents: {node.dependentsCount}
        </div>
      </div>
    {/each}
  </div>

  <!-- Interactive SVG Canvas (>=640px) -->
  <div class="hidden sm:block relative w-full h-[520px] bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden select-none">
    <div class="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
      <button
        type="button"
        onclick={() => handleZoom(0.15)}
        class="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 rounded"
        title="Zoom In"
      >
        +
      </button>
      <button
        type="button"
        onclick={() => handleZoom(-0.15)}
        class="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 rounded"
        title="Zoom Out"
      >
        −
      </button>
      <button
        type="button"
        onclick={() => { zoom = 1; panX = 0; panY = 0; }}
        class="px-2 h-8 text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-neutral-800 rounded"
      >
        Reset
      </button>
    </div>

    <svg
      class="w-full h-full cursor-grab active:cursor-grabbing"
      style="touch-action: none;"
      onmousedown={handleMouseDown}
      onmousemove={handleMouseMove}
      onmouseup={handleMouseUp}
      onmouseleave={handleMouseUp}
    >
      <g transform="translate({panX}, {panY}) scale({zoom})">
        <!-- Render Edge Links -->
        {#each graphData.links as link}
          {@const sourcePos = nodeCoords.get(link.source)}
          {@const targetPos = nodeCoords.get(link.target)}
          {#if sourcePos && targetPos}
            <line
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              stroke="#3b82f6"
              stroke-opacity="0.4"
              stroke-width="2"
              stroke-dasharray="4"
            />
          {/if}
        {/each}

        <!-- Render Nodes -->
        {#each graphData.nodes as node}
          {@const pos = nodeCoords.get(node.id)}
          {#if pos}
            <g
              transform="translate({pos.x}, {pos.y})"
              class="cursor-pointer"
              onclick={() => monorepoStore.setActiveWorkspace(node.id)}
            >
              <circle
                r="24"
                class="fill-neutral-900 stroke-2 {monorepoStore.activeWorkspaceId === node.id ? 'stroke-blue-500 fill-blue-950/40' : 'stroke-neutral-700 hover:stroke-neutral-500'}"
              />
              <text
                dy="36"
                text-anchor="middle"
                class="fill-neutral-300 font-mono text-[11px] pointer-events-none select-none"
              >
                {node.name.replace(/^@[^/]+\//, '')}
              </text>
            </g>
          {/if}
        {/each}
      </g>
    </svg>
  </div>
{/if}
