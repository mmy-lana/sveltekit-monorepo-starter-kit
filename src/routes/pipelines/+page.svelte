<script lang="ts">
  import { pipelineStore } from '$lib/stores/pipeline.svelte';
  import PipelineVisualizer from '$lib/components/features/PipelineVisualizer.svelte';
  import TerminalOutput from '$lib/components/molecules/TerminalOutput.svelte';
  import Button from '$lib/components/ui/Button.svelte';
</script>

<svelte:head>
  <title>Pipeline Execution & Logs | Monorepo Platform</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-lg font-bold font-mono text-white uppercase tracking-wider">Task Pipelines & Telemetry</h1>
      <p class="text-xs text-neutral-400 mt-1">Topological execution runner with live stream telemetry and cache validation</p>
    </div>
    <div class="flex items-center gap-2">
      <Button
        variant="secondary"
        size="md"
        onclick={() => pipelineStore.runPipeline('test')}
        loading={pipelineStore.isExecuting}
      >
        Run Tests
      </Button>
      <Button
        variant="primary"
        size="md"
        onclick={() => pipelineStore.runPipeline('build')}
        loading={pipelineStore.isExecuting}
      >
        Run Build Pipeline
      </Button>
    </div>
  </div>

  <PipelineVisualizer />

  <div>
    <h2 class="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">Live Process Output Stream</h2>
    <TerminalOutput logs={pipelineStore.terminalLogs} onclear={() => pipelineStore.clearLogs()} />
  </div>
</div>
