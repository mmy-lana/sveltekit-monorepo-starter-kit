import type { DependencyKind, MonorepoStorageState, PackageType, PipelineRun, TaskStatus, WorkspacePackage } from '$lib/types';
import {
  flushStorage,
  getInitialSeedData,
  loadState,
  persist,
  saveStateImmediate,
  validateStorageSnapshot
} from '$lib/storage/localStorageManager';
import { wouldCreateCycle } from '$lib/utils/dag';
import { slugify, validatePackageName, validateSemVer } from '$lib/utils/scaffold';

/**
 * Returns `activeWorkspaceId` only when it still resolves against `registry`.
 * Any dangling or missing reference collapses to `null` so downstream readers
 * (`activePackage`, the detail drawer) never dereference a stale id.
 */
function resolveActiveWorkspace(
  activeWorkspaceId: string | null,
  registry: WorkspacePackage[]
): string | null {
  if (!activeWorkspaceId) return null;
  return registry.some((pkg) => pkg.id === activeWorkspaceId) ? activeWorkspaceId : null;
}

/**
 * Status of the most recent pipeline run that included `workspaceId`, or `null`
 * if the workspace has never been part of a run.
 *
 * `pipelineRuns` is ordered newest-first, so the first run containing the
 * workspace is authoritative. This deliberately ignores historical runs: a
 * workspace that failed once and succeeded later reports the success.
 */
export function getLatestRunStatus(workspaceId: string): TaskStatus | null {
  for (const run of pipelineRuns) {
    const step = run.steps.find((s) => s.workspaceId === workspaceId);
    if (step) return step.status;
  }
  return null;
}

const initial = loadState();

let packages = $state<WorkspacePackage[]>(initial.packages);
let activeWorkspaceId = $state<string | null>(initial.activeWorkspaceId);
let searchQuery = $state<string>(initial.persistedFilters.searchQuery || '');
let selectedTypes = $state<PackageType[]>(initial.persistedFilters.types || []);
let selectedStatus = $state<TaskStatus | 'all'>(initial.persistedFilters.statusFilter || 'all');
let openModalId = $state<string | null>(null);
/**
 * Tracked separately from `activeWorkspaceId`: a restored snapshot may name an
 * active workspace, but the inspector drawer must still start closed so a page
 * load never greets the user with a panel covering the dashboard.
 */
let drawerOpen = $state(false);
/**
 * Owned here rather than in `pipeline.svelte.ts` so the snapshot stays in one
 * place. The pipeline store pushes its runs in via `syncPipelineRuns`, which
 * keeps the import direction one-way (pipeline -> monorepo).
 */
let pipelineRuns = $state<PipelineRun[]>(initial.pipelineRuns ?? []);

function getSnapshot(): MonorepoStorageState {
  return {
    version: initial.version,
    activeWorkspaceId,
    packages,
    pipelineRuns: $state.snapshot(pipelineRuns),
    scaffoldBlueprints: initial.scaffoldBlueprints,
    persistedFilters: {
      searchQuery,
      types: $state.snapshot(selectedTypes),
      tags: [],
      statusFilter: selectedStatus
    },
    updatedAt: new Date().toISOString()
  };
}

function sync(immediate = false) {
  const current = getSnapshot();
  if (immediate) {
    saveStateImmediate(current);
  } else {
    persist(current);
  }
}

