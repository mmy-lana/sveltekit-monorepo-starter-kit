/**
 * Headless smoke + integration suite.
 *
 * Launches Playwright's bundled Chromium in strict headless mode. This never
 * touches, attaches to, or closes any host desktop browser.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const STORAGE_KEY = 'sveltekit_monorepo_platform_v1';

const results = [];
let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

/** Collects console errors + page errors per scenario. */
function watchErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

try {
  // ---------------------------------------------------------------- Scenario 1
  // Route "/" loads and renders seeded package cards.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    const brand = page.getByRole('link', { name: /MONOREPO:\/\/HUD/i });
    check('S1 dashboard renders HUD brand', (await brand.count()) > 0);

    // A restored/seeded active workspace must not auto-open the inspector.
    const drawerOnLoad = await page.locator('[data-testid="workspace-drawer"]').count();
    check('S1 inspector drawer closed on load', drawerOnLoad === 0);

    // Seed ships 5 workspaces.
    const cardCount = await page.locator('[data-testid="workspace-grid"] button[aria-label]').count();
    check('S1 dashboard renders package cards', cardCount >= 5, `cards=${cardCount}`);

    const emptyState = await page.getByText('No Packages Detected').count();
    check('S1 empty state absent when seeded', emptyState === 0);

    const firstCard = page.locator('[data-testid="workspace-grid"] button[aria-label]').first();
    const cardText = (await firstCard.innerText()).toLowerCase();
    check('S1 card shows a workspace name', cardText.includes('@workspace'), cardText.split('\n')[0]);

    check('S1 no console errors on load', errors.length === 0, errors.join(' | '));

    await page.close();
  }

  // ---------------------------------------------------------------- Scenario 2
  // Quickstart guide opens, switches tabs, and closes.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    const guideButton = page.getByRole('button', { name: /quickstart and architecture guide/i });
    check('S2 guide button present in HUD', (await guideButton.count()) > 0);

    await guideButton.click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    check('S2 guide dialog opens', await dialog.isVisible());
    check('S2 dialog is aria-modal', (await dialog.getAttribute('aria-modal')) === 'true');

    const tablist = page.getByRole('tablist');
    check('S2 guide exposes tablist', (await tablist.count()) > 0);

    // Overview content
    check(
      'S2 overview explains the platform',
      (await page.getByText('client-side visual simulation', { exact: false }).count()) > 0
    );

    // Switch to the usage tab
    await page.getByRole('tab', { name: /how to use it/i }).click();
    const usageVisible = await page.getByText('Workspaces view').count();
    check('S2 usage tab renders guidance', usageVisible > 0);

    // Switch to FAQ
    await page.getByRole('tab', { name: /faq/i }).click();
    const faqCount = await page.getByRole('group').count();
    const faqHeading = await page.getByText('Does this create real files on my disk?').count();
    check('S2 FAQ tab renders entries', faqHeading > 0);

    // aria-selected tracks the active tab
    const faqSelected = await page
      .getByRole('tab', { name: /faq/i })
      .getAttribute('aria-selected');
    check('S2 active tab marked aria-selected', faqSelected === 'true');

    // Escape must close the dialog (modal keyboard contract)
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached', timeout: 5000 });
    check('S2 Escape closes guide', (await page.getByRole('dialog').count()) === 0);

    // Reopen and close via the close button
    await guideButton.click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /close dialog/i }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 });
    check('S2 close button closes guide', (await page.getByRole('dialog').count()) === 0);

    check('S2 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- Scenario 3
  // Add a package, then run a build, with no console errors.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    const before = await page.locator('[data-testid="workspace-grid"] button[aria-label]').count();

    await page.getByRole('button', { name: /\+ New Package/i }).click();
    const wizard = page.getByRole('dialog');
    await wizard.waitFor({ state: 'visible' });

    await page.getByLabel('Package Identifier').fill('@workspace/verified-widget');
    await page.getByLabel('Initial Version').fill('0.1.0');
    await page.getByLabel('Description').fill('Created by the headless verification suite');

    await page.getByRole('button', { name: /Generate Package/i }).click();
    await wizard.waitFor({ state: 'detached', timeout: 5000 });

    const after = await page.locator('[data-testid="workspace-grid"] button[aria-label]').count();
    check('S3 package added to grid', after === before + 1, `before=${before} after=${after}`);

    const added = await page.getByText('@workspace/verified-widget').count();
    check('S3 new package visible in grid', added > 0);

    // Persistence round-trip through localStorage.
    const stored = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);
    check(
      'S3 state persisted to localStorage',
      Array.isArray(stored?.packages) &&
        stored.packages.some((p) => p.name === '@workspace/verified-widget'),
      `packages=${stored?.packages?.length}`
    );
    check('S3 slug uniqueness applied', stored?.packages?.some((p) => p.slug === 'verified-widget'));

    // Run a build pipeline.
    await page.getByRole('button', { name: /Build All/i }).click();
    await page.waitForTimeout(4000);

    await page.goto(`${BASE}/pipelines`, { waitUntil: 'networkidle' });

    const visualizer = await page.getByText('Active Execution Run').count();
    check('S3 pipeline visualizer rendered', visualizer > 0);

    const terminal = await page.getByText('telemetry.stdout').count();
    check('S3 terminal output panel rendered', terminal > 0);

    const logLines = await page.locator('[data-testid="terminal-line"]').count();
    check('S3 terminal contains log output', logLines > 0, `lines=${logLines}`);

    const restored = await page.getByText(/Restored \d+ steps from run/).count();
    check('S3 run history restored into terminal on navigation', restored > 0);

    const stepBadges = await page.locator('[data-testid="pipeline-step"]').count();
    check('S3 pipeline produced steps', stepBadges > 0, `steps=${stepBadges}`);

    // Run history must survive a reload (persistence funnel).
    const runsAfterReload = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw).pipelineRuns ?? []).length : -1;
    }, STORAGE_KEY);
    check('S3 pipeline runs persisted', runsAfterReload > 0, `runs=${runsAfterReload}`);

    check('S3 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- Scenario 4
  // Responsive: 360px viewport must not overflow horizontally.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 360, height: 740 });

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check('S4 no horizontal overflow at 360px', overflow <= 0, `overflow=${overflow}px`);

    await page.goto(`${BASE}/graph`, { waitUntil: 'networkidle' });
    const graphOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check('S4 no horizontal overflow on graph at 360px', graphOverflow <= 0, `overflow=${graphOverflow}px`);

    // Below 640px the graph must fall back to the tree view.
    const treeVisible = await page.locator('[data-testid="graph-tree"]').isVisible();
    check('S4 graph falls back to tree view at 360px', treeVisible);

    await page.goto(`${BASE}/pipelines`, { waitUntil: 'networkidle' });
    const pipelineOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check('S4 no horizontal overflow on pipelines at 360px', pipelineOverflow <= 0, `overflow=${pipelineOverflow}px`);

    check('S4 no console errors at 360px', errors.length === 0, errors.join(' | '));
    await page.close();
  }

    // ---------------------------------------------------------------- Scenario 5
    // Inspector drawer opens on card click and yields to a modal.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    const drawer = page.locator('[data-testid="workspace-drawer"]');
    check('S5 drawer hidden initially', (await drawer.count()) === 0);

    await page.locator('[data-testid="workspace-grid"] button[aria-label]').first().click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    check('S5 drawer opens on card click', await drawer.isVisible());

    const modalCount = await page.getByRole('dialog', { name: /workspace details/i }).count();
    check('S5 drawer is a labelled dialog', modalCount === 1);

    // Backdrop close.
    await page.locator('div[aria-label="Close workspace details"]').click({ position: { x: 5, y: 5 } });
    await drawer.waitFor({ state: 'detached', timeout: 5000 });
    check('S5 backdrop closes drawer', (await drawer.count()) === 0);

    check('S5 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- Scenario 6
  // Graph page renders the interactive canvas at desktop width.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/graph`, { waitUntil: 'networkidle' });

    const canvas = page.locator('[data-testid="graph-canvas"]');
    check('S6 graph canvas rendered at desktop', await canvas.isVisible());

    const nodes = await page.locator('[data-testid="graph-canvas"] g[role="button"]').count();
    check('S6 graph nodes are focusable buttons', nodes >= 5, `nodes=${nodes}`);

    const svgViewBox = await page.locator('[data-testid="graph-canvas"] svg').getAttribute('viewBox');
    check('S6 svg exposes a viewBox', Boolean(svgViewBox), `viewBox=${svgViewBox}`);

    // Zoom control must actually change the rendered transform.
    const group = page.locator('[data-testid="graph-canvas"] svg g').first();
    const before = await group.getAttribute('transform');
    await page.getByRole('button', { name: /zoom in/i }).click();
    const after = await group.getAttribute('transform');
    check('S6 zoom control mutates the view transform', before !== after, `${before} -> ${after}`);

    check('S6 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- Scenario 7
  // SEC-01: a poisoned localStorage payload must be rejected, not trusted.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    const poisoned = {
      version: 1,
      activeWorkspaceId: 'pkg-web',
      packages: [
        {
          id: 'evil',
          name: '../../etc/passwd',
          slug: 'evil',
          version: '1.0.0',
          type: 'app',
          path: 'apps/evil',
          description: 'malicious',
          dependencies: [],
          scripts: [],
          tags: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          __proto__: { polluted: true }
        }
      ],
      pipelineRuns: [],
      scaffoldBlueprints: [],
      persistedFilters: {
        searchQuery: '',
        types: [],
        tags: [],
        statusFilter: 'all'
      },
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    await page.evaluate(
      ([key, payload]) => window.localStorage.setItem(key, payload),
      [STORAGE_KEY, JSON.stringify(poisoned)]
    );

    await page.reload({ waitUntil: 'networkidle' });

    const evilRendered = await page.getByText('../../etc/passwd').count();
    check('S7 poisoned payload rejected, seed restored', evilRendered === 0);

    const cardCount = await page.locator('[data-testid="workspace-grid"] button[aria-label]').count();
    check('S7 seed data restored after poisoning', cardCount >= 5, `cards=${cardCount}`);

    const protoClean = await page.evaluate(() => ({
      polluted: {}.polluted !== undefined,
      objectPolluted: Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')
    }));
    check('S7 Object.prototype not polluted', !protoClean.polluted && !protoClean.objectPolluted);

    check('S7 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- Scenario 8
  // SEC-02: path traversal names are rejected by the scaffold wizard.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const before = await page.locator('[data-testid="workspace-grid"] button[aria-label]').count();

    await page.getByRole('button', { name: /\+ New Package/i }).click();
    const wizard = page.getByRole('dialog');
    await wizard.waitFor({ state: 'visible' });

    const rejected = [
      '../../etc/passwd',
      '..',
      'valid/../../escape',
      '/absolute-path',
      'trailing/slash/'
    ];

    for (const bad of rejected) {
      await page.getByLabel('Package Identifier').fill(bad);
      await page.getByLabel('Initial Version').fill('0.1.0');
      await page.getByRole('button', { name: /Generate Package/i }).click();
      const stillOpen = await wizard.isVisible();
      const message = await page.locator('[data-testid="wizard-error"]').innerText();
      check(`S7 rejects traversal name "${bad}"`, stillOpen, message.slice(0, 70));
    }

    const after = await page.locator('[data-testid="workspace-grid"] button[aria-label]').count();
    check('S7 no package created from rejected names', after === before, `before=${before} after=${after}`);

    // A legitimate name must still succeed.
    await page.getByLabel('Package Identifier').fill('@workspace/legit-pkg');
    await page.getByRole('button', { name: /Generate Package/i }).click();
    await wizard.waitFor({ state: 'detached', timeout: 5000 });
    check('S7 valid name still accepted', (await page.getByText('@workspace/legit-pkg').count()) > 0);

    check('S7 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }
} finally {
  await context.close();
  await browser.close();
}

console.log('\n----------------------------------------');
console.log(`TOTAL: ${results.length}  PASSED: ${results.length - failures}  FAILED: ${failures}`);
console.log('----------------------------------------');

if (failures > 0) {
  console.error('\nFailing checks:');
  for (const r of results.filter((r) => !r.ok)) {
    console.error(`  - ${r.name}${r.detail ? ` :: ${r.detail}` : ''}`);
  }
  process.exit(1);
}
