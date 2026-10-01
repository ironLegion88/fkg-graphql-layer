import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockGraphQL } from './fixtures/mockApi';

test.describe('Accessibility Audits & Standards (AX-001 - AX-008, TC-010, AC-113)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();
  });

  test('runs axe-core audit on initial app state with zero critical violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    const criticalViolations = results.violations.filter((v) => v.impact === 'critical');
    expect(criticalViolations).toEqual([]);
  });

  test('runs axe-core audit after searching and expanding graph with zero critical violations', async ({ page }) => {
    // Search and expand Biryani
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');

    const results = await new AxeBuilder({ page }).analyze();
    const criticalViolations = results.violations.filter((v) => v.impact === 'critical');
    expect(criticalViolations).toEqual([]);
  });

  test('runs axe-core audit on semantic inspector panels with zero critical violations', async ({ page }) => {
    // 1. Inspect Class panel
    await page.locator('#tab-classes-btn').click();
    const classBtn = page.locator('.tree-label-btn').filter({ hasText: 'Recipe' });
    await expect(classBtn).toBeVisible();
    await classBtn.click();
    await page.locator('#tab-class').click();
    await expect(page.locator('[data-testid="class-inspector"]')).toBeVisible();

    let results = await new AxeBuilder({ page }).analyze();
    let criticalViolations = results.violations.filter((v) => v.impact === 'critical');
    expect(criticalViolations).toEqual([]);

    // 2. Inspect Consistency panel
    await page.locator('#tab-consistency').click();
    await expect(page.locator('[data-testid="consistency-panel"]')).toBeVisible();

    results = await new AxeBuilder({ page }).analyze();
    criticalViolations = results.violations.filter((v) => v.impact === 'critical');
    expect(criticalViolations).toEqual([]);
  });
});

