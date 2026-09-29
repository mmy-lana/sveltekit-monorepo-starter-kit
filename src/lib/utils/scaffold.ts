import type { PackageType, SemVerValidationRule, WorkspacePackage } from '$lib/types';

export const semverRule: SemVerValidationRule = {
  pattern: '^([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-[0-9A-Za-z.-]+)?$',
  allowPrerelease: true
};

export function validatePackageName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Package name cannot be empty.' };
  }
  const scopeKebabRegex = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  if (!scopeKebabRegex.test(trimmed)) {
    return { valid: false, error: 'Name must be lowercase kebab-case (e.g. @workspace/shared-ui or my-app).' };
  }
  return { valid: true };
}

export function validateSemVer(version: string): { valid: boolean; error?: string } {
  const regex = new RegExp(semverRule.pattern);
  if (!regex.test(version.trim())) {
    return { valid: false, error: 'Version must strictly follow SemVer formatting (e.g. 0.1.0 or 1.0.0-beta.1).' };
  }
  return { valid: true };
}

export function generateScaffoldPackage(
  name: string,
  type: PackageType,
  description: string,
  version: string = '0.0.1'
): WorkspacePackage {
  const cleanSlug = name.replace(/^@[^/]+\//, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const folder = type === 'app' ? 'apps' : 'packages';
  const timestamp = new Date().toISOString();

  return {
    id: `pkg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    slug: cleanSlug,
    version,
    type,
    path: `${folder}/${cleanSlug}`,
    description: description || `Monorepo ${type} workspace for ${name}`,
    dependencies: [],
    scripts: [
      { id: 'scr-build', name: 'build', command: 'vite build' },
      { id: 'scr-test', name: 'test', command: 'vitest run' },
      { id: 'scr-lint', name: 'lint', command: 'eslint .' }
    ],
    tags: [type, 'vite'],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
