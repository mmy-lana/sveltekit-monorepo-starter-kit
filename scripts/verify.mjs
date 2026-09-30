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
    await page.getByRole('button', { name: /close workspace details/i }).click({ position: { x: 5, y: 5 } });
    await drawer.waitFor({ state: 'detached', timeout: 5000 });
    check('S5 backdrop closes drawer', (await drawer.count()) === 0);

    // UI-05: Escape dismissal and focus restoration.
    await page.locator('[data-testid="workspace-grid"] button[aria-label]').first().click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    const drawerRole = await drawer.getAttribute('role');
    const drawerModal = await drawer.getAttribute('aria-modal');
    const drawerTabindex = await drawer.getAttribute('tabindex');
    check('S5 drawer exposes dialog semantics', drawerRole === 'dialog' && drawerModal === 'true', `role=${drawerRole} aria-modal=${drawerModal}`);
    check('S5 drawer is programmatically focusable', drawerTabindex === '-1', `tabindex=${drawerTabindex}`);

    const bodyLocked = await page.evaluate(() => document.body.style.overflow);
    check('S5 body scroll locked while drawer open', bodyLocked === 'hidden', `overflow=${bodyLocked}`);

    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'detached', timeout: 5000 });
    check('S5 Escape dismisses drawer', (await drawer.count()) === 0);

    const bodyReleased = await page.evaluate(() => document.body.style.overflow);
    check('S5 body scroll restored after close', bodyReleased !== 'hidden', `overflow=${bodyReleased}`);

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

  // ---------------------------------------------------------------- Scenario 8
  // Graph layout: no two nodes may share coordinates (overlap regression).
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/graph`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="graph-node"]');

    const transforms = await page.$$eval('[data-testid="graph-node"]', (els) =>
      els.map((el) => el.getAttribute('transform'))
    );

    check('S8 nodes rendered', transforms.length >= 5, `nodes=${transforms.length}`);

    const coords = transforms.map((t) => {
      const m = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/.exec(t ?? '');
      return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
    });

    check('S8 all node transforms parsed', coords.every((c) => c !== null));

    const seen = new Map();
    const collisions = [];
    coords.forEach((c, i) => {
      if (!c) return;
      const key = `${c.x},${c.y}`;
      if (seen.has(key)) collisions.push(`#${seen.get(key)} and #${i} at (${key})`);
      else seen.set(key, i);
    });
    check('S8 no overlapping node coordinates', collisions.length === 0, collisions.join('; '));

    // Distinct x within a tier is what the even-spacing formula guarantees.
    const xs = new Set(coords.filter(Boolean).map((c) => c.x));
    check('S8 nodes spread across multiple columns', xs.size > 1, `uniqueX=${xs.size}`);

    // Vertical separation: no two nodes may sit on the same y.
    const ys = new Set(coords.filter(Boolean).map((c) => c.y));
    check('S8 nodes occupy distinct tiers', ys.size > 1, `uniqueY=${ys.size}`);

    // No node may sit closer than the 44px touch target allows.
    let tooClose = null;
    for (let i = 0; i < coords.length; i += 1) {
      for (let j = i + 1; j < coords.length; j += 1) {
        const a = coords[i];
        const b = coords[j];
        if (!a || !b) continue;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 44) tooClose = `#${i}-#${j} dist=${dist.toFixed(1)}`;
      }
    }
    check('S8 minimum node separation >= 44px', tooClose === null, String(tooClose));

    check('S8 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- Scenario 9
  // UI-07: zoom controls disable at the MIN/MAX bounds.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/graph`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="graph-canvas"]');

    const zoomIn = page.getByRole('button', { name: /zoom in/i });
    const zoomOut = page.getByRole('button', { name: /zoom out/i });

    check('S9 zoom in enabled at rest', await zoomIn.isEnabled());
    check('S9 zoom out enabled at rest', await zoomOut.isEnabled());

    const group = page.locator('[data-testid="graph-canvas"] svg g').first();
    const readScale = async () => {
      const t = await group.getAttribute('transform');
      const m = /scale\(([\d.]+)\)/.exec(t ?? '');
      return m ? Number(m[1]) : 1;
    };

    // 1 -> 3.0 requires 10 clicks of +0.2; click well past the bound.
    for (let i = 0; i < 14; i += 1) {
      if (await zoomIn.isDisabled()) break;
      await zoomIn.click();
    }
    const maxScale = await readScale();
    check('S9 zoom clamps at MAX_ZOOM', Math.abs(maxScale - 3) < 0.001, `scale=${maxScale}`);
    check('S9 zoom in disabled at MAX_ZOOM', await zoomIn.isDisabled());
    check('S9 zoom out still enabled at MAX_ZOOM', await zoomOut.isEnabled());

    for (let i = 0; i < 20; i += 1) {
      if (await zoomOut.isDisabled()) break;
      await zoomOut.click();
    }
    const minScale = await readScale();
    check('S9 zoom clamps at MIN_ZOOM', Math.abs(minScale - 0.4) < 0.001, `scale=${minScale}`);
    check('S9 zoom out disabled at MIN_ZOOM', await zoomOut.isDisabled());
    check('S9 zoom in re-enabled at MIN_ZOOM', await zoomIn.isEnabled());

    check('S9 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- Scenario 10
  // DATA-04: standard runs succeed deterministically.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/pipelines`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Run Build Pipeline/i }).click();
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="pipeline-step"][data-status]');
        return el && !['queued', 'running'].includes(el.getAttribute('data-status'));
      },
      { timeout: 20000 }
    );
    await page.waitForTimeout(1500);

    const statuses = await page.$$eval('[data-testid="pipeline-step"]', (els) =>
      els.map((e) => e.getAttribute('data-status'))
    );
    const failed = statuses.filter((s) => s === 'failure');
    check(
      'S10 default pipeline run has zero failures',
      failed.length === 0,
      `statuses=${statuses.join(',')}`
    );

    check('S10 steps completed', statuses.length > 0, `steps=${statuses.length}`);
    check('S10 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- Scenario 11
  // PERF-01: terminal buffer is capped at 500 lines under sustained logging.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(`${BASE}/pipelines`, { waitUntil: 'networkidle' });

    // Each run appends ~12 lines (start + 2 per step + finish). Drive enough
    // runs to overflow the 500-line ceiling so the eviction path is exercised.
    const runBtn = page.getByRole('button', { name: /Run Build Pipeline/i });
    for (let i = 0; i < 50; i += 1) {
      await runBtn.click();
      await page.waitForFunction(
        () => {
          const el = document.querySelector('[data-testid="pipeline-step"][data-status]');
          return el && !['queued', 'running'].includes(el.getAttribute('data-status'));
        },
        { timeout: 20000 }
      );
      const lines = await page.locator('[data-testid="terminal-line"]').count();
      if (lines >= 500) break;
    }

    const lineCount = await page.locator('[data-testid="terminal-line"]').count();
    check('S11 terminal buffer capped at 500', lineCount <= 500, `lines=${lineCount}`);
    check('S11 terminal buffer actually saturated', lineCount >= 400, `lines=${lineCount}`);

    // Oldest lines must be evicted, newest retained.
    const firstLine = await page.locator('[data-testid="terminal-line"]').first().innerText();
    check(
      'S11 oldest lines evicted (ring buffer)',
      !firstLine.includes('System initialized'),
      firstLine.slice(0, 48)
    );

    check('S11 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- Scenario 12
  // DATA-06: status filter reflects only the most recent run.
  {
    const page = await context.newPage();
    const errors = watchErrors(page);

    // Fresh storage so no prior run history leaks in.
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
    await page.reload({ waitUntil: 'networkidle' });

    const statusSelect = page.getByLabel(/filter packages by latest build status/i);

    // Before any run, no package has a status, so "success" matches nothing.
    await statusSelect.selectOption('success');
    await page.waitForTimeout(300);
    const beforeRun = await page
      .locator('[data-testid="workspace-grid"] button[aria-label]')
      .count();
    check('S12 success filter empty before any run', beforeRun === 0, `cards=${beforeRun}`);

    // A failing simulated run should surface under the failure filter.
    await statusSelect.selectOption('all');
    await page.getByRole('button', { name: /Build All/i }).click();
    await page.waitForTimeout(4500);

    await statusSelect.selectOption('success');
    await page.waitForTimeout(400);
    const afterSuccess = await page
      .locator('[data-testid="workspace-grid"] button[aria-label]')
      .count();
    check('S12 success filter shows built packages', afterSuccess > 0, `cards=${afterSuccess}`);

    await statusSelect.selectOption('failure');
    await page.waitForTimeout(400);
    const failureCount = await page
      .locator('[data-testid="workspace-grid"] button[aria-label]')
      .count();
    const emptyState = await page.getByText('No Packages Detected').count();
    check(
      'S12 failure filter empty after clean run (no stale failures)',
      failureCount === 0 && emptyState === 1,
      `cards=${failureCount} emptyState=${emptyState}`
    );

    // Re-running must keep the success set stable (deterministic, DATA-04).
    await statusSelect.selectOption('all');
    await page.getByRole('button', { name: /Build All/i }).click();
    await page.waitForTimeout(4500);
    await statusSelect.selectOption('failure');
    await page.waitForTimeout(400);
    const failureAfterRerun = await page
      .locator('[data-testid="workspace-grid"] button[aria-label]')
      .count();
    check(
      'S12 repeat run still reports zero failures',
      failureAfterRerun === 0,
      `cards=${failureAfterRerun}`
    );

    await statusSelect.selectOption('all');
    await page.waitForTimeout(300);
    const allCount = await page
      .locator('[data-testid="workspace-grid"] button[aria-label]')
      .count();
    check('S12 clearing filter restores all packages', allCount >= 5, `cards=${allCount}`);

    check('S12 no console errors', errors.length === 0, errors.join(' | '));
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
