<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import StorageSnapshotPanel from '$lib/components/features/StorageSnapshotPanel.svelte';
  import WorkspaceDetailDrawer from '$lib/components/features/WorkspaceDetailDrawer.svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="min-h-screen bg-[#0a0a0c] text-neutral-100 flex flex-col font-sans">
  <!-- Developer HUD Bar -->
  <header class="border-b border-neutral-800 bg-[#0d0d11]/80 backdrop-blur-md sticky top-0 z-30 px-4 py-2.5">
    <div class="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center space-x-3">
        <a href="/" class="flex items-center space-x-2 font-mono font-bold text-sm tracking-tight text-white hover:text-blue-400 transition-colors">
          <span class="w-3 h-3 rounded-full bg-blue-500 inline-block animate-pulse"></span>
          <span>MONOREPO://HUD</span>
        </a>
        <span class="text-neutral-700 hidden sm:inline">|</span>
        <span class="text-[11px] font-mono text-neutral-400 hidden sm:inline">branch:main</span>
        <span class="text-[11px] font-mono text-neutral-500 hidden md:inline">node:latest</span>
      </div>

      <div class="flex items-center space-x-2">
        <StorageSnapshotPanel />
      </div>
    </div>
  </header>

  <!-- Navigation Bar -->
  <nav class="border-b border-neutral-800/80 bg-neutral-950 px-4">
    <div class="max-w-7xl mx-auto flex space-x-1 overflow-x-auto no-scrollbar">
      <a
        href="/"
        class="px-4 py-3 min-h-[44px] text-xs font-mono transition-colors border-b-2 flex items-center {page.url.pathname === '/' ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'}"
      >
        Workspaces
      </a>
      <a
        href="/graph"
        class="px-4 py-3 min-h-[44px] text-xs font-mono transition-colors border-b-2 flex items-center {page.url.pathname === '/graph' ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'}"
      >
        Dependency Graph
      </a>
      <a
        href="/pipelines"
        class="px-4 py-3 min-h-[44px] text-xs font-mono transition-colors border-b-2 flex items-center {page.url.pathname === '/pipelines' ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'}"
      >
        Pipelines & Logs
      </a>
    </div>
  </nav>

  <!-- Page Main Content -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
    {#if children}
      {@render children()}
    {/if}
  </main>

  <WorkspaceDetailDrawer />
</div>
