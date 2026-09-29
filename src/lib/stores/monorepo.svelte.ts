import type { DependencyKind, MonorepoStorageState, PackageType, TaskStatus, WorkspacePackage } from '$lib/types';
import { flushStorage, getInitialSeedData, loadState, persist, saveStateImmediate } from '$lib/storage/localStorageManager';
import { wouldCreateCycle } from '$lib/utils/dag';

const initial = loadState();

let packages = $state<WorkspacePackage[]>(initial.packages);
let activeWorkspaceId = $state<string | null>(initial.activeWorkspaceId);
let searchQuery = $state<string>(initial.persistedFilters.searchQuery || '');
let selectedTypes = $state<PackageType[]>(initial.persistedFilters.types || []);
let selectedStatus = $state<TaskStatus | 'all'>(initial.persistedFilters.statusFilter || 'all');
let openModalId = $state<string | null>(null);

function getSnapshot(): MonorepoStorageState {
  return {
    version: initial.version,
    activeWorkspaceId,
    packages,
    pipelineRuns: initial.pipelineRuns,
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
  get openModalId() {
    return openModalId;
  },

  setOpenModal(id: string | null) {
    openModalId = id;
  },

  toggleTypeFilter(type: PackageType) {
    if (selectedTypes.includes(type)) {
      selectedTypes = selectedTypes.filter((t) => t !== type);
    } else {
      selectedTypes = [...selectedTypes, type];
    }
    sync();
  },

  setActiveWorkspace(id: string | null) {
    activeWorkspaceId = id;
    sync();
  },

  filteredPackages(): WorkspacePackage[] {
    return packages.filter((pkg) => {
      const matchSearch =
        !searchQuery ||
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType = selectedTypes.length === 0 || selectedTypes.includes(pkg.type);

      return matchSearch && matchType;
    });
  },

  addPackage(newPkg: WorkspacePackage): { success: boolean; error?: string } {
    let slug = newPkg.slug;
    let counter = 1;
    while (packages.some((p) => p.slug === slug)) {
      slug = `${newPkg.slug}-${counter}`;
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

    packages = packages
      .filter((p) => p.id !== id)
      .map((p) => ({
        ...p,
        dependencies: p.dependencies.filter((d) => d.id !== id),
        updatedAt: new Date().toISOString()
      }));

    if (activeWorkspaceId === id) {
      activeWorkspaceId = null;
    }

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

  resetToSeed() {
    const seed = getInitialSeedData();
    packages = seed.packages;
    activeWorkspaceId = seed.activeWorkspaceId;
    searchQuery = '';
    selectedTypes = [];
    selectedStatus = 'all';
    saveStateImmediate(seed);
  },

  importSnapshot(state: MonorepoStorageState): { success: boolean; error?: string } {
    if (!state.packages || !Array.isArray(state.packages)) {
      return { success: false, error: 'Invalid state snapshot.' };
    }
    packages = state.packages;
    activeWorkspaceId = state.activeWorkspaceId;
    saveStateImmediate(state);
    return { success: true };
  },

  exportSnapshot(): string {
    flushStorage();
    return JSON.stringify(getSnapshot(), null, 2);
  }
};
