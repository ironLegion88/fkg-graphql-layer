import { test, expect } from '@playwright/test';
import { setupMockGraphQL } from './fixtures/mockApi';

test.describe('Ontology Semantic Inspector Navigation (AC-104, AC-106, TC-008)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();
  });

  test('displays Resource Inspector with metadata when entity is selected', async ({ page }) => {
    // 1. Search for Biryani and select Authentic Hyderabadi Biryani Recipe
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();

    // 2. Resource Inspector should be displayed in the right panel
    const resourceInspector = page.locator('[data-testid="resource-inspector"]');
    await expect(resourceInspector).toBeVisible();

    // Verify title and semantic kind
    await expect(resourceInspector.locator('.resource-title')).toContainText('Hyderabadi Dum Biryani');
    await expect(resourceInspector.locator('.resource-kind-badge')).toContainText('NamedIndividual');

    // Verify asserted type marker (AC-106: non-color cues)
    const assertedType = resourceInspector.locator('[data-testid="asserted-type"]');
    await expect(assertedType).toBeVisible();
    await expect(assertedType).toContainText('Recipe');

    // Verify inferred type marker (AC-106: non-color cues)
    const inferredType = resourceInspector.locator('[data-testid="inferred-type"]');
    await expect(inferredType).toBeVisible();
    await expect(inferredType).toContainText('Thing');

    // Verify source graph display
    await expect(resourceInspector).toContainText('urn:fkg:graph:asserted');
  });

  test('displays Class Inspector with hierarchy and instance counts when class is selected', async ({ page }) => {
    // 1. Switch left navigation panel to Classes tab
    await page.locator('#tab-classes-btn').click();
    await expect(page.locator('#tab-classes-panel')).toBeVisible();

    // 2. Click the Recipe class node in the tree
    const classBtn = page.locator('.tree-label-btn').filter({ hasText: 'Recipe' });
    await expect(classBtn).toBeVisible();
    await classBtn.click();

    // 3. Switch inspector to Class tab if not auto-selected
    await page.locator('#tab-class').click();

    // 4. Class Inspector should be displayed in the right panel
    const classInspector = page.locator('[data-testid="class-inspector"]');
    await expect(classInspector).toBeVisible();

    // Verify class title and instance badge
    await expect(classInspector.locator('.class-title')).toContainText('Recipe');
    await expect(classInspector.locator('.instance-counter-badge')).toContainText('500 instances');
    await expect(classInspector.locator('.class-badge')).toContainText('OWL Class');

    // Verify action button to show instances is present
    await expect(classInspector.locator('button', { hasText: 'Show Instances (500)' })).toBeVisible();
  });

  test('displays Property Inspector with domain/range signature and characteristics', async ({ page }) => {
    // 1. Switch left navigation panel to Properties tab
    await page.locator('#tab-properties-btn').click();
    await expect(page.locator('#tab-properties-panel')).toBeVisible();

    // 2. Click the 'has ingredient' property card
    const propCard = page.locator('.property-card').filter({ hasText: 'has ingredient' });
    await expect(propCard).toBeVisible();
    await propCard.click();

    // 3. Switch inspector to Property tab if not auto-selected
    await page.locator('#tab-property').click();

    // 4. Property Inspector should be displayed in the right panel
    const propInspector = page.locator('[data-testid="property-inspector"]');
    await expect(propInspector).toBeVisible();

    // Verify property title and kind
    await expect(propInspector.locator('.property-title')).toContainText('has ingredient');
    await expect(propInspector.locator('.property-kind-badge')).toContainText('ObjectProperty');
    await expect(propInspector.locator('.usage-counter-badge')).toContainText('2500 uses');

    // Verify domain & range pills
    await expect(propInspector.locator('.domain-card')).toContainText('Recipe');
    await expect(propInspector.locator('.range-card')).toContainText('Ingredient');
  });

  test('displays Consistency Panel with build status and ontology metrics', async ({ page }) => {
    // 1. Click Consistency tab in the right inspector tabs
    await page.locator('#tab-consistency').click();

    // 2. Consistency panel should be visible
    const consistencyPanel = page.locator('[data-testid="consistency-panel"]');
    await expect(consistencyPanel).toBeVisible();

    // 3. Verify consistency status card and metrics
    const statusCard = page.locator('[data-testid="consistency-status-card"]');
    await expect(statusCard).toBeVisible();
    await expect(statusCard).toContainText('Consistent');

    // Verify total triples count (Food fixture scale)
    await expect(consistencyPanel).toContainText('16,263');
    await expect(consistencyPanel).toContainText('rdfs-parity');

    // Verify no unsatisfiable classes
    await expect(page.locator('[data-testid="no-unsatisfiable-classes"]')).toBeVisible();
    await expect(page.locator('[data-testid="no-unsatisfiable-classes"]')).toContainText('0 unsatisfiable classes');
  });
});
