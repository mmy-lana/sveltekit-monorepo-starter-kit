# Architecture Plan: Vite Custom Starter Kit Monorepo Platform

Repository Slug: `sveltekit-monorepo-starter-kit`  
Tech Stack: SvelteKit (latest) + Tailwind CSS (latest via `@tailwindcss/vite`) + TypeScript (latest)  
Package Manager: Strictly `pnpm` (latest)  
Design Aesthetic: Monorepo Developer Dashboard (Dense, dark-mode first, telemetry HUD, modular workspaces)

---

## 0. Hard Architectural & Compiler Constraints

1. **Package Manager & Dependencies**: Strictly use `pnpm`. No version numbers anywhere in dependencies; use `latest` tag exclusively (e.g. `pnpm add -D @tailwindcss/vite@latest tailwindcss@latest svelte@latest @sveltejs/kit@latest typescript@latest`).
2. **Tailwind CSS v4 Standard**:
   - Zero `tailwind.config.js`, zero `postcss.config.js`.
   - Integration strictly via `@tailwindcss/vite` in `vite.config.ts`.
   - Styles defined in `src/app.css` using `@import "tailwindcss";` and `@theme {}` CSS variables.
   - Dark mode configured via `@custom-variant dark (&:where(.dark, .dark *));`.
3. **Svelte 5 Runes Enforcement**:
   - Set `compilerOptions: { runes: true }` in `svelte.config.js`.
   - Zero legacy syntax: strictly ban `export let`, `$:` reactive statements, `beforeUpdate`, `afterUpdate`, and `createEventDispatcher`.
   - Exclusively use `$props()`, `$state()`, `$derived()`, `$effect()`, and callback props.
   - Runes outside `.svelte` components are permitted strictly in `*.svelte.ts` files (`monorepo.svelte.ts`, `pipeline.svelte.ts`). All other helper modules (`dag.ts`, `formatters.ts`, `scaffold.ts`) must remain pure functions with zero runes.
4. **Rendering Mode — Client-Only App**:
   - This app has no backend; all state lives in `localStorage`, which does not exist during SSR.
   - Set `export const ssr = false;` in `src/routes/+layout.ts` to disable server rendering entirely.
   - No component or store may reference `window`, `localStorage`, or `document` outside this constraint being in place — do not additionally scatter `browser` checks as a substitute; the layout-level `ssr = false` is the single source of truth.
5. **Store Dependency Direction**:
   - `pipeline.svelte.ts` may import state/selectors from `monorepo.svelte.ts`.
   - `monorepo.svelte.ts` must never import from `pipeline.svelte.ts` — this prevents a circular module dependency.
   - Any UI needing both package data and live run status (e.g. a package card showing its latest pipeline result) combines them locally via a component-level `$derived`, not inside either store.

---

## 1. Data Schema & Pure TypeScript Interfaces

File path: `src/lib/types/index.ts`

```typescript
export type PackageType = 'app' | 'lib' | 'tool' | 'config';

export type TaskStatus = 'idle' | 'queued' | 'running' | 'success' | 'failure' | 'cached';

export type DependencyKind = 'dependencies' | 'devDependencies' | 'peerDependencies';

export interface SemVerValidationRule {
  pattern: string;
  allowPrerelease: boolean;
}
// NOTE: This type is consumed exclusively by `scaffold.ts` (package name/version
// validation during ScaffoldWizardModal Step 2) and by `linkDependency`'s version-string
// field validation. It must not be reinvented ad hoc elsewhere — see §3.4.

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
  /** Cached steps strictly enforce exitCode: 0, durationMs: 0, cached: true */
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
```

---

## 2. Component Architecture

### 2.1 Atomic UI Primitives (`src/lib/components/ui/`)
- `Button.svelte`: Native button with variant mappings (`primary`, `secondary`, `outline`, `ghost`, `danger`), sizes (`sm`, `md`, `lg`), loading spinner indicator, disabled state propagation.
- `Badge.svelte`: Exhaustive variant map covering all `PackageType` members (`app`, `lib`, `tool`, `config`) and all `TaskStatus` members (`idle`, `queued`, `running`, `success`, `failure`, `cached`). Type the variant map as `Record<PackageType, ...>` / `Record<TaskStatus, ...>` (or `satisfies` equivalents) so TypeScript enforces completeness — a missing key must be a compile error, not a runtime fallback.
- `Input.svelte`: Semantic text input with search icon integration, keyboard shortcut badge attachment, clear trigger.
- `Select.svelte`: Fully accessible headless single/multi-selector with custom dropdown portal support.
- `Card.svelte`: Surface container with border gradient, optional header, body, and action footer slots.
- `Modal.svelte`: Accessible backdrop dialog with focus trap, escape key binding, body scroll locking. Focus trap must release cleanly on unmount (no dangling `document` listeners). **Global stacking rule**: only one modal/drawer instance (`Modal.svelte`-based or `WorkspaceDetailDrawer.svelte`) may be open at a time app-wide; opening a second force-closes the first before mounting.
- `Tabs.svelte`: Context-driven tab strip with underline indicator and responsive scroll overflow. Tab buttons enforce a minimum `44x44px` touch target on mobile, matching `Button.svelte` and `SearchFilterBar.svelte` pill sizing.

