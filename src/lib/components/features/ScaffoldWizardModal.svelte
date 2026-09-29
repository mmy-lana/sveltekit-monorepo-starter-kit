<script lang="ts">
  import type { PackageType } from '$lib/types';
  import { monorepoStore } from '$lib/stores/monorepo.svelte';
  import { generateScaffoldPackage, validatePackageName, validateSemVer } from '$lib/utils/scaffold';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';

  interface Props {
    isOpen: boolean;
    onclose: () => void;
  }

  let { isOpen, onclose }: Props = $props();

  let name = $state('');
  let type = $state<PackageType>('app');
  let description = $state('');
  let version = $state('0.1.0');
  let errorMessage = $state<string | null>(null);

  const typeOptions = [
    { label: 'Application (apps/*)', value: 'app' },
    { label: 'Component Library (packages/*)', value: 'lib' },
    { label: 'TypeScript Utilities (packages/*)', value: 'tool' },
    { label: 'Shared Configuration (packages/*)', value: 'config' }
  ];

  function handleSubmit() {
    errorMessage = null;
    const nameCheck = validatePackageName(name);
    if (!nameCheck.valid) {
      errorMessage = nameCheck.error || 'Invalid name';
      return;
    }

    const semverCheck = validateSemVer(version);
    if (!semverCheck.valid) {
      errorMessage = semverCheck.error || 'Invalid version';
      return;
    }

    const pkg = generateScaffoldPackage(name, type, description, version);
    monorepoStore.addPackage(pkg);
    name = '';
    description = '';
    onclose();
  }
</script>

<Modal id="scaffold-wizard" title="Scaffold Workspace Package" {isOpen} {onclose}>
  <div class="space-y-4">
    <div>
      <label class="block text-xs font-mono text-neutral-400 mb-1.5" for="pkg-name">Package Identifier</label>
      <Input id="pkg-name" bind:value={name} placeholder="@workspace/shared-ui" />
      <span class="text-[10px] text-neutral-500 mt-1 block">Must follow scoped or lowercase kebab-case standard</span>
    </div>

    <div>
      <label class="block text-xs font-mono text-neutral-400 mb-1.5" for="pkg-type">Workspace Category</label>
      <Select
        id="pkg-type"
        options={typeOptions}
        bind:value={type}
        onchange={(val) => (type = val as PackageType)}
      />
    </div>

    <div>
      <label class="block text-xs font-mono text-neutral-400 mb-1.5" for="pkg-version">Initial Version</label>
      <Input id="pkg-version" bind:value={version} placeholder="0.1.0" />
    </div>

    <div>
      <label class="block text-xs font-mono text-neutral-400 mb-1.5" for="pkg-desc">Description</label>
      <Input id="pkg-desc" bind:value={description} placeholder="Telemetry dashboard module" />
    </div>

    {#if errorMessage}
      <div class="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
        {errorMessage}
      </div>
    {/if}

    <div class="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
      <Button variant="ghost" size="md" onclick={onclose}>Cancel</Button>
      <Button variant="primary" size="md" onclick={handleSubmit}>Generate Package</Button>
    </div>
  </div>
</Modal>
