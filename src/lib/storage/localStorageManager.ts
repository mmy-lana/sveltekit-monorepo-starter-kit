import type {
  DependencyKind,
  MonorepoStorageState,
  PackageType,
  PipelineRun,
  ScaffoldBlueprint,
  TaskStatus,
  WorkspaceDependency,
  WorkspaceFilterState,
  WorkspacePackage,
  WorkspaceScript
} from '$lib/types';
import { validatePackageName } from '$lib/utils/scaffold';

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

/** Keys that can be used to poison an object's prototype chain. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively removes prototype-pollution vectors from an arbitrary parsed JSON
 * value. `JSON.parse` itself does not mutate the prototype chain, but it does
 * produce *own* properties named `__proto__`, which become live pollution
 * vectors the moment the object is spread, merged or re-serialised downstream.
 */
function stripPollution(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripPollution(entry));
  }
  if (isRecord(value)) {
    const clean: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      clean[key] = stripPollution(entry);
    }
    return clean;
  }
  return value;
}

const PACKAGE_TYPES: readonly PackageType[] = ['app', 'lib', 'tool', 'config'];
const DEPENDENCY_KINDS: readonly DependencyKind[] = [
  'dependencies',
  'devDependencies',
  'peerDependencies'
];
const TASK_STATUSES: readonly TaskStatus[] = [
  'idle',
  'queued',
  'running',
  'success',
  'failure',
  'cached'
];

function isPackageType(value: unknown): value is PackageType {
  return typeof value === 'string' && (PACKAGE_TYPES as readonly string[]).includes(value);
}

function isDependencyKind(value: unknown): value is DependencyKind {
  return typeof value === 'string' && (DEPENDENCY_KINDS as readonly string[]).includes(value);
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isWorkspaceDependency(value: unknown): value is WorkspaceDependency {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    typeof value.version === 'string' &&
    isDependencyKind(value.kind) &&
    typeof value.isInternal === 'boolean' &&
    (value.resolvedPath === undefined || typeof value.resolvedPath === 'string') &&
    (value.env === undefined || isStringRecord(value.env))
  );
}

function isWorkspaceScript(value: unknown): value is WorkspaceScript {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    typeof value.command === 'string' &&
    (value.env === undefined || isStringRecord(value.env))
  );
}

function isWorkspacePackage(value: unknown): value is WorkspacePackage {
  if (!isRecord(value)) return false;
  if (
    !(
      isNonEmptyString(value.id) &&
      isNonEmptyString(value.name) &&
      isNonEmptyString(value.slug) &&
      typeof value.version === 'string' &&
      isPackageType(value.type) &&
      typeof value.path === 'string' &&
      typeof value.description === 'string' &&
      Array.isArray(value.dependencies) &&
      value.dependencies.every(isWorkspaceDependency) &&
      Array.isArray(value.scripts) &&
      value.scripts.every(isWorkspaceScript) &&
      Array.isArray(value.tags) &&
      value.tags.every((tag): tag is string => typeof tag === 'string') &&
      typeof value.createdAt === 'string' &&
      typeof value.updatedAt === 'string'
    )
  ) {
    return false;
  }

  // Shape validation alone would happily accept a well-formed package whose
  // name or path is a traversal sequence. Imported snapshots bypass the
  // scaffolder's own sanitising, so it is re-checked here.
  if (!validatePackageName(value.name).valid) return false;
  if (!isSafePathSegment(value.slug)) return false;
  if (!isSafePath(value.path)) return false;

  return true;
}

/** A single path segment: no separators and no relative markers. */
function isSafePathSegment(segment: string): boolean {
  if (!segment || segment.length === 0) return false;
  if (segment === '.' || segment === '..' || segment === '~') return false;
  if (segment.includes('/') || segment.includes('\\')) return false;
  if (segment.toLowerCase().includes('%2e')) return false;
  return true;
}

/** A relative POSIX path made only of safe segments. */
function isSafePath(path: string): boolean {
  if (!path) return false;
  if (path.startsWith('/') || path.startsWith('\\')) return false;
  if (path.includes('\\')) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  return path.split('/').every((segment) => isSafePathSegment(segment));
}

function isPipelineStep(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.workspaceId) &&
    typeof value.scriptName === 'string' &&
    isTaskStatus(value.status) &&
    (value.exitCode === null || typeof value.exitCode === 'number') &&
    typeof value.durationMs === 'number' &&
    Array.isArray(value.stdout) &&
    value.stdout.every((line): line is string => typeof line === 'string') &&
    Array.isArray(value.stderr) &&
    value.stderr.every((line): line is string => typeof line === 'string') &&
    typeof value.cached === 'boolean' &&
    (value.startedAt === null || typeof value.startedAt === 'string') &&
    (value.completedAt === null || typeof value.completedAt === 'string')
  );
}

