import { test, expect } from '@playwright/test';
import { setupMockGraphQL } from './fixtures/mockApi';

test.describe('Session Management & Restore Workflow (SE-001, SE-002, UW-008, OP-009)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();
  });

  test('saves active session to browser storage and auto-restores on page reload', async ({ page }) => {
    // 1. Search and add Biryani entity
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();

    // Verify entity and neighbors added (4 nodes)
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');

    // Wait for the 2-second debounce auto-save to write to localStorage
    await page.waitForTimeout(2500);

    // 2. Open Sessions Modal via header button
    await page.locator('.session-header-trigger').click();
    await expect(page.locator('.session-modal-container')).toBeVisible();

    // 3. Name session and click Save to Browser
    await page.locator('#session-name-input').fill('Test Biryani Feast');
    await page.locator('button.session-btn-primary', { hasText: 'Save to Browser' }).click();

    // Verify success feedback
    await expect(page.locator('.session-compat-card.success')).toBeVisible();
    await expect(page.locator('.session-compat-card.success')).toContainText('saved to browser storage');

    // Close modal
    await page.locator('.session-modal-close-btn').click();
    await expect(page.locator('.session-modal-container')).toBeHidden();

    // 4. Clear hash from URL so reload exercises localStorage auto-restore (SE-002)
    await page.evaluate(() => history.replaceState(null, '', '/'));
    await page.reload();
    await expect(page.locator('.ontology-title')).toBeVisible();

    // Check restored notice and graph node stats
    await expect(page.locator('.graph-notice')).toContainText('Restored active session');
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');
  });

  test('exports session to file, clears storage, and restores via file upload', async ({ page }) => {
    // 1. Search and add entity
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');

    // 2. Open Sessions modal and Export to File
    await page.locator('.session-header-trigger').click();
    await expect(page.locator('.session-modal-container')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button.session-btn-secondary', { hasText: 'Export to File' }).click(),
    ]);

    expect(download.suggestedFilename()).toContain('.json');
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    await page.locator('.session-modal-close-btn').click();

    // 3. Reset/Clear graph
    await page.locator('button[aria-label="Reset graph"]').click();
    await expect(page.locator('.graph-stats')).toContainText('0 nodes');

    // Clear local storage
    await page.evaluate(() => localStorage.clear());

    // 4. Open Sessions modal -> Restore tab -> Import from file
    await page.locator('.session-header-trigger').click();
    await page.locator('.session-tab-btn', { hasText: 'Restore & Import' }).click();

    // Set file on hidden input
    await page.locator('input[type="file"]').setInputFiles(downloadPath!);

    // Verify compatibility card appears
    await expect(page.locator('.session-compat-card')).toBeVisible();
    await expect(page.locator('.session-compat-header')).toContainText('Session Fully Compatible');

    // Confirm full restore
    await page.locator('button.session-btn-primary', { hasText: 'Restore Full Session' }).click();

    // Verify nodes restored
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');
  });

  test('generates and loads shareable deep link URL', async ({ page, context }) => {
    // 1. Search and add entity
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');

    // 2. Open Sessions modal and switch to Share & Deep Link tab
    await page.locator('.session-header-trigger').click();
    await page.locator('.session-tab-btn', { hasText: 'Share & Deep Link' }).click();

    // Extract generated deep link URL from the input
    const linkInput = page.locator('#session-deeplink-input');
    await expect(linkInput).toBeVisible();
    const deepLinkUrl = await linkInput.inputValue();
    expect(deepLinkUrl).toContain('#entities=');

    // 3. Open deep link URL in a new browser tab/page
    const newPage = await context.newPage();
    await setupMockGraphQL(newPage);
    await newPage.goto(deepLinkUrl);
    await expect(newPage.locator('.ontology-title')).toBeVisible();

    // Verify notice indicates loading entities from shared link
    await expect(newPage.locator('.graph-notice')).toContainText('Loaded');
    await expect(newPage.locator('.graph-notice')).toContainText('entities from shared link');
    await expect(newPage.locator('.graph-stats')).toContainText('4 nodes');
    await newPage.close();
  });
});
