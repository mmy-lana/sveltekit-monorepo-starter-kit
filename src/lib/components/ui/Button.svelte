<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit' | 'reset';
    ariaLabel?: string;
    title?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    class?: string;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    type = 'button',
    ariaLabel,
    title,
    onclick,
    children,
    class: className = ''
  }: Props = $props();

  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white border-transparent',
    secondary: 'bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 text-neutral-200 border-neutral-700',
    outline: 'bg-transparent hover:bg-neutral-800 text-neutral-300 border-neutral-700',
    ghost: 'bg-transparent hover:bg-neutral-800/60 text-neutral-400 hover:text-neutral-100 border-transparent',
    danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-300 border-red-500/40 active:bg-red-600/40'
  };

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 min-h-[36px] min-w-[36px]',
    md: 'text-sm px-3.5 py-2 min-h-[44px] min-w-[44px]',
    lg: 'text-base px-5 py-2.5 min-h-[48px] min-w-[48px]'
  };
</script>

<button
  {type}
  disabled={disabled || loading}
  aria-label={ariaLabel}
  {title}
  aria-busy={loading}
  {onclick}
  class="inline-flex items-center justify-center font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed select-none {variantStyles[variant]} {sizeStyles[size]} {className}"
>
  {#if loading}
    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</button>
