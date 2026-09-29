<script lang="ts">
  interface Props {
    value: string;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
    oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
    onclear?: () => void;
    class?: string;
  }

  let {
    value = $bindable(),
    placeholder = '',
    disabled = false,
    type = 'text',
    oninput,
    onclear,
    class: className = ''
  }: Props = $props();
</script>

<div class="relative flex items-center w-full">
  <input
    {type}
    {disabled}
    {placeholder}
    bind:value
    {oninput}
    class="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-lg px-3.5 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[44px] transition-colors {className}"
  />
  {#if value && onclear}
    <button
      type="button"
      onclick={onclear}
      class="absolute right-2.5 text-neutral-500 hover:text-neutral-300 p-1 min-w-[32px] min-h-[32px] flex items-center justify-center text-xs"
      aria-label="Clear text input"
    >
      ✕
    </button>
  {/if}
</div>