### 2.2 Compound Molecules (`src/lib/components/molecules/`)
- `TerminalOutput.svelte`: ANSI-styled console stream display wrapped in `overflow-x-auto` with internal `white-space: pre` preservation. Prevents document horizontal scroll on 360px viewports. Includes line numbers, copy action, and search filter.
- `MetricBadge.svelte`: Developer HUD mini-stat displaying build time, cache ratio, bundle footprint, and package depth.
- `SearchFilterBar.svelte`: Responsive omni-search control. Renders as a stacked, wrapped layout on screens `<640px` with minimum `44x44px` touch targets on all filter pills, and a single flex line on `lg:` viewports.
- `ScriptRunnerButton.svelte`: Quick-action run trigger with running spinner, progress duration counter, cancel trigger, and min `44px` mobile touch height.
- `DependencyListRow.svelte`: Collapsible dependency listing showing internal monorepo links versus external registry items.

### 2.3 Domain Feature Components (`src/lib/components/features/`)
- `WorkspaceGrid.svelte`: Responsive package matrix supporting mobile single-column (`360px-430px`) to wide-desktop multi-column (`1024px+`) card layouts. Renders an explicit empty state ("No packages yet — scaffold one to get started" + CTA) when `packages.length === 0`, including immediately after a `StorageSnapshotPanel` reset.
- `WorkspaceDetailDrawer.svelte`: Off-canvas inspection panel. Renders as a full-screen modal or bottom sheet on viewports `<1024px`, and a right-docked sliding side-drawer on `1024px+`.
- `PipelineVisualizer.svelte`: Stage-by-stage pipeline visualization showing topological execution orders, active status, duration metrics.
- `GraphCanvas.svelte`: Adaptive SVG dependency visualization. Automatically swaps to a clean hierarchical list/tree view on viewports `<640px` (avoiding touch collision with document scroll); enables pinch-to-zoom and canvas pan strictly on `>=640px` with `touch-action: none` and node hitboxes >= `44x44px`. When `graphData.nodes.length === 0` (empty registry), skip all layout computation (no force/hierarchical math runs against zero nodes) and render a placeholder message instead, in both the canvas and tree-view modes.
- `ScaffoldWizardModal.svelte`: Multi-step generator to scaffold new packages/apps with template selection, package naming validation, automated dependency wiring.
- `StorageSnapshotPanel.svelte`: Export, import, and reset local state capabilities for reproducibility and testing.

---

## 3. Core Feature Logic & Algorithms

### 3.1 Directed Acyclic Graph (DAG) & Topological Sorter
File path: `src/lib/utils/dag.ts`
- **Algorithm**: Kahn's Algorithm / Depth-First Search for cycle detection and topological execution sequencing.
- Computes build ordering such that all dependencies are compiled before dependents.
- Detects circular references and outputs diagnostic cycle path arrays (e.g., `pkg-a -> pkg-b -> pkg-a`).
- Exposes a standalone `wouldCreateCycle(packages: WorkspacePackage[], newEdge: { from: string; to: string }): boolean` helper, used by `monorepo.svelte.ts`'s `linkDependency` to validate an edge *before* committing it to state (see §3.4).

### 3.2 Task Pipeline Execution Engine
File path: `src/lib/stores/pipeline.svelte.ts`
- Svelte 5 Rune-based reactive state module (`$state`, `$derived`).
- Dispatches execution steps topologically according to execution batches from `dag.ts`.
- Simulates process execution logs with deterministic streaming intervals.
- Enforces strict cache contract: if workspace `updatedAt` and its dependency sub-tree timestamps are unchanged since the prior successful run, status resolves to `cached` with `exitCode: 0`, `durationMs: 0`, and `cached: true`.

