<script lang="ts">
  interface Props {
    label: string;
    value: string | number;
    sublabel?: string;
  }

  let { label, value, sublabel }: Props = $props();
</script>

<div class="bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
  <span class="text-[11px] font-mono uppercase tracking-wider text-neutral-400">{label}</span>
  <span class="text-xl font-bold font-mono text-neutral-100 mt-1">{value}</span>
  {#if sublabel}
    <span class="text-[10px] text-neutral-500 mt-0.5">{sublabel}</span>
  {/if}
</div>
