<script lang="ts">
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import { buildGraph } from '$lib/utils/dag';
  import Badge from '$lib/components/ui/Badge.svelte';

  interface Point {
    x: number;
    y: number;
  }

  interface GraphLayout {
    coords: Map<string, Point>;
    width: number;
    height: number;
    tiers: number[];
  }

  /** Canonical drawing surface. The viewBox scales this to the element box. */
  const VIEWBOX_WIDTH = 640;
  const VIEWBOX_HEIGHT = 520;
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 3;
  const NODE_RADIUS = 22;
  /** Minimum horizontal breathing room between two nodes on the same tier. */
  const TIER_NODE_SPACING = 130;
  /** Vertical distance between consecutive tiers. */
  const TIER_HEIGHT = 150;
  const SIDE_PAD = 90;
  const TIER_PAD = 70;
  /** Longest label rendered inline before it is elided. */
  const LABEL_MAX_CHARS = 16;

  function truncateLabel(name: string): string {
    const bare = name.replace(/^@[^/]+\//, '');
    return bare.length > LABEL_MAX_CHARS ? `${bare.slice(0, LABEL_MAX_CHARS - 1)}\u2026` : bare;
  }

  let graphData = $derived(buildGraph(monorepoStore.packages));

  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);

  let pinchDistance = $state<number | null>(null);
  let isDragging = $state(false);
  let dragStart = $state<Point>({ x: 0, y: 0 });
  let panOrigin = $state<Point>({ x: 0, y: 0 });
  let activePointerId = $state<number | null>(null);

  function clampZoom(next: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
  }

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    panOrigin = { x: panX, y: panY };
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    panX = panOrigin.x + (e.clientX - dragStart.x);
    panY = panOrigin.y + (e.clientY - dragStart.y);
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function touchDistance(touches: TouchList): number {
    const [a, b] = [touches[0], touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      pinchDistance = touchDistance(e.touches);
      isDragging = false;
      return;
    }
    if (e.touches.length === 1) {
      isDragging = true;
      activePointerId = e.touches[0].identifier;
      dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panOrigin = { x: panX, y: panY };
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (e.touches.length === 2 && pinchDistance !== null) {
      const next = touchDistance(e.touches);
      if (pinchDistance > 0) {
        zoom = clampZoom(zoom * (next / pinchDistance));
      }
      pinchDistance = next;
      return;
    }

    if (e.touches.length === 1 && isDragging) {
      const touch = Array.from(e.touches).find((t) => t.identifier === activePointerId);
      if (!touch) return;
      panX = panOrigin.x + (touch.clientX - dragStart.x);
      panY = panOrigin.y + (touch.clientY - dragStart.y);
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (e.touches.length === 0) {
      isDragging = false;
      pinchDistance = null;
      activePointerId = null;
    }
  }

  function handleZoomBy(delta: number) {
    zoom = clampZoom(zoom + delta);
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
    pinchDistance = null;
    isDragging = false;
  }

  const PAN_STEP = 24;

  /** Keyboard equivalent of drag so panning is not pointer-exclusive. */
  function handleCanvasKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        panX += PAN_STEP;
        return;
      case 'ArrowRight':
        e.preventDefault();
        panX -= PAN_STEP;
        return;
      case 'ArrowUp':
        e.preventDefault();
        panY += PAN_STEP;
        return;
      case 'ArrowDown':
        e.preventDefault();
        panY -= PAN_STEP;
        return;
      case '+':
      case '=':
        e.preventDefault();
        handleZoomBy(0.2);
        return;
      case '-':
      case '_':
        e.preventDefault();
        handleZoomBy(-0.2);
        return;
      case '0':
        e.preventDefault();
        resetView();
        return;
      default:
    }
  }

  function handleNodeKeydown(e: KeyboardEvent, nodeId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      monorepoStore.setActiveWorkspace(nodeId);
    }
  }

  /**
   * Layered topological layout (Sugiyama-style tiers, no crossing heuristics).
   *
   * Nodes are bucketed by topological depth. Depth 0 holds roots (no internal
   * dependencies) and each subsequent tier is one level further downstream, so
   * every dependency edge points strictly downward. Within a tier, nodes are
   * spread with even spacing at `x = (width / (n + 1)) * (i + 1)`, which is
   * guaranteed collision-free for any bucket size because consecutive indices
   * are always separated by `width / (n + 1) > 0`.
   *
   * The earlier ring-based implementation computed a radius of 0 for the root
   * tier and centred every single-node bucket, so unrelated nodes collapsed
   * onto identical coordinates.
   */
  let layout = $derived.by((): GraphLayout => {
    const nodes = graphData.nodes;
    if (nodes.length === 0) {
      return { coords: new Map(), width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT, tiers: [] };
    }

    const tiers = new Map<number, string[]>();
    for (const node of nodes) {
      const bucket = tiers.get(node.depth);
      if (bucket) bucket.push(node.id);
      else tiers.set(node.depth, [node.id]);
    }

    const depths = [...tiers.keys()].sort((a, b) => a - b);
    const widest = Math.max(...depths.map((d) => tiers.get(d)?.length ?? 0));

    // Grow the drawing surface so wide/deep graphs never squeeze nodes together.
    const width = Math.max(VIEWBOX_WIDTH, widest * TIER_NODE_SPACING + SIDE_PAD * 2);
    const height = Math.max(VIEWBOX_HEIGHT, depths.length * TIER_HEIGHT + TIER_PAD * 2);

    const coords = new Map<string, Point>();

    depths.forEach((depth, tierIndex) => {
      const bucket = tiers.get(depth) ?? [];
      const y = TIER_PAD + tierIndex * ((height - TIER_PAD * 2) / Math.max(1, depths.length - 1));

      bucket.forEach((id, index) => {
        coords.set(id, {
          x: (width / (bucket.length + 1)) * (index + 1),
          y
        });
      });
    });

    return { coords, width, height, tiers: depths };
  });

  let nodeCoords = $derived(layout.coords);
