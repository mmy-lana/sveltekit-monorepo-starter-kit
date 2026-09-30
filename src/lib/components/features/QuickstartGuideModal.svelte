<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Tabs from '$lib/components/ui/Tabs.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  interface Props {
    isOpen: boolean;
    onclose: () => void;
  }

  let { isOpen, onclose }: Props = $props();

  type SectionId = 'overview' | 'usage' | 'faq';

  let activeSection = $state<SectionId>('overview');

  const tabs = [
    { id: 'overview', label: 'What is this?' },
    { id: 'usage', label: 'How to use it' },
    { id: 'faq', label: 'FAQ' }
  ] satisfies { id: SectionId; label: string }[];

  const STORAGE_HINT = 'sveltekit_monorepo_platform_v1';

  interface FaqEntry {
    question: string;
    answer: string;
  }

  const faqs: FaqEntry[] = [
    {
      question: 'Does this create real files on my disk?',
      answer:
        'No. Nothing is written to your filesystem. Scaffolding, builds and tests are all simulated in the browser. The whole platform is a visual model of how a monorepo behaves, so you can explore the mechanics safely.'
    },
    {
      question: 'Why is the build output simulated?',
      answer:
        'This is a client-only SvelteKit app with no backend, so there is no process to spawn. The pipeline engine reproduces the real mechanics that matter: topological ordering, parallel execution batches, cache hits, failures and exit codes.'
    },
    {
      question: 'How is the cache decided?',
      answer:
        'Each workspace gets a fingerprint built from its own updatedAt plus the updatedAt of every transitive internal dependency. A step only reports "cached" when that fingerprint is byte-identical to the last successful run and nothing in the subtree changed.'
    },
    {
      question: 'What happens if I create a dependency cycle?',
      answer:
        'The link is rejected before it is written, so the graph stays acyclic through normal use. If a cycle is ever present, the pipeline refuses to dispatch and records a failed run naming the exact cycle path instead of silently producing empty batches.'
    },
    {
      question: 'Can I link a package to itself or in a loop?',
      answer:
        'No. Self-links are rejected immediately, and any edge that would close a cycle is validated against the hypothetical post-link graph before it is committed.'
    },
    {
      question: 'Where is my data stored?',
      answer:
        `In your browser localStorage under the key "${STORAGE_HINT}". Nothing leaves your machine. Writes are debounced by 200ms and force-flushed when the tab closes or you navigate away.`
    },
    {
      question: 'How do I get back to a clean state?',
      answer:
        'Use Reset in the top bar to restore the seeded demo workspaces. Export first if you want to keep what you built; Import accepts any snapshot JSON produced by Export.'
    },
    {
      question: 'Why does the graph switch to a list on small screens?',
      answer:
        'Below 640px a pannable canvas fights with document scrolling. The tree view shows the same data, ordered by dependency depth, with no gesture conflicts. Pinch-zoom and pan unlock from 640px up.'
    }
  ];
</script>

