import type { MonorepoStorageState, WorkspacePackage } from '$lib/types';

export const STORAGE_KEY = 'sveltekit_monorepo_platform_v1';
export const STORAGE_VERSION = 1;

export function getInitialSeedData(): MonorepoStorageState {
  const now = new Date().toISOString();

  const packages: WorkspacePackage[] = [
    {
      id: 'pkg-config-tailwind',
      name: '@workspace/config-tailwind',
      slug: 'config-tailwind',
      version: '0.0.1',
      type: 'config',
      path: 'packages/config-tailwind',
      description: 'Shared Tailwind CSS v4 design tokens and base utilities',
      dependencies: [],
      scripts: [
        { id: 's-build-cfg', name: 'build', command: 'echo "Tailwind theme compiled"' }
      ],
      tags: ['config', 'css', 'tailwind'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'pkg-utils',
      name: '@workspace/utils',
      slug: 'utils',
      version: '0.1.0',
      type: 'tool',
      path: 'packages/utils',
      description: 'Pure TypeScript computational helpers, formatting and DAG utilities',
      dependencies: [],
      scripts: [
        { id: 's-build-utils', name: 'build', command: 'tsc --build' },
        { id: 's-test-utils', name: 'test', command: 'vitest run' }
      ],
      tags: ['typescript', 'utilities'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'pkg-ui',
      name: '@workspace/ui',
      slug: 'ui',
      version: '0.1.0',
      type: 'lib',
      path: 'packages/ui',
      description: 'Shared Svelte UI primitives and design components',
      dependencies: [
        {
          id: 'pkg-config-tailwind',
          name: '@workspace/config-tailwind',
          version: '0.0.1',
          kind: 'devDependencies',
          isInternal: true
        }
      ],
      scripts: [
        { id: 's-build-ui', name: 'build', command: 'svelte-package' },
        { id: 's-check-ui', name: 'check', command: 'svelte-check' }
      ],
      tags: ['svelte', 'ui', 'components'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'pkg-docs',
      name: '@workspace/docs',
      slug: 'docs',
      version: '0.1.0',
      type: 'app',
      path: 'apps/docs',
      description: 'Technical documentation site and interactive component showcase',
      dependencies: [
        {
          id: 'pkg-ui',
          name: '@workspace/ui',
          version: '0.1.0',
          kind: 'dependencies',
          isInternal: true
        }
      ],
      scripts: [
        { id: 's-build-docs', name: 'build', command: 'vite build' },
        { id: 's-dev-docs', name: 'dev', command: 'vite dev' }
      ],
      tags: ['app', 'docs', 'sveltekit'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'pkg-web',
      name: '@workspace/web',
      slug: 'web',
      version: '1.0.0',
      type: 'app',
      path: 'apps/web',
      description: 'Production frontend application dashboard powered by SvelteKit',
      dependencies: [
        {
          id: 'pkg-ui',
          name: '@workspace/ui',
          version: '0.1.0',
          kind: 'dependencies',
          isInternal: true
        },
        {
          id: 'pkg-utils',
          name: '@workspace/utils',
          version: '0.1.0',
          kind: 'dependencies',
          isInternal: true
        }
      ],
      scripts: [
        { id: 's-build-web', name: 'build', command: 'vite build' },
        { id: 's-dev-web', name: 'dev', command: 'vite dev' },
        { id: 's-preview-web', name: 'preview', command: 'vite preview' }
      ],
      tags: ['app', 'sveltekit', 'production'],
      createdAt: now,
      updatedAt: now
    }
  ];

  return {
    version: STORAGE_VERSION,
    activeWorkspaceId: 'pkg-web',
    packages,
    pipelineRuns: [],
    scaffoldBlueprints: [
      {
        id: 'bp-app',
        name: 'SvelteKit Application',
        type: 'app',
        defaultDependencies: { '@workspace/ui': 'workspace:*' },
        defaultDevDependencies: { vite: 'latest' },
        files: [{ path: 'src/routes/+page.svelte', content: '<h1>App Ready</h1>' }],
        scripts: { build: 'vite build', dev: 'vite dev' }
      },
      {
        id: 'bp-lib',
        name: 'Shared Component Library',
        type: 'lib',
        defaultDependencies: {},
        defaultDevDependencies: { svelte: 'latest' },
        files: [{ path: 'src/index.ts', content: 'export * from "./Button.svelte";' }],
        scripts: { build: 'svelte-package' }
      }
    ],
    persistedFilters: {
      searchQuery: '',
      types: [],
      tags: [],
      statusFilter: 'all'
    },
    updatedAt: now
  };
}

let pendingState: MonorepoStorageState | null = null;
let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

export function loadState(): MonorepoStorageState {
  if (typeof window === 'undefined') {
    return getInitialSeedData();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialSeedData();
      saveStateImmediate(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as MonorepoStorageState;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.packages)) {
      const initial = getInitialSeedData();
      saveStateImmediate(initial);
      return initial;
    }
    return parsed;
  } catch {
    const initial = getInitialSeedData();
    saveStateImmediate(initial);
    return initial;
  }
}

export function saveStateImmediate(state: MonorepoStorageState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    pendingState = null;
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
  } catch (err) {
    console.error('Failed to immediately persist monorepo state', err);
  }
}

export function persist(state: MonorepoStorageState): void {
  pendingState = state;
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  debounceTimeout = setTimeout(() => {
    if (pendingState) {
      saveStateImmediate(pendingState);
    }
  }, 200);
}

export function flushStorage(): void {
  if (pendingState) {
    saveStateImmediate(pendingState);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushStorage();
  });
}
