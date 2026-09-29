<script lang="ts">
  interface Option {
    label: string;
    value: string;
  }

  interface Props {
    options: Option[];
    value: string;
    disabled?: boolean;
    class?: string;
    onchange?: (val: string) => void;
  }

  let { options, value = $bindable(), disabled = false, class: className = '', onchange }: Props = $props();

  function handleChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    value = target.value;
    if (onchange) onchange(value);
  }
</script>

<div class="relative w-full">
  <select
    {disabled}
    value={value}
    onchange={handleChange}
    class="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3.5 py-2 min-h-[44px] appearance-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-8 {className}"
  >
    {#each options as opt}
      <option value={opt.value} class="bg-neutral-900 text-neutral-200">{opt.label}</option>
    {/each}
  </select>
  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500">
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </div>
</div>
