# SvelteKit Monorepo Platform

A client-side developer dashboard and visual simulation engine for Vite and SvelteKit monorepos. It models workspace packages, dependency DAGs, pipeline execution batches, and package scaffolding entirely in the browser.

- Live Demo: https://sveltekit-monorepo-starter-kit.vercel.app
- Repository: https://github.com/mmy-lana/sveltekit-monorepo-starter-kit

---

## Overview

Working with monorepos often involves complex topological graphs, multi-package linking, and task caching mechanics. This platform visualizes and simulates those workflows directly in the browser with zero external backend dependencies.

### Core Features

- Workspace Registry: Inspect, edit, link, and delete packages (`app`, `lib`, `tool`, `config`).
- Topological DAG Visualizer: Layered hierarchical layout displaying upstream and downstream workspace dependencies with cycle detection.
- Pipeline Runner: Dispatches parallel build and test batches with simulated cache hits, durations, exit codes, and live terminal streaming.
- Package Scaffolding Wizard: Create new applications or shared packages with automatic dependency wiring and input sanitization.
- State Persistence: Debounced storage funnel with prototype-pollution stripping, snapshot export, and import validation.
- Responsive HUD: Dense developer interface with bottom-sheet drawers on mobile and responsive SVG canvas interaction on desktop.

---

## Tech Stack

- Framework: SvelteKit (Client-Only / SPA Mode)
- Reactivity: Svelte 5 (Runes: `$state`, `$derived`, `$props`, `$effect`)
- Styling: Tailwind CSS v4 (via `@tailwindcss/vite` and CSS variables)
- Language: TypeScript (Strict mode)
- Package Manager: pnpm
- Verification: Playwright (Headless Chromium smoke suite)

---

## Architecture

```
src/
  lib/
    components/
      features/      # WorkspaceGrid, GraphCanvas, PipelineVisualizer, ScaffoldWizard
      molecules/     # TerminalOutput, SearchFilterBar, MetricBadge
      ui/            # Button, Badge, Card, Modal, Input, Select, Tabs
    storage/         # LocalStorage manager, snapshot validation, debounced persistence
    stores/          # monorepoStore, pipelineStore (Svelte 5 Runes)
    types/           # Domain schemas (WorkspacePackage, PipelineRun, DAG nodes)
    utils/           # Kahn's algorithm DAG, formatters, scaffolding utilities
  routes/
    graph/           # Dependency matrix page
    pipelines/       # Task execution and log streamer page
    +layout.svelte   # Persistent HUD header and navigation
    +page.svelte     # Dashboard workspace overview
```

### Unidirectional Store Flow
State strictly flows one way: `pipelineStore` reads selectors from `monorepoStore`. `monorepoStore` never imports from `pipelineStore`. All state persistence is routed through a single debounced funnel to prevent storage write race conditions.

---

## Getting Started

### Prerequisites

- Node.js (Active LTS)
- pnpm

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/mmy-lana/sveltekit-monorepo-starter-kit.git
cd sveltekit-monorepo-starter-kit
pnpm install
```

### Development

Start the local development server:

```bash
pnpm dev
```

Open `http://localhost:5173` in your browser.

### Typecheck and Build

Run full TypeScript verification and create a production build:

```bash
pnpm check
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

### Headless Verification Suite

Run the automated integration and security smoke test suite (runs in Playwright headless Chromium):

```bash
pnpm verify
```

---

## Security & Reliability Design

- Prototype Pollution Protection: Snapshot import payloads are recursively sanitized to reject `__proto__`, `constructor`, and `prototype` overrides.
- Path Traversal Defenses: Scaffolding and path resolution reject `..`, absolute paths, shell metacharacters, and URL schemes.
- Acyclic Enforcement: Circular references are blocked prior to edge insertion using Kahn's algorithm and depth-first search cycle detection.
- Headless Test Safe: Interactive deletion workflows use non-blocking inline confirmation states instead of blocking browser dialogs.

---

## License

MIT