### 3.3 Unified Storage & Mutation Manager
File path: `src/lib/storage/localStorageManager.ts`
- Single write funnel pattern to prevent localStorage race conditions: all mutations from `monorepo.svelte.ts` and `pipeline.svelte.ts` dispatch through a single debounced (200ms) `persist(state: MonorepoStorageState)` handler.
- **Flush-on-exit guarantee**: register `window.addEventListener('beforeunload', flush)` and SvelteKit's `beforeNavigate` (from `$app/navigation`) to force-flush any pending debounced write, preventing data loss on tab close or route change. Terminal actions (scaffold completion, package deletion) bypass the debounce and write immediately.
- Persists under key `sveltekit_monorepo_platform_v1`.
- Provides full data hydration with initial seed fallback containing demo packages:
  - `apps/web` (SvelteKit Web Application)
  - `apps/docs` (Documentation Portal)
  - `packages/ui` (Shared Svelte Component Library)
  - `packages/utils` (Pure TypeScript Helper Library)
  - `packages/config-tailwind` (Shared Tailwind Configuration)
- Schema version validation with automatic migration fallback.

### 3.4 Data Integrity & Lifecycle Rules
- **Slug & ID Uniqueness**: `addPackage` checks for existing slug collisions against all packages in state; appends a unique numeric suffix if duplicate detected.
- **Cascading Dependency Cleanup**: `removePackage(id)` blocks deletion if dependent packages exist unless `force: true` is passed. On confirmed deletion, it strips matching entries from all remaining packages' single `dependencies[]` array (filtering by referenced package `id`, regardless of `kind`) to prevent graph visualization math panics. `WorkspacePackage` has exactly one dependency array, disambiguated by `DependencyKind` — do not introduce a second `devDependencies[]` field.
- **Cycle Prevention on Link**: `linkDependency(fromId, toId)` must call `dag.ts`'s cycle detector against the *hypothetical* post-link edge set before committing. If the new edge would introduce a cycle, reject the mutation (surface an error to the caller) and do not write to state.
- **Cycle Handling at Dispatch**: `pipeline.svelte.ts`'s dispatch logic must check `getTopologicalOrder(...).hasCycle` before running. If `true`, abort the run, set a dedicated `blocked` pipeline status, and surface `cyclePath` in `PipelineVisualizer` rather than silently producing empty execution batches.
- **Timestamp Mutation Contract**: Every package modification (`updateScript`, `linkDependency`, `unlinkDependency`, `updatePackage`) immediately sets `updatedAt: new Date().toISOString()`, driving pipeline cache invalidation.
- **Live Graph Derivation**: `DependencyGraphData` is never computed once and cached manually. It is always `const graphData = $derived(buildGraph(monorepoStore.packages));` so `GraphCanvas` and the inspector sidebar stay in sync with every mutation.
- **`resolvedPath` Scope**: For v1, `WorkspaceDependency.resolvedPath` is derived live at read time from the current `packages` list (a lookup function), never stored/cached on the dependency object itself — this avoids staleness if a package's `path` changes in a future edit action.

### 3.4 Package Scaffolding Engine
File path: `src/lib/utils/scaffold.ts`
- Validates kebab-case and scope naming conventions (`@workspace/<name>`).
- Generates simulated file tree output and automatically injects cross-package references into affected workspaces.

---

## 4. Five-Phase Sequential Implementation Queue

### Phase 1: Types, Storage/API Client Config, and Base Utilities
1. Configure `svelte.config.js` with `compilerOptions: { runes: true }`.
2. Create `src/lib/types/index.ts` with complete types and cache contracts.
3. Build `src/lib/storage/localStorageManager.ts`:
   - Safe `window.localStorage` read/write abstractions with single debounced write funnel.
   - Initial seed dataset creation and schema version verification.
   - Snapshot export/import utilities.
4. Build pure utility modules (pure TypeScript, zero runes allowed):
   - `src/lib/utils/dag.ts`: Topological sort, Kahn's cycle detector, graph builder.
   - `src/lib/utils/formatters.ts`: Durations, byte size, date humanizers.
   - `src/lib/utils/scaffold.ts`: Template code generator and manifest factory.

### Phase 2: Design Foundation & Atomic UI Primitives
1. Tailwind v4 setup:
   - Configure `vite.config.ts` with `@tailwindcss/vite` plugin.
   - Configure `src/app.css` using `@import "tailwindcss";`, `@custom-variant dark (&:where(.dark, .dark *));`, and custom `@theme` variables (no `tailwind.config.js` or `postcss.config.js`).
