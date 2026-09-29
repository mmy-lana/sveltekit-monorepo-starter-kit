export type PackageType = 'app' | 'lib' | 'tool' | 'config';

export type TaskStatus = 'idle' | 'queued' | 'running' | 'success' | 'failure' | 'cached';

export type DependencyKind = 'dependencies' | 'devDependencies' | 'peerDependencies';

export interface SemVerValidationRule {
  pattern: string;
  allowPrerelease: boolean;
}

export interface WorkspaceDependency {
  id: string;
  name: string;
  version: string;
  kind: DependencyKind;
  isInternal: boolean;
  resolvedPath?: string;
}

export interface WorkspaceScript {
  id: string;
  name: string;
  command: string;
  env?: Record<string, string>;
}

export interface WorkspacePackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  type: PackageType;
  path: string;
  description: string;
  dependencies: WorkspaceDependency[];
  scripts: WorkspaceScript[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStep {
  id: string;
  workspaceId: string;
  scriptName: string;
  status: TaskStatus;
  exitCode: number | null;
  durationMs: number;
  stdout: string[];
  stderr: string[];
  cached: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PipelineRun {
  id: string;
  trigger: 'manual' | 'watch' | 'ci';
  command: string;
  scope: string[];
  status: TaskStatus;
  totalDurationMs: number;
  steps: PipelineStep[];
  createdAt: string;
  completedAt: string | null;
}

export interface ScaffoldTemplateOption {
  id: string;
  label: string;
  value: string;
  description: string;
}

export interface ScaffoldBlueprint {
  id: string;
  name: string;
  type: PackageType;
  defaultDependencies: Record<string, string>;
  defaultDevDependencies: Record<string, string>;
  files: {
    path: string;
    content: string;
  }[];
  scripts: Record<string, string>;
}

export interface DependencyGraphNode {
  id: string;
  name: string;
  type: PackageType;
  depth: number;
  dependenciesCount: number;
  dependentsCount: number;
}

export interface DependencyGraphLink {
  source: string;
  target: string;
  kind: DependencyKind;
}

export interface DependencyGraphData {
  nodes: DependencyGraphNode[];
  links: DependencyGraphLink[];
}

export interface WorkspaceFilterState {
  searchQuery: string;
  types: PackageType[];
  tags: string[];
  statusFilter: TaskStatus | 'all';
}

export interface MonorepoStorageState {
  version: number;
  activeWorkspaceId: string | null;
  packages: WorkspacePackage[];
  pipelineRuns: PipelineRun[];
  scaffoldBlueprints: ScaffoldBlueprint[];
  persistedFilters: WorkspaceFilterState;
  updatedAt: string;
}