export const monorepoStore = {
  get packages() {
    return packages;
  },
  get activeWorkspaceId() {
    return activeWorkspaceId;
  },
  get activePackage(): WorkspacePackage | undefined {
    return packages.find((p) => p.id === activeWorkspaceId);
  },
  get searchQuery() {
    return searchQuery;
  },
  set searchQuery(val: string) {
    searchQuery = val;
    sync();
  },
  get selectedTypes() {
    return selectedTypes;
  },
  get selectedStatus() {
    return selectedStatus;
  },
  set selectedStatus(val: TaskStatus | 'all') {
    selectedStatus = val;
    sync();
  },
  get openModalId(): string | null {
    return openModalId;
  },
  get drawerOpen(): boolean {
    return drawerOpen;
  },
  get pipelineRuns(): PipelineRun[] {
    return pipelineRuns;
  },

  /**
   * Global stacking rule: a modal always wins over the inspector drawer, so
   * opening one force-closes the other rather than stacking two overlays.
   */
  setOpenModal(id: string | null) {
    openModalId = id;
    if (id !== null) drawerOpen = false;
  },

  /**
   * Called by `pipeline.svelte.ts` whenever its run list changes so the shared
   * snapshot picks the history up. Never call this from the pipeline store with
   * a stale list.
   */
  syncPipelineRuns(nextRuns: PipelineRun[]) {
    pipelineRuns = nextRuns.map((run) => $state.snapshot(run));
    sync();
  },

  toggleTypeFilter(type: PackageType) {
    if (selectedTypes.includes(type)) {
      selectedTypes = selectedTypes.filter((t) => t !== type);
    } else {
      selectedTypes = [...selectedTypes, type];
    }
    sync();
  },

  /**
   * Selects a workspace and opens the inspector. Passing `null` closes the
   * drawer without discarding the selection.
   */
  setActiveWorkspace(id: string | null): void {
    if (id === null) {
      drawerOpen = false;
      return;
    }
    activeWorkspaceId = id;
    drawerOpen = true;
    sync();
  },

  closeDrawer(): void {
    drawerOpen = false;
  },

  filteredPackages(): WorkspacePackage[] {
    const query = searchQuery.trim().toLowerCase();

    return packages.filter((pkg) => {
      const matchSearch =
        !query ||
        pkg.name.toLowerCase().includes(query) ||
        pkg.description.toLowerCase().includes(query) ||
        pkg.tags.some((t) => t.toLowerCase().includes(query));

      const matchType = selectedTypes.length === 0 || selectedTypes.includes(pkg.type);

      // Derived strictly from the newest run that touched this workspace, so a
      // later success clears a failure from any earlier run.
      const matchStatus =
        selectedStatus === 'all' || getLatestRunStatus(pkg.id) === selectedStatus;

      return matchSearch && matchType && matchStatus;
    });
  },

  addPackage(newPkg: WorkspacePackage): { success: boolean; error?: string } {
    // Re-derive the slug so the registry invariant (safe, unique path segment)
    // holds no matter who constructed the package object.
    const baseSlug = slugify(newPkg.slug || newPkg.name);
    let slug = baseSlug;
    let counter = 1;
    while (packages.some((p) => p.slug === slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const finalized: WorkspacePackage = {
      ...newPkg,
      slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    packages = [...packages, finalized];
    sync(true);
    return { success: true };
  },

  removePackage(id: string, force = false): { success: boolean; error?: string } {
    const dependents = packages.filter((p) =>
      p.dependencies.some((d) => d.id === id && d.isInternal)
    );

    if (dependents.length > 0 && !force) {
      return {
        success: false,
        error: `Cannot remove: ${dependents.map((d) => d.name).join(', ')} depend on this package.`
      };
    }

    const remaining = packages
      .filter((p) => p.id !== id)
      .map((p) => ({
        ...p,
        dependencies: p.dependencies.filter((d) => d.id !== id),
        updatedAt: new Date().toISOString()
      }));

    packages = remaining;

    // Re-resolve the active workspace against the surviving registry so a
    // deletion can never leave a dangling id behind.
    activeWorkspaceId = resolveActiveWorkspace(activeWorkspaceId, remaining);

    sync(true);
    return { success: true };
  },

  linkDependency(fromId: string, toId: string, kind: DependencyKind = 'dependencies'): { success: boolean; error?: string } {
    if (fromId === toId) {
      return { success: false, error: 'A package cannot depend on itself.' };
    }

    const fromPkg = packages.find((p) => p.id === fromId);
    const toPkg = packages.find((p) => p.id === toId);

    if (!fromPkg || !toPkg) {
      return { success: false, error: 'Target package does not exist.' };
    }

    if (fromPkg.dependencies.some((d) => d.id === toId)) {
      return { success: false, error: 'Dependency is already linked.' };
    }

    const versionCheck = validateSemVer(toPkg.version);
    if (!versionCheck.valid) {
      return {
        success: false,
        error: `Cannot link ${toPkg.name}: ${versionCheck.error ?? 'target version is not valid SemVer.'}`
      };
    }

    if (wouldCreateCycle(packages, { from: fromId, to: toId })) {
      return { success: false, error: 'Linking this dependency would create a circular dependency cycle.' };
    }

    const newDep = {
      id: toPkg.id,
      name: toPkg.name,
      version: toPkg.version,
      kind,
      isInternal: true
    };

    packages = packages.map((p) => {
      if (p.id === fromId) {
        return {
          ...p,
          dependencies: [...p.dependencies, newDep],
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    sync();
    return { success: true };
  },

  unlinkDependency(fromId: string, toId: string) {
    packages = packages.map((p) => {
      if (p.id === fromId) {
        return {
          ...p,
          dependencies: p.dependencies.filter((d) => d.id !== toId),
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    sync();
  },

  updateScript(packageId: string, scriptId: string, patch: { name?: string; command?: string }): { success: boolean; error?: string } {
    const target = packages.find((p) => p.id === packageId);
    if (!target) return { success: false, error: 'Package not found.' };
    if (!target.scripts.some((s) => s.id === scriptId)) {
      return { success: false, error: 'Script not found.' };
    }

    packages = packages.map((p) => {
      if (p.id !== packageId) return p;
      return {
        ...p,
        scripts: p.scripts.map((s) => (s.id === scriptId ? { ...s, ...patch } : s)),
        updatedAt: new Date().toISOString()
      };
    });
    sync();
    return { success: true };
  },

  updatePackage(packageId: string, patch: Partial<Pick<WorkspacePackage, 'name' | 'description' | 'type' | 'tags'>>): { success: boolean; error?: string } {
    const target = packages.find((p) => p.id === packageId);
    if (!target) {
      return { success: false, error: 'Package not found.' };
    }

    if (patch.name !== undefined) {
      const check = validatePackageName(patch.name);
      if (!check.valid) {
        return { success: false, error: check.error ?? 'Invalid package name.' };
      }
    }

    // A rename must carry its derived metadata with it, otherwise the slug and
    // the on-disk path would keep pointing at the old name forever.
    const nextType = patch.type ?? target.type;
    let derived: Pick<WorkspacePackage, 'slug' | 'path'> | null = null;

    if (patch.name !== undefined && patch.name !== target.name) {
      const baseSlug = slugify(patch.name);
      let slug = baseSlug;
      let counter = 1;
      while (packages.some((p) => p.id !== packageId && p.slug === slug)) {
        slug = `${baseSlug}-${counter}`;
        counter += 1;
      }
      derived = {
        slug,
        path: `${nextType === 'app' ? 'apps' : 'packages'}/${slug}`
      };
    } else if (patch.type !== undefined && patch.type !== target.type) {
      // Moving between apps/* and packages/* keeps the slug but re-homes the path.
      const base = target.slug;
      derived = {
        slug: base,
        path: `${nextType === 'app' ? 'apps' : 'packages'}/${base}`
      };
    }

    packages = packages.map((p) =>
      p.id === packageId
        ? { ...p, ...patch, ...derived, updatedAt: new Date().toISOString() }
        : p
    );
    sync();
    return { success: true };
  },

  resetToSeed() {
    const seed = getInitialSeedData();
    packages = seed.packages;
    pipelineRuns = [];
    activeWorkspaceId = resolveActiveWorkspace(seed.activeWorkspaceId, seed.packages);
    searchQuery = '';
    selectedTypes = [];
    selectedStatus = 'all';
    openModalId = null;
    drawerOpen = false;
    saveStateImmediate(seed);
  },

  importSnapshot(state: MonorepoStorageState): { success: boolean; error?: string } {
    const validated = validateStorageSnapshot(state);
    if (!validated) {
      return { success: false, error: 'Invalid state snapshot.' };
    }
    packages = validated.packages;
    activeWorkspaceId = resolveActiveWorkspace(validated.activeWorkspaceId, validated.packages);
    saveStateImmediate({
      ...validated,
      activeWorkspaceId
    });
    return { success: true };
  },

  exportSnapshot(): string {
    flushStorage();
    return JSON.stringify(getSnapshot(), null, 2);
  }
};