<Modal id="quickstart-guide" title="Quickstart & Architecture Guide" {isOpen} {onclose}>
  <div class="space-y-5">
    <p class="text-xs text-neutral-400 leading-relaxed">
      A two-minute orientation to the platform, what it models, and how to drive it.
    </p>

    <Tabs
      id="guide-tab"
      {tabs}
      activeTab={activeSection}
      panelIdPrefix="guide-panel"
      onchange={(id) => (activeSection = id as SectionId)}
    />

    {#if activeSection === 'overview'}
      <div id="guide-panel-overview" role="tabpanel" aria-labelledby="guide-tab-overview" class="space-y-4">
        <section class="space-y-2">
          <h3 class="text-xs font-mono uppercase tracking-wider text-blue-400">What this project is</h3>
          <p class="text-xs text-neutral-300 leading-relaxed">
            This is a <strong class="text-neutral-100">client-side visual simulation and management
            dashboard</strong> for Vite/SvelteKit monorepos. It models the four things that make a
            monorepo hard to reason about:
          </p>
          <ul class="space-y-2 text-xs text-neutral-400">
            <li class="flex gap-2">
              <span class="text-blue-500 shrink-0">01</span>
              <span><strong class="text-neutral-200">Workspace packages</strong> &mdash; typed units
                (app, lib, tool, config) with their own scripts and dependency edges.</span>
            </li>
            <li class="flex gap-2">
              <span class="text-blue-500 shrink-0">02</span>
              <span><strong class="text-neutral-200">Dependency DAGs</strong> &mdash; a directed
                acyclic graph rendered as a topological layout, with cycle detection.</span>
            </li>
            <li class="flex gap-2">
              <span class="text-blue-500 shrink-0">03</span>
              <span><strong class="text-neutral-200">Pipeline tasks</strong> &mdash; builds dispatched
                in dependency-ordered batches, with real cache-hit semantics and exit codes.</span>
            </li>
            <li class="flex gap-2">
              <span class="text-blue-500 shrink-0">04</span>
              <span><strong class="text-neutral-200">Code scaffolding</strong> &mdash; a generator that
                creates a new package and auto-wires it into the graph.</span>
            </li>
          </ul>
        </section>

        <section class="space-y-2 p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
          <h3 class="text-xs font-mono uppercase tracking-wider text-neutral-400">Architecture at a glance</h3>
          <dl class="space-y-2 text-[11px]">
            <div class="flex gap-2">
              <dt class="font-mono text-neutral-500 shrink-0 w-32">lib/types</dt>
              <dd class="text-neutral-400">Single source of truth for every domain type.</dd>
            </div>
            <div class="flex gap-2">
              <dt class="font-mono text-neutral-500 shrink-0 w-32">lib/utils/dag</dt>
              <dd class="text-neutral-400">Pure graph functions: build, sort, detect cycles.</dd>
            </div>
            <div class="flex gap-2">
              <dt class="font-mono text-neutral-500 shrink-0 w-32">lib/storage</dt>
              <dd class="text-neutral-400">Debounced write funnel plus runtime schema validation.</dd>
            </div>
            <div class="flex gap-2">
              <dt class="font-mono text-neutral-500 shrink-0 w-32">lib/stores</dt>
              <dd class="text-neutral-400">Runes state: monorepo registry and pipeline engine.</dd>
            </div>
            <div class="flex gap-2">
              <dt class="font-mono text-neutral-500 shrink-0 w-32">lib/components</dt>
              <dd class="text-neutral-400">ui primitives, molecules, and domain features.</dd>
            </div>
          </dl>
          <p class="text-[11px] text-neutral-500 leading-relaxed pt-1">
            State flows one way: the pipeline store may read the monorepo store, never the reverse.
            That keeps the dependency graph acyclic at the module level too.
          </p>
        </section>
      </div>
    {:else if activeSection === 'usage'}
      <div id="guide-panel-usage" role="tabpanel" aria-labelledby="guide-tab-usage" class="space-y-3">
        {#each [
          {
            title: 'Workspaces view',
            body: 'Click any package card to open the detail drawer. From there you can inspect the script manifest, run a script, link an internal package as a new dependency, or delete the workspace. Deleting a package that others depend on is blocked unless you confirm, and confirmed deletions strip the stale edge from every dependent.'
          },
          {
            title: 'Dependency Graph view',
            body: 'A topological layout of upstream and downstream dependencies. Drag to pan, pinch or use the zoom controls to scale, and click a node to open that workspace. Cycles are impossible through normal use, and any cycle is surfaced explicitly rather than drawn.'
          },
          {
            title: 'Pipelines view',
            body: 'Run a simulated build or test cycle. Steps dispatch in dependency order, run in parallel within a batch, and stream live output into the terminal panel. A step reports "cached" when nothing in its dependency subtree changed since the last successful run.'
          },
          {
            title: 'Scaffold generator',
            body: 'Use "+ New Package" to create a simulated app, library, utility or config workspace. Names are validated as lowercase kebab-case or @scope/name, and are rejected if they contain path traversal segments.'
          },
          {
            title: 'Export / Import / Reset',
            body: 'The controls in the top bar snapshot the entire registry to a JSON file, restore one from disk, or reset to the seeded demo workspaces. Handy for sharing a scenario or reproducing a bug.'
          }
        ] as item, index (item.title)}
          <section class="flex gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
            <span class="font-mono text-[11px] text-blue-500 shrink-0 pt-0.5">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div class="min-w-0 space-y-1">
              <h4 class="text-xs font-semibold text-neutral-200">{item.title}</h4>
              <p class="text-[11px] text-neutral-400 leading-relaxed">{item.body}</p>
            </div>
          </section>
        {/each}
      </div>
    {:else}
      <div id="guide-panel-faq" role="tabpanel" aria-labelledby="guide-tab-faq" class="space-y-2">
        {#each faqs as faq (faq.question)}
          <details class="group p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
            <summary
              class="flex items-center justify-between gap-3 cursor-pointer text-xs font-medium text-neutral-200 hover:text-white list-none min-h-[24px]"
            >
              <span>{faq.question}</span>
              <span
                class="text-neutral-500 text-lg leading-none transition-transform group-open:rotate-45 shrink-0"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p class="text-[11px] text-neutral-400 leading-relaxed mt-2">{faq.answer}</p>
          </details>
        {/each}
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <div class="flex items-center justify-between gap-3">
      <p class="text-[10px] font-mono text-neutral-600 hidden sm:block">
        localStorage: {STORAGE_HINT}
      </p>
      <Button variant="primary" size="md" onclick={onclose}>Got it</Button>
    </div>
  {/snippet}
</Modal>
