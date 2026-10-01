import { test, expect } from '@playwright/test';
import { setupMockGraphQL } from './fixtures/mockApi';

test.describe('Performance Benchmarks on Indian Food Ontology (NF-001, NF-003, NF-004, TC-011)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockGraphQL(page);
  });

  test('NF-001: initial empty state renders in under 1000ms', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();
    await expect(page.locator('.explorer-shell')).toBeVisible();
    const duration = Date.now() - start;

    console.log(`[PERF BENCHMARK] Initial render latency: ${duration}ms (target < 1000ms)`);
    expect(duration).toBeLessThan(1000);
  });

  test('NF-003: entity search response in under 500ms', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    const searchInput = page.locator('input[type="search"]');
    const start = Date.now();
    await searchInput.fill('Recipe');
    await expect(page.locator('.entity-result-item').first()).toBeVisible();
    const duration = Date.now() - start;

    console.log(`[PERF BENCHMARK] Search response latency: ${duration}ms (target < 500ms)`);
    expect(duration).toBeLessThan(500);
  });

  test('measures 1-hop entity expansion in under 1000ms', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await expect(page.locator('.entity-result-item').first()).toBeVisible();

    const start = Date.now();
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');
    const duration = Date.now() - start;

    console.log(`[PERF BENCHMARK] 1-hop expansion latency: ${duration}ms (target < 1000ms)`);
    expect(duration).toBeLessThan(1000);
  });

  test('NF-004: cosmos.gl overview rendering latency in under 2000ms', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    const start = Date.now();
    await page.locator('[data-testid="view-mode-overview-btn"]').click();
    await expect(page.locator('[data-testid="cosmos-overview"]')).toBeVisible();
    await expect(page.locator('.cluster-pill').first()).toBeVisible();
    const duration = Date.now() - start;

    console.log(`[PERF BENCHMARK] Overview rendering latency: ${duration}ms (target < 2000ms)`);
    expect(duration).toBeLessThan(2000);
  });

  test('verifies canvas remains responsive within rendering budget', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    // Add entity
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');

    // Run layout switch and measure execution time
    const start = Date.now();
    await page.locator('#layout-select').selectOption('circle');
    const layoutDuration = Date.now() - start;

    console.log(`[PERF BENCHMARK] Circle layout switch duration: ${layoutDuration}ms`);
    expect(layoutDuration).toBeLessThan(500);

    // Verify canvas is fully responsive
    await expect(page.locator('#main-canvas')).toBeVisible();
  });
});
