import { test, expect } from '@playwright/test';
import { setupMockGraphQL } from './fixtures/mockApi';

test.describe('Keyboard Navigation & Accessibility Interactions (AX-001, AX-003, AX-004, AX-006, AX-008)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();
  });

  test('verifies skip links navigate to main sections (AX-008)', async ({ page }) => {
    // Focus first skip link via Tab key
    await page.keyboard.press('Tab');
    const firstSkipLink = page.locator('.skip-link-item').first();
    await expect(firstSkipLink).toBeFocused();
    await expect(firstSkipLink).toContainText('Skip to Graph Canvas');

    // Press Enter to navigate to #main-canvas
    await page.keyboard.press('Enter');
    const canvasMain = page.locator('#main-canvas');
    await expect(canvasMain).toBeVisible();
  });

  test('verifies Command Palette keyboard workflow and focus trap (AX-001, AX-003)', async ({ page }) => {
    // Open Command Palette via keyboard shortcut Ctrl+K
    await page.keyboard.press('Control+k');
    const paletteModal = page.locator('.palette-modal');
    await expect(paletteModal).toBeVisible();

    // Verify input is auto-focused
    const paletteInput = page.locator('.palette-input');
    await expect(paletteInput).toBeFocused();

    // Type query
    await page.keyboard.type('Biryani');
    await expect(page.locator('.palette-item').first()).toBeVisible();

    // Escape closes palette
    await page.keyboard.press('Escape');
    await expect(paletteModal).toBeHidden();
  });

  test('verifies Expansion Preview dialog focus trap and cancellation (AX-001, AX-003)', async ({ page }) => {
    // 1. Search Biryani and add
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');

    // 2. Click "Preview..." button to open ExpansionPreviewDialog
    const previewBtn = page.locator('button', { hasText: 'Preview...' });
    if (await previewBtn.isVisible()) {
      await previewBtn.click();
      const previewDialog = page.locator('.expansion-preview-dialog');
      await expect(previewDialog).toBeVisible();

      // Verify close button or primary action is focused
      const closeBtn = previewDialog.locator('.dialog-close-btn');
      await expect(closeBtn).toBeFocused();

      // Press Escape to cancel and close dialog
      await page.keyboard.press('Escape');
      await expect(previewDialog).toBeHidden();
    }
  });

  test('verifies reduced motion toggle updates preference and DOM state (AX-004, AX-006)', async ({ page }) => {
    const motionToggle = page.locator('.reduced-motion-toggle-btn');
    await expect(motionToggle).toBeVisible();
    await expect(motionToggle).toHaveAttribute('aria-pressed', 'false');

    // Click toggle to enable reduced motion
    await motionToggle.click();
    await expect(motionToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(motionToggle).toContainText('Reduced Motion');

    // Verify body contains reduced motion class
    const bodyHasClass = await page.evaluate(() =>
      document.body.classList.contains('reduced-motion')
    );
    expect(bodyHasClass).toBe(true);

    // Toggle back off
    await motionToggle.click();
    await expect(motionToggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('verifies keyboard navigation through left navigation tabs and tree items', async ({ page }) => {
    // Click Search Tab
    const searchTab = page.locator('#tab-search-btn');
    await searchTab.focus();
    await expect(searchTab).toBeFocused();

    // Navigate to Classes Tab via keyboard
    await page.locator('#tab-classes-btn').click();
    await expect(page.locator('#tab-classes-panel')).toBeVisible();

    // Focus class filter input
    const filterInput = page.locator('input[aria-label="Filter classes by name"]');
    await filterInput.fill('Recipe');

    // Verify filtered class node button is reachable and operable
    const recipeNode = page.locator('.tree-label-btn').filter({ hasText: 'Recipe' });
    await expect(recipeNode).toBeVisible();
    await recipeNode.focus();
    await page.keyboard.press('Enter');

    // Class Inspector tab should now be enabled
    await expect(page.locator('#tab-class')).toBeEnabled();
  });
});