function isPipelineRun(value: unknown): value is PipelineRun {
  if (!isRecord(value)) return false;
  const triggers = ['manual', 'watch', 'ci'];
  return (
    isNonEmptyString(value.id) &&
    typeof value.trigger === 'string' &&
    (triggers as readonly string[]).includes(value.trigger) &&
    typeof value.command === 'string' &&
    Array.isArray(value.scope) &&
    value.scope.every((entry): entry is string => typeof entry === 'string') &&
    isTaskStatus(value.status) &&
    typeof value.totalDurationMs === 'number' &&
    Array.isArray(value.steps) &&
    value.steps.every(isPipelineStep) &&
    typeof value.createdAt === 'string' &&
    (value.completedAt === null || typeof value.completedAt === 'string')
  );
}

function isScaffoldBlueprintFile(value: unknown): boolean {
  return isRecord(value) && typeof value.path === 'string' && typeof value.content === 'string';
}

function isScaffoldBlueprint(value: unknown): value is ScaffoldBlueprint {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isPackageType(value.type) &&
    isStringRecord(value.defaultDependencies) &&
    isStringRecord(value.defaultDevDependencies) &&
    Array.isArray(value.files) &&
    value.files.every(isScaffoldBlueprintFile) &&
    isStringRecord(value.scripts)
  );
}

function isWorkspaceFilterState(value: unknown): value is WorkspaceFilterState {
  if (!isRecord(value)) return false;
  return (
    typeof value.searchQuery === 'string' &&
    Array.isArray(value.types) &&
    value.types.every(isPackageType) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag): tag is string => typeof tag === 'string') &&
    (value.statusFilter === 'all' || isTaskStatus(value.statusFilter))
  );
}

/**
 * Validates an untrusted payload (typically from `localStorage` or a user
 * supplied snapshot file) and returns a fully typed, prototype-clean state, or
 * `null` when the payload is malformed or built against an incompatible schema
 * version. Callers treat `null` as "fall back to seed data".
 */
export function validateStorageSnapshot(data: unknown): MonorepoStorageState | null {
  const clean = stripPollution(data);
  if (!isRecord(clean)) return null;

  if (clean.version !== STORAGE_VERSION) return null;
  if (!Array.isArray(clean.packages) || !clean.packages.every(isWorkspacePackage)) return null;
  if (!Array.isArray(clean.pipelineRuns) || !clean.pipelineRuns.every(isPipelineRun)) return null;
  if (!Array.isArray(clean.scaffoldBlueprints) || !clean.scaffoldBlueprints.every(isScaffoldBlueprint)) {
    return null;
  }
  if (!isWorkspaceFilterState(clean.persistedFilters)) return null;
  if (typeof clean.updatedAt !== 'string') return null;
  if (clean.activeWorkspaceId !== null && typeof clean.activeWorkspaceId !== 'string') return null;

  // Package ids must be unique, otherwise the DAG and graph builders key on
  // colliding map entries and silently drop edges.
  const ids = new Set<string>();
  for (const pkg of clean.packages) {
    if (ids.has(pkg.id)) return null;
    ids.add(pkg.id);
  }

  return clean as unknown as MonorepoStorageState;
}

export function loadState(): MonorepoStorageState {
  if (typeof window === 'undefined') {
    return getInitialSeedData();
  }

  const seed = (): MonorepoStorageState => {
    const initial = getInitialSeedData();
    saveStateImmediate(initial);
    return initial;
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();

    const validated = validateStorageSnapshot(JSON.parse(raw));
    if (!validated) return seed();

    saveStateImmediate(validated);
    return validated;
  } catch {
    return seed();
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

/** Guards against duplicate listener attachment across module re-evaluation. */
let unloadListenerAttached = false;

/**
 * Attaches the tab-close flush hook exactly once. Idempotent so that repeated
 * module evaluation (HMR, route re-entry) cannot stack duplicate `beforeunload`
 * handlers on the window.
 */
export function installFlushHooks(): void {
  if (typeof window === 'undefined' || unloadListenerAttached) return;
  unloadListenerAttached = true;
  window.addEventListener('beforeunload', () => {
    flushStorage();
  });
}

installFlushHooks();
