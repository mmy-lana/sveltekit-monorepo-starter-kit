import type { DependencyGraphData, DependencyGraphLink, DependencyGraphNode, WorkspacePackage } from '$lib/types';

export function buildGraph(packages: WorkspacePackage[]): DependencyGraphData {
  if (!packages || packages.length === 0) {
    return { nodes: [], links: [] };
  }

  const packageMap = new Map<string, WorkspacePackage>();
  for (const pkg of packages) {
    packageMap.set(pkg.id, pkg);
  }

  const dependentsCountMap = new Map<string, number>();
  for (const pkg of packages) {
    dependentsCountMap.set(pkg.id, 0);
  }

  const links: DependencyGraphLink[] = [];

  for (const pkg of packages) {
    for (const dep of pkg.dependencies) {
      if (dep.isInternal && packageMap.has(dep.id)) {
        links.push({
          source: pkg.id,
          target: dep.id,
          kind: dep.kind
        });
        const currentCount = dependentsCountMap.get(dep.id) ?? 0;
        dependentsCountMap.set(dep.id, currentCount + 1);
      }
    }
  }

  const nodes: DependencyGraphNode[] = packages.map((pkg) => {
    return {
      id: pkg.id,
      name: pkg.name,
      type: pkg.type,
      depth: computeDepth(pkg.id, packageMap),
      dependenciesCount: pkg.dependencies.filter((d) => d.isInternal && packageMap.has(d.id)).length,
      dependentsCount: dependentsCountMap.get(pkg.id) ?? 0
    };
  });

  return { nodes, links };
}

/**
 * Longest-path depth: 0 for a workspace with no internal dependencies, and
 * `1 + max(depth(dependency))` otherwise. Memoised and cycle-guarded so a
 * malformed graph degrades to depth 0 instead of recursing forever.
 */
function computeDepth(rootId: string, packageMap: Map<string, WorkspacePackage>): number {
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const walk = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;

    const pkg = packageMap.get(id);
    if (!pkg) return 0;

    visiting.add(id);
    let depth = 0;
    for (const dep of pkg.dependencies) {
      if (!dep.isInternal || !packageMap.has(dep.id)) continue;
      depth = Math.max(depth, walk(dep.id) + 1);
    }
    visiting.delete(id);

    memo.set(id, depth);
    return depth;
  };

  return walk(rootId);
}

export function wouldCreateCycle(
  packages: WorkspacePackage[],
  newEdge: { from: string; to: string }
): boolean {
  if (newEdge.from === newEdge.to) return true;

  const adjList = new Map<string, Set<string>>();
  for (const pkg of packages) {
    adjList.set(pkg.id, new Set<string>());
  }

  for (const pkg of packages) {
    const fromSet = adjList.get(pkg.id);
    if (!fromSet) continue;
    for (const dep of pkg.dependencies) {
      if (dep.isInternal && adjList.has(dep.id)) {
        fromSet.add(dep.id);
      }
    }
  }

  const edgeSet = adjList.get(newEdge.from);
  if (edgeSet) {
    edgeSet.add(newEdge.to);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycleDFS(node: string): boolean {
    visited.add(node);
    recStack.add(node);

    const neighbors = adjList.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }
    }

    recStack.delete(node);
    return false;
  }

  for (const pkg of packages) {
    if (!visited.has(pkg.id)) {
      if (hasCycleDFS(pkg.id)) return true;
    }
  }

  return false;
}

export function getTopologicalOrder(packages: WorkspacePackage[]): {
  executionBatches: string[][];
  hasCycle: boolean;
  cyclePath?: string[];
} {
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const pkg of packages) {
    inDegree.set(pkg.id, 0);
    dependents.set(pkg.id, []);
  }

  for (const pkg of packages) {
    for (const dep of pkg.dependencies) {
      if (dep.isInternal && inDegree.has(dep.id)) {
        inDegree.set(pkg.id, (inDegree.get(pkg.id) ?? 0) + 1);
        dependents.get(dep.id)?.push(pkg.id);
      }
    }
  }

  const batches: string[][] = [];
  let currentBatch: string[] = [];

  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      currentBatch.push(id);
    }
  }

  let processedCount = 0;

  while (currentBatch.length > 0) {
    batches.push(currentBatch);
    processedCount += currentBatch.length;
    const nextBatch: string[] = [];

    for (const id of currentBatch) {
      const targets = dependents.get(id) ?? [];
      for (const target of targets) {
        const remaining = (inDegree.get(target) ?? 1) - 1;
        inDegree.set(target, remaining);
        if (remaining === 0) {
          nextBatch.push(target);
        }
      }
    }

    currentBatch = nextBatch;
  }

  if (processedCount < packages.length) {
    return {
      executionBatches: [],
      hasCycle: true,
      cyclePath: findCyclePath(packages)
    };
  }

  return {
    executionBatches: batches,
    hasCycle: false
  };
}

/**
 * Produces a concrete diagnostic path for the first cycle found, formatted as
 * human-readable package names (e.g. `pkg-a -> pkg-b -> pkg-a`). Returns an
 * empty array when no cycle exists.
 */
function findCyclePath(packages: WorkspacePackage[]): string[] {
  const nameById = new Map(packages.map((p) => [p.id, p.name]));

  const adjacency = new Map<string, string[]>();
  for (const pkg of packages) {
    adjacency.set(
      pkg.id,
      pkg.dependencies.filter((d) => d.isInternal).map((d) => d.id)
    );
  }

  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  const dfs = (node: string): string[] | null => {
    visited.add(node);
    stack.push(node);
    onStack.add(node);

    for (const next of adjacency.get(node) ?? []) {
      if (!adjacency.has(next)) continue;
      if (onStack.has(next)) {
        // Unwind back to where `next` first entered the stack.
        const start = stack.indexOf(next);
        return [...stack.slice(start), next];
      }
      if (!visited.has(next)) {
        const found = dfs(next);
        if (found) return found;
      }
    }

    stack.pop();
    onStack.delete(node);
    return null;
  };

  for (const pkg of packages) {
    if (visited.has(pkg.id)) continue;
    const cycle = dfs(pkg.id);
    if (cycle) return cycle.map((id) => nameById.get(id) ?? id);
  }

  return [];
}
