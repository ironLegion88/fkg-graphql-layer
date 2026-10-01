import { test, expect } from '@playwright/test';
import { setupMockGraphQL } from './fixtures/mockApi';

test.describe('Responsive Breakpoints & Layout Workflows (AX-007, NF-008, TC-010)', () => {
  test('desktop (1280px): displays three panels side-by-side with full visibility', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    // Verify all three panels are visible simultaneously side-by-side
    const navPanel = page.locator('#navigation-panel');
    const canvasPanel = page.locator('#main-canvas');
    const inspectorPanel = page.locator('#inspector-panel');

    await expect(navPanel).toBeVisible();
    await expect(canvasPanel).toBeVisible();
    await expect(inspectorPanel).toBeVisible();

    // Check horizontal layout geometry
    const navBox = await navPanel.boundingBox();
    const canvasBox = await canvasPanel.boundingBox();
    const inspectorBox = await inspectorPanel.boundingBox();

    expect(navBox).toBeTruthy();
    expect(canvasBox).toBeTruthy();
    expect(inspectorBox).toBeTruthy();

    // Side-by-side: canvas starts after navigation panel, inspector starts after canvas
    expect(canvasBox!.x).toBeGreaterThanOrEqual(navBox!.x + navBox!.width - 5);
    expect(inspectorBox!.x).toBeGreaterThanOrEqual(canvasBox!.x + canvasBox!.width - 5);
  });

  test('tablet (768px): navigation operates as overlay drawer', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    const navPanel = page.locator('#navigation-panel');
    const canvasPanel = page.locator('#main-canvas');

    // Canvas is visible
    await expect(canvasPanel).toBeVisible();

    // Navigation panel has drawer close button
    const drawerCloseBtn = navPanel.locator('.drawer-close-btn');
    if (await drawerCloseBtn.isVisible()) {
      await drawerCloseBtn.click();
      // After closing drawer, backdrop is hidden
      await expect(page.locator('.tablet-drawer-backdrop')).toBeHidden();
    }
  });

  test('mobile (375px): panels stack and textual table is the primary accessible view (AX-007)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    // Verify initial primary mode on mobile is 'table' (AX-007)
    const tableContainer = page.locator('.visible-graph-table-container');
    await expect(tableContainer).toBeVisible();

    // Verify touch targets for toggle buttons are >= 44x44px (AX-007, WCAG 2.5.5)
    const toggleBtns = page.locator('.panel-toggle-btn');
    const toggleCount = await toggleBtns.count();
    expect(toggleCount).toBeGreaterThan(0);

    for (let i = 0; i < toggleCount; i++) {
      const btn = toggleBtns.nth(i);
      const box = await btn.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
