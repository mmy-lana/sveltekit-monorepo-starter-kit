<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { beforeNavigate } from '$app/navigation';
  import StorageSnapshotPanel from '$lib/components/features/StorageSnapshotPanel.svelte';
  import WorkspaceDetailDrawer from '$lib/components/features/WorkspaceDetailDrawer.svelte';
  import QuickstartGuideModal from '$lib/components/features/QuickstartGuideModal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { flushStorage, installFlushHooks } from '$lib/storage/localStorageManager';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  let isGuideOpen = $state(false);

  // Flush-on-exit: paired with the idempotent `beforeunload` hook in the storage
  // module, so a pending debounced write survives a tab close or route change.
  installFlushHooks();
  beforeNavigate(() => {
    flushStorage();
  });

  interface NavItem {
    href: string;
    label: string;
  }

  const navItems: NavItem[] = [
    { href: '/', label: 'Workspaces' },
    { href: '/graph', label: 'Dependency Graph' },
    { href: '/pipelines', label: 'Pipelines & Logs' }
  ];
</script>

<div class="min-h-screen bg-[var(--color-hud-bg)] text-neutral-100 flex flex-col font-sans overflow-x-hidden">
  <header class="border-b border-neutral-800 bg-[#0d0d11]/80 backdrop-blur-md sticky top-0 z-30 px-4 py-2.5">
    <div class="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-3 min-w-0">
        <a
          href="/"
          class="flex items-center gap-2 font-mono font-bold text-sm tracking-tight text-white hover:text-blue-400 transition-colors"
        >
          <span class="w-3 h-3 rounded-full bg-blue-500 inline-block animate-pulse shrink-0"></span>
          <span class="whitespace-nowrap">MONOREPO://HUD</span>
        </a>
        <span class="text-neutral-700 hidden sm:inline" aria-hidden="true">|</span>
        <span class="text-[11px] font-mono text-neutral-400 hidden sm:inline whitespace-nowrap">
          branch:main
        </span>
        <span class="text-[11px] font-mono text-neutral-500 hidden md:inline whitespace-nowrap">
          node:client
        </span>
      </div>

      <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          onclick={() => (isGuideOpen = true)}
          class="min-h-[44px] px-2.5 text-[11px] font-mono text-neutral-300 hover:text-blue-400"
          ariaLabel="Open the quickstart and architecture guide"
        >
          <span aria-hidden="true">?</span>
          <span class="hidden sm:inline">&nbsp;Guide</span>
        </Button>
        <StorageSnapshotPanel />
      </div>
    </div>
  </header>

  <nav class="border-b border-neutral-800/80 bg-neutral-950 px-4">
    <div class="max-w-7xl mx-auto flex gap-1 scroll-mask-x">
      {#each navItems as item (item.href)}
        <a
          href={item.href}
          aria-current={page.url.pathname === item.href ? 'page' : undefined}
          class="px-4 py-3 min-h-[44px] text-xs font-mono transition-colors border-b-2 flex items-center whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-t {page.url.pathname ===
          item.href
            ? 'border-blue-500 text-blue-400'
            : 'border-transparent text-neutral-400 hover:text-neutral-200'}"
        >
          {item.label}
        </a>
      {/each}
    </div>
  </nav>

  <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 min-w-0">
    {#if children}
      {@render children()}
    {/if}
  </main>

  <WorkspaceDetailDrawer />
  <QuickstartGuideModal isOpen={isGuideOpen} onclose={() => (isGuideOpen = false)} />
</div>
