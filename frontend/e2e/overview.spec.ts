import { test, expect } from '@playwright/test';
import { setupMockGraphQL } from './fixtures/mockApi';

test.describe('Overview & Drill-Down Workflow (AC-110, AC-111, RC-003, RC-005, TC-008)', () => {
  test('switches to overview mode, displays class clusters, and drills down to detail view', async ({ page }) => {
    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    // 1. Switch to Overview mode
    const overviewBtn = page.locator('[data-testid="view-mode-overview-btn"]');
    await expect(overviewBtn).toBeVisible();
    await overviewBtn.click();

    // 2. Verify Overview container renders
    const overviewContainer = page.locator('[data-testid="cosmos-overview"]');
    await expect(overviewContainer).toBeVisible();

    // Verify cluster footer pills render with ontology classes
    const recipePill = page.locator('button.cluster-pill').filter({ hasText: 'Recipe' });
    await expect(recipePill).toBeVisible();
    await expect(recipePill.locator('.pill-count')).toContainText('500');

    // 3. Select the Recipe cluster
    await recipePill.click();

    // Verify selection card appears
    const selectionCard = page.locator('[data-testid="cosmos-selected-cluster"]');
    await expect(selectionCard).toBeVisible();
    await expect(selectionCard.locator('.selection-title')).toContainText('Recipe');
    await expect(selectionCard.locator('.stat-val').first()).toContainText('500');

    // 4. Click Drill down to Detail
    const drilldownBtn = page.locator('[data-testid="drilldown-button"]');
    await expect(drilldownBtn).toBeVisible();
    await drilldownBtn.click();

    // 5. Verify transition back to Cytoscape detail canvas with drill-down breadcrumb
    const backBtn = page.locator('[data-testid="back-to-overview-btn"]');
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toContainText('Back to Overview');

    // Verify entity was loaded into the detail canvas
    await expect(page.locator('.graph-stats')).toContainText('nodes');

    // 6. Navigate back to Overview
    await backBtn.click();
    await expect(overviewContainer).toBeVisible();
  });

  test('falls back gracefully to table view when WebGL 2 is unavailable (AC-111)', async ({ page }) => {
    // Override canvas getContext to simulate lack of WebGL 2 hardware support
    await page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (contextType: string, ...args: unknown[]) {
        if (contextType === 'webgl2') {
          return null;
        }
        return (originalGetContext as (...args: unknown[]) => unknown).apply(this, [contextType, ...args]);
      };
    });

    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    // When WebGL 2 is unavailable, Overview button is hidden from view mode selector
    const overviewBtn = page.locator('[data-testid="view-mode-overview-btn"]');
    await expect(overviewBtn).toBeHidden();

    // Table mode button remains accessible and functional
    const tableBtn = page.locator('.view-mode-btn').filter({ hasText: 'Table' });
    await expect(tableBtn).toBeVisible();
    await tableBtn.click();

    // Verify table view is active
    await expect(page.locator('.visible-graph-table-container')).toBeVisible();
  });
});
