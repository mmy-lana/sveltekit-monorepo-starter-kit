<script lang="ts">
  interface Option {
    label: string;
    value: string;
  }

  interface Props {
    id?: string;
    ariaLabel?: string;
    options: Option[];
    /** Single mode binds a string; multi mode binds a string[]. */
    value?: string | string[];
    multiple?: boolean;
    disabled?: boolean;
    class?: string;
    onchange?: (val: string | string[]) => void;
  }

  let {
    id,
    ariaLabel,
    options,
    value = $bindable(),
    multiple = false,
    disabled = false,
    class: className = '',
    onchange
  }: Props = $props();

  let selectedSet = $derived(new Set(multiple ? (value as string[]) : []));

  function emit(next: string | string[]) {
    value = next;
    onchange?.(next);
  }

  function handleChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;

    if (multiple) {
      emit(Array.from(target.selectedOptions, (option) => option.value));
      return;
    }
    emit(target.value);
  }
</script>

<div class="relative w-full">
  <select
    {id}
    {disabled}
    {multiple}
    value={multiple ? undefined : (value as string)}
    aria-label={ariaLabel}
    onchange={handleChange}
    class="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3.5 py-2 min-h-[44px] appearance-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-8 disabled:opacity-50 disabled:cursor-not-allowed {multiple ? 'h-auto min-h-[112px]' : ''} {className}"
  >
    {#each options as opt (opt.value)}
      <option
        value={opt.value}
        class="bg-neutral-900 text-neutral-200"
        selected={multiple ? selectedSet.has(opt.value) : undefined}
      >
        {opt.label}
      </option>
    {/each}
  </select>

  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500">
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </div>
</div>
