import type { PackageType, SemVerValidationRule, WorkspacePackage } from '$lib/types';

export const semverRule: SemVerValidationRule = {
  pattern: '^([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-[0-9A-Za-z.-]+)?$',
  allowPrerelease: true
};

/** Segments that must never appear in a workspace name or slug. */
const TRAVERSAL_SEGMENTS = ['..', '.', '~', '%2e%2e', '%2e'];

function containsTraversalSegment(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower.includes('..') || lower.includes('%2e')) return true;
  return value.split(/[/\\]/).some((segment) => TRAVERSAL_SEGMENTS.includes(segment));
}

export function validatePackageName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: 'Package name cannot be empty.' };
  }

  if (trimmed !== name) {
    return { valid: false, error: 'Package name cannot begin or end with whitespace.' };
  }

  if (containsTraversalSegment(trimmed)) {
    return {
      valid: false,
      error: 'Package name cannot contain relative path segments (".", "..", "~").'
    };
  }

  if (/[/\\]/.test(trimmed)) {
    const segments = trimmed.split('/');
    if (segments.length !== 2) {
      return {
        valid: false,
        error: 'Scoped names must use exactly one "/" (e.g. @workspace/shared-ui).'
      };
    }
    const [scope, local] = segments;
    if (!scope.startsWith('@') || scope.length < 2) {
      return { valid: false, error: 'A scope must start with "@" (e.g. @workspace/name).' };
    }
    if (!local) {
      return { valid: false, error: 'A scoped name must include a package after the scope.' };
    }
  }

  if (trimmed.endsWith('/')) {
    return { valid: false, error: 'Package name cannot end with a trailing slash.' };
  }

  if (trimmed.startsWith('/')) {
    return { valid: false, error: 'Package name cannot be an absolute path.' };
  }

  const scopeKebabRegex = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  if (!scopeKebabRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Name must be lowercase kebab-case (e.g. @workspace/shared-ui or my-app).'
    };
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
  const rawSlug = name.replace(/^@[^/]+\//, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  // Defence in depth: the slug is interpolated into a workspace path, so it is
  // collapsed to a single safe path segment even if the caller skipped
  // `validatePackageName`.
  const cleanSlug = rawSlug.replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
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
