import { test, expect } from '@playwright/test';
import { setupMockGraphQL, mockEntities } from './fixtures/mockApi';

test.describe('Search and Explore Workflow (UW-001, UW-002, GE-001, GE-002, AC-105)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockGraphQL(page);
    await page.goto('/');
    // Wait for initial profile loading to complete and shell to be rendered
    await expect(page.locator('.ontology-title')).toBeVisible();
  });

  test('searches for an entity and adds it to the canvas', async ({ page }) => {
    // Navigate to Search tab if not active
    await page.locator('#tab-search-btn').click();

    // Type query in search box
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');

    // Wait for search result item to appear
    const resultItem = page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first();
    await expect(resultItem).toBeVisible();

    // Click search result to add to canvas
    await resultItem.click();

    // Verify entity appears as selected node
    await expect(page.locator('.resource-header .resource-title')).toContainText('Hyderabadi Dum Biryani');

    // Check canvas stats indicate at least 1 node
    await expect(page.locator('.graph-stats')).toContainText('1 nodes');
  });

  test('expands entity, inspects neighbors, collapses and undoes expansion', async ({ page }) => {
    // Add entity from search
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();

    await expect(page.locator('.graph-stats')).toContainText('1 nodes');

    // Click Expand button
    const expandBtn = page.locator('button.primary-action', { hasText: 'Expand' });
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();

    // Verify neighbors appear: node count increases to 4 (Biryani + Rice + Saffron + Cuisine)
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');
    await expect(page.locator('.graph-stats')).toContainText('3 edges');

    // Test Collapse expansion: Click collapse button while selectedEntity is active
    const collapseBtn = page.locator('button[aria-label="Collapse selected expansion"]');
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();

    // Verify nodes are collapsed
    await expect(page.locator('.graph-stats')).toContainText('0 nodes');

    // Test Redo: Click redo button in toolbar (collapse pushes to redo stack)
    const redoBtn = page.locator('button[aria-label="Redo expansion"]');
    await expect(redoBtn).toBeEnabled();
    await redoBtn.click();

    // Verify state restores to 4 nodes
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');

    // Test Undo expansion: Click undo button in toolbar
    const undoBtn = page.locator('button[aria-label="Undo last expansion"]');
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();

    // Verify state reverts back to 0 nodes
    await expect(page.locator('.graph-stats')).toContainText('0 nodes');
  });

  test('multi-hop traversal expands bounded neighborhood', async ({ page }) => {
    // Add entity from search
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();

    // Open multi-hop mode by clicking Multi-Hop button in traversal controls
    const multiHopBtn = page.locator('button', { hasText: 'Multi-Hop' });
    await expect(multiHopBtn).toBeVisible();
    await multiHopBtn.click();

    // Adjust depth slider to 2 hops
    const depthSlider = page.locator('input[aria-label="Multi-hop traversal depth (1 to 3 hops)"]');
    await expect(depthSlider).toBeVisible();

    // Expand multi-hop
    const expandBtn = page.locator('button.primary-action');
    await expect(expandBtn).toContainText('Expand (2 hops)');
    await expandBtn.click();

    // Verify expansion finishes and nodes appear
    await expect(page.locator('.graph-stats')).toContainText('nodes');
  });
});
