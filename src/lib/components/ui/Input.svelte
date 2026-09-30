<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id?: string;
    value: string;
    placeholder?: string;
    disabled?: boolean;
    type?: 'text' | 'search' | 'email' | 'number' | 'url';
    ariaLabel?: string;
    /** Renders a leading magnifier glyph. */
    icon?: Snippet;
    /** Renders a keyboard hint chip inside the trailing edge (e.g. "⌘K"). */
    shortcut?: string;
    oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
    onclear?: () => void;
    onkeydown?: (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => void;
    class?: string;
  }

  let {
    id,
    value = $bindable(),
    placeholder = '',
    disabled = false,
    type = 'text',
    ariaLabel,
    icon,
    shortcut,
    oninput,
    onclear,
    onkeydown,
    class: className = ''
  }: Props = $props();

  let inputRef: HTMLInputElement | undefined = $state();

  export function focus() {
    inputRef?.focus();
  }

  function handleKeydown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === 'Escape' && value && onclear) {
      e.preventDefault();
      onclear();
      inputRef?.focus();
      return;
    }
    onkeydown?.(e);
  }
</script>

<div class="relative flex items-center w-full">
  {#if icon}
    <span class="absolute left-3 flex items-center pointer-events-none text-neutral-500">
      {@render icon()}
    </span>
  {/if}

  <input
    bind:this={inputRef}
    {id}
    {type}
    {disabled}
    {placeholder}
    bind:value
    aria-label={ariaLabel}
    aria-keyshortcuts={shortcut ? shortcut.replace(/\s/g, '') : undefined}
    {oninput}
    onkeydown={handleKeydown}
    class="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-lg py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[44px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed {icon ? 'pl-9' : 'pl-3.5'} {(onclear || shortcut) ? 'pr-16' : 'pr-3.5'} {className}"
  />

  {#if shortcut && !value}
    <kbd
      class="absolute right-3 hidden sm:inline-flex items-center rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 pointer-events-none"
      aria-hidden="true"
    >
      {shortcut}
    </kbd>
  {/if}

  {#if value && onclear}
    <button
      type="button"
      onclick={onclear}
      class="absolute right-1 flex items-center justify-center text-neutral-500 hover:text-neutral-200 rounded min-w-[44px] min-h-[44px] transition-colors"
      aria-label="Clear text input"
      title="Clear"
    >
      ✕
    </button>
  {/if}
</div>
