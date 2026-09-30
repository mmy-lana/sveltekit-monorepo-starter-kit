<script lang="ts">
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import { pipelineStore } from '$lib/stores/pipeline.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let fileInput: HTMLInputElement;

  function handleExport() {
    const raw = monorepoStore.exportSnapshot();
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monorepo-state-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportTrigger() {
    fileInput?.click();
  }

  function handleFileSelected(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const result = monorepoStore.importSnapshot(json);
        if (!result.success) {
          alert(result.error ?? 'Snapshot could not be imported.');
        } else {
          pipelineStore.resetRuns();
        }
      } catch {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    target.value = '';
  }

  function handleReset() {
    if (confirm('Reset monorepo to default seed state? All customizations will be reset.')) {
      monorepoStore.resetToSeed();
      pipelineStore.resetRuns();
    }
  }
</script>

<div class="flex items-center gap-1.5">
  <input
    type="file"
    accept=".json"
    class="hidden"
    bind:this={fileInput}
    onchange={handleFileSelected}
  />
  <Button variant="ghost" size="sm" onclick={handleExport} class="text-[11px] font-mono min-h-[36px]">
    Export
  </Button>
  <Button variant="ghost" size="sm" onclick={handleImportTrigger} class="text-[11px] font-mono min-h-[36px]">
    Import
  </Button>
  <Button variant="danger" size="sm" onclick={handleReset} class="text-[11px] font-mono min-h-[36px]">
    Reset
  </Button>
</div>
