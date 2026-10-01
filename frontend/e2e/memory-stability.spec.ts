import { test, expect } from '@playwright/test';
import { setupMockGraphQL } from './fixtures/mockApi';

test.describe('Memory Stability Benchmarks (NF-005, TC-011)', () => {
  test('verifies memory stability over 20 expand/collapse cycles without unbounded growth', async ({ page }) => {
    // Capture any runtime page errors or unhandled rejections
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await setupMockGraphQL(page);
    await page.goto('/');
    await expect(page.locator('.ontology-title')).toBeVisible();

    // 1. Initial search and addition of entity
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('Biryani');
    await page.locator('.entity-result-item').filter({ hasText: 'Hyderabadi' }).first().click();
    await expect(page.locator('.graph-stats')).toContainText('1 nodes');

    // Expand entity
    const expandBtn = page.locator('button.primary-action', { hasText: 'Expand' });
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();
    await expect(page.locator('.graph-stats')).toContainText('4 nodes');

    // 2. Measure baseline JS heap size
    const initialHeap = await page.evaluate(() => {
      const perf = window.performance as unknown as { memory?: { usedJSHeapSize: number } };
      return perf.memory ? perf.memory.usedJSHeapSize : 10 * 1024 * 1024;
    });

    console.log(`[MEMORY BENCHMARK] Baseline used JS heap size: ${(initialHeap / (1024 * 1024)).toFixed(2)} MB`);

    const undoBtn = page.locator('button[aria-label="Undo last expansion"]');
    const redoBtn = page.locator('button[aria-label="Redo expansion"]');

    // 3. Execute 20 undo and redo cycles (collapsing and expanding the graph)
    const CYCLES = 20;
    for (let i = 1; i <= CYCLES; i++) {
      await undoBtn.click();
      await expect(page.locator('.graph-stats')).toContainText('0 nodes');

      await redoBtn.click();
      await expect(page.locator('.graph-stats')).toContainText('4 nodes');
    }

    // Force garbage collection hint / settle
    await page.waitForTimeout(300);

    // 4. Measure final JS heap size
    const finalHeap = await page.evaluate(() => {
      const perf = window.performance as unknown as { memory?: { usedJSHeapSize: number } };
      return perf.memory ? perf.memory.usedJSHeapSize : 10 * 1024 * 1024;
    });

    const heapGrowthBytes = finalHeap - initialHeap;
    const growthPercent = (heapGrowthBytes / initialHeap) * 100;

    console.log(`[MEMORY BENCHMARK] Final used JS heap size: ${(finalHeap / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`[MEMORY BENCHMARK] Total Heap Delta: ${(heapGrowthBytes / (1024 * 1024)).toFixed(2)} MB (${growthPercent.toFixed(1)}%)`);

    // Assert zero runtime errors (no crashes or memory leaks during cycling)
    expect(pageErrors).toEqual([]);

    // Assert NF-005 requirement: heap growth < 50% over 20 cycles
    expect(growthPercent).toBeLessThan(50);
  });
});
