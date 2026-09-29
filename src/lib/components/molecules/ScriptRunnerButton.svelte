<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';

  interface Props {
    scriptName: string;
    isRunning?: boolean;
    onclick: () => void;
  }

  let { scriptName, isRunning = false, onclick }: Props = $props();
</script>

<Button
  variant="secondary"
  size="sm"
  loading={isRunning}
  {onclick}
  class="font-mono text-xs px-2.5 py-1.5 min-h-[44px]"
>
  <span class="text-neutral-500 mr-1.5">$</span>
  <span>{scriptName}</span>
</Button>
