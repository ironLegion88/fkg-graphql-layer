import { test, expect } from '@playwright/test';
import { setupMockGraphQL, setMockPathStatus } from './fixtures/mockApi';

test.describe('Paths, Comparison & Explanation Workflow (UW-004, UW-005, AC-107, AC-108)', () => {
  test('finds shortest path between source and target entities (AC-108 FOUND)', async ({ page }) => {
    setMockPathStatus('FOUND');
    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    // Navigate to Paths tab
    await page.locator('#tab-paths-btn').click();

    // Fill source search and select result
    const sourceInput = page.locator('#source-entity-input');
    await sourceInput.fill('Biryani');
    const sourceResult = page.locator('.autocomplete-item').filter({ hasText: 'Hyderabadi' }).first();
    await expect(sourceResult).toBeVisible();
    await sourceResult.click();

    // Fill target search and select result
    const targetInput = page.locator('#target-entity-input');
    await targetInput.fill('Salan');
    const targetResult = page.locator('.autocomplete-item').filter({ hasText: 'Mirchi Ka Salan' }).first();
    await expect(targetResult).toBeVisible();
    await targetResult.click();

    // Click Find Path button
    const findBtn = page.locator('button.find-path-btn');
    await expect(findBtn).toBeEnabled();
    await findBtn.click();

    // Verify path outcome card appears with step flow
    await expect(page.locator('[data-testid="path-outcome-found"]')).toBeVisible();
    await expect(page.locator('.outcome-title')).toContainText('Path Discovered');
    await expect(page.locator('.path-sequence-flow')).toBeVisible();
  });

  test('verifies alternative PathStatus outcomes: NO_PATH, BUDGET_EXCEEDED, and TIMEOUT (AC-108)', async ({ page }) => {
    setMockPathStatus('NO_PATH');
    await setupMockGraphQL(page);
    await page.goto('/');
    await page.locator('#tab-paths-btn').click();

    const sourceInput = page.locator('#source-entity-input');
    await sourceInput.fill('Biryani');
    await page.locator('.autocomplete-item').first().click();

    const targetInput = page.locator('#target-entity-input');
    await targetInput.fill('Salan');
    await page.locator('.autocomplete-item').first().click();

    // 1. Test NO_PATH
    await page.locator('button.find-path-btn').click();
    await expect(page.locator('[data-testid="path-outcome-no-path"]')).toBeVisible();

    // 2. Test BUDGET_EXHAUSTED
    setMockPathStatus('BUDGET_EXHAUSTED');
    await page.locator('button.find-path-btn').click();
    await expect(page.locator('[data-testid="path-outcome-budget-exhausted"]')).toBeVisible();

    // 3. Test TIMEOUT
    setMockPathStatus('TIMEOUT');
    await page.locator('button.find-path-btn').click();
    await expect(page.locator('[data-testid="path-outcome-timeout"]')).toBeVisible();
  });

  test('compares two entities and displays shared and unique features (UW-005, AC-107)', async ({ page }) => {
    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    // Navigate to Compare tab
    await page.locator('#tab-compare-btn').click();

    // Pick Entity A
    const searchInputA = page.locator('#compare-entity-a-input');
    await searchInputA.fill('Biryani');
    const pickA = page.locator('.autocomplete-item').first();
    await expect(pickA).toBeVisible();
    await pickA.click();

    // Pick Entity B
    const searchInputB = page.locator('#compare-entity-b-input');
    await searchInputB.fill('Salan');
    const pickB = page.locator('.autocomplete-item').first();
    await expect(pickB).toBeVisible();
    await pickB.click();

    // Click Compare Entities button
    const compareBtn = page.locator('button.compare-run-btn');
    await expect(compareBtn).toBeEnabled();
    await compareBtn.click();

    // Verify Comparison diff container is displayed
    await expect(page.locator('[data-testid="comparison-results"]')).toBeVisible();

    // Verify sections: Types, Properties, and Shared Neighbors
    await expect(page.locator('.diff-section')).toHaveCount(3);
    await expect(page.locator('.diff-item.item-common').first()).toBeVisible();
    await expect(page.locator('.diff-item.item-common')).toHaveCount(2);
  });
});