</script>

{#if graphData.nodes.length === 0}
  <div
    class="p-12 text-center text-xs text-neutral-500 font-mono bg-neutral-900 border border-neutral-800 rounded-xl"
    data-testid="graph-empty"
  >
    No packages present to render graph topology.
  </div>
{:else}
  <!-- Small viewport fallback (<640px): hierarchical list, no pan/zoom. -->
  <div
    class="block sm:hidden bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3 font-mono text-xs"
    data-testid="graph-tree"
  >
    <div class="text-neutral-400 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-800 pb-2">
      Workspace Hierarchy Tree
    </div>
    {#each [...graphData.nodes].sort((a, b) => a.depth - b.depth) as node (node.id)}
      <div class="p-3 bg-neutral-950 border border-neutral-800 rounded-lg" style="margin-left: {Math.min(node.depth, 4) * 12}px;">
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold text-neutral-200 break-all min-w-0">{node.name}</span>
          <Badge type={node.type} />
        </div>
        <div class="mt-2 text-[11px] text-neutral-500">
          Depth {node.depth} · Dependencies: {node.dependenciesCount} · Dependents: {node.dependentsCount}
        </div>
      </div>
    {/each}
  </div>

  <!-- Interactive SVG canvas (>=640px) -->
  <div
    class="hidden sm:block relative w-full h-[520px] bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden select-none"
    data-testid="graph-canvas"
  >
    <!--
      The wrapper is the pointer/touch surface; the SVG below is purely a
      rendering layer, so handlers stay off the <svg> itself.

      Panning is a direct-manipulation gesture and is intentionally pointer/
      touch-only. Every other function on this canvas (zoom in, zoom out, reset,
      and opening a workspace node) is reachable from the keyboard via the
      real <button> controls and the focusable SVG nodes, so no capability is
      keyboard-inaccessible. WAI-ARIA defines no interactive role for a
      pannable canvas surface, hence the suppression.
    -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="absolute inset-0 cursor-grab active:cursor-grabbing"
      style="touch-action: none;"
      role="application"
      tabindex="0"
      aria-label="Workspace dependency graph canvas. Drag or use the arrow keys to pan, pinch or press plus and minus to zoom, zero to reset."
      onkeydown={handleCanvasKeydown}
      onmousedown={handleMouseDown}
      onmousemove={handleMouseMove}
      onmouseup={handleMouseUp}
      onmouseleave={handleMouseUp}
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
      ontouchcancel={handleTouchEnd}
    ></div>
    <div class="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
      <button
        type="button"
        disabled={zoom >= MAX_ZOOM}
        onclick={() => handleZoomBy(0.2)}
        class="w-11 h-11 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-300"
        aria-label="Zoom in"
        title="Zoom In"
      >
        +
      </button>
      <button
        type="button"
        disabled={zoom <= MIN_ZOOM}
        onclick={() => handleZoomBy(-0.2)}
        class="w-11 h-11 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-300"
        aria-label="Zoom out"
        title="Zoom Out"
      >
        &minus;
      </button>
      <button
        type="button"
        onclick={resetView}
        class="px-3 h-11 text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-neutral-800 rounded"
        aria-label="Reset graph view"
      >
        Reset
      </button>
    </div>

    <svg
      class="w-full h-full relative"
      viewBox="0 0 {layout.width} {layout.height}"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Dependency edges between workspace packages"
    >
      <g transform="translate({panX}, {panY}) scale({zoom})">
        {#each graphData.links as link (link.source + '->' + link.target + link.kind)}
          {@const sourcePos = nodeCoords.get(link.source)}
          {@const targetPos = nodeCoords.get(link.target)}
          {#if sourcePos && targetPos}
            <line
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              stroke="#3b82f6"
              stroke-opacity="0.45"
              stroke-width="2"
              stroke-dasharray="4"
            />
          {/if}
        {/each}

        {#each graphData.nodes as node (node.id)}
          {@const pos = nodeCoords.get(node.id)}
          {#if pos}
            <!-- 44x44 minimum hit target: transparent padding behind the glyph. -->
            <g
              transform="translate({pos.x}, {pos.y})"
              data-testid="graph-node"
              role="button"
              tabindex="0"
              aria-label="Open {node.name} workspace details"
              aria-pressed={monorepoStore.activeWorkspaceId === node.id}
              class="cursor-pointer focus:outline-none"
              onclick={() => monorepoStore.setActiveWorkspace(node.id)}
              onkeydown={(e) => handleNodeKeydown(e, node.id)}
            >
              <circle cx="0" cy="0" r="28" fill="transparent" />
              <circle
                r={NODE_RADIUS}
                class="stroke-2 {monorepoStore.activeWorkspaceId === node.id
                  ? 'stroke-blue-500 fill-blue-950/60'
                  : 'stroke-neutral-700 fill-neutral-900 hover:stroke-neutral-500'}"
              />
              <text
                dy={NODE_RADIUS + 16}
                text-anchor="middle"
                class="fill-neutral-300 font-mono text-[11px] pointer-events-none select-none"
              >
                <title>{node.name}</title>
                {truncateLabel(node.name)}
              </text>
            </g>
          {/if}
        {/each}
      </g>
    </svg>
  </div>
{/if}