2. Implement core UI primitives in `src/lib/components/ui/` using Svelte 5 `$props()`:
   - `Button.svelte`: variants, sizes, min 44x44px mobile touch area.
   - `Badge.svelte`: package types, build statuses.
   - `Input.svelte`: accessible text input with clear trigger and icon slot.
   - `Select.svelte`: accessible select wrapper with dropdown options.
   - `Card.svelte`: dark-themed developer card container.
   - `Modal.svelte`: keyboard-trapped modal dialog.
   - `Tabs.svelte`: horizontal scrollable tab header.
   - `Button.svelte`
   - `Badge.svelte`
   - `Input.svelte`
   - `Select.svelte`
   - `Card.svelte`
   - `Modal.svelte`
   - `Tabs.svelte`
3. Verify accessibility: aria attributes, focus rings, keyboard tab-indices, minimum touch targets (>= 44x44px for touch displays).

### Phase 3: Compound Molecules & Feature Components
1. Implement `TerminalOutput.svelte` with line indexing, clear buffer, and copy utilities.
2. Implement `MetricBadge.svelte` with colored visual states based on thresholds.
3. Implement `SearchFilterBar.svelte` handling filter criteria reactivity.
4. Implement `ScriptRunnerButton.svelte` with dynamic states (idle, executing, complete).
5. Implement `DependencyListRow.svelte` with navigable internal workspace triggers.

### Phase 4: Domain Logic, Reactive State, and Specialized APIs
1. Implement `src/lib/stores/monorepo.svelte.ts` (Svelte 5 runes store):
   - Reactive package registry using `$state` and `$derived`.
   - Active workspace selection state.
   - Filter and query computed lists.
   - Slug uniqueness validation and cascading cleanup on package deletion.
   - Automatic `updatedAt` updates on every mutation to invalidate pipeline caches.
   - Integrated with `persist()` funnel in `localStorageManager.ts`.
2. Implement `src/lib/stores/pipeline.svelte.ts` (Svelte 5 runes store):
   - Task pipeline dispatch logic using topological execution batches.
   - Enforce cached status contract (`exitCode: 0`, `durationMs: 0`, `cached: true`).
   - Output log streamer simulation.
   - Integrated with `persist()` funnel in `localStorageManager.ts`.
3. Implement `GraphCanvas.svelte`:
   - Viewport fallback: `<640px` renders accessible hierarchical tree view; `>=640px` renders interactive SVG graph.
   - SVG pan, pinch-to-zoom, node drag with `touch-action: none` and >= 44x44px target sizes.
4. Implement `ScaffoldWizardModal.svelte`:
   - Step 1: Template selection (Application, Library, Utility, Config)
   - Step 2: Name & metadata input validation
   - Step 3: Dependency selection from existing monorepo packages
   - Step 4: Verification and instant state persistence

### Phase 5: Complete Page/Screen Assembly & Responsive Shell
1. Create `src/routes/+layout.ts` with `export const ssr = false;` (client-only app; see §0.4).
2. Build `src/routes/+layout.svelte`:
   - Monorepo developer HUD top bar (Branch indicator, Node engine version, Cache hit ratio, Reset/Export actions). The Reset/Export actions render `StorageSnapshotPanel.svelte` inline within this bar's action group — it is not a standalone route or modal.
   - Responsive sidebar navigation (Workspace overview, Dependency graph, Pipeline runner, Scaffold wizard).
   - Breakpoint enforcement: drawer sheet for mobile screens (`< 1024px`), persistent dock for desktop.
2. Build `src/routes/+page.svelte` (Dashboard Workspace Overview):
   - Summary statistics grid (Total Packages, Applications, Shared Libs, Cyclic Health).
   - Filter bar and Package Card collection.
   - Interactive Script Execution drawer integration.
3. Build `src/routes/graph/+page.svelte`:
   - Full-bleed Dependency Graph visualization with package inspector sidebar.
4. Build `src/routes/pipelines/+page.svelte`:
   - Pipeline run history, real-time stage progression, live simulated terminal inspector.
5. Responsive layout validation:
   - Mobile: 360px, 390px, 430px (single column, full-width touch actions, drawers)
   - Tablet: 768px (2-column grid, compact header metrics)
   - Desktop: 1024px, 1440px+ (multi-column matrix, side-by-side terminal logs and graph visualizer).