import { test, expect, Page } from '@playwright/test';

/**
 * Production-like regression tests using a real Chromium browser.
 *
 * Unlike the Vitest/jsdom tests that must mock DataGrid internals to work
 * around jsdom's lack of a CSS layout engine, these tests run against the
 * actual app in a headless browser.  DataGrid's layout, virtualisation,
 * cell-edit lifecycle, and DOM event handling all behave exactly as they
 * do for real users, so no mocking of MUI internals is required.
 *
 * The primary regression being guarded:
 *   @mui/x-data-grid versions immediately after 6.18.2 introduced a bug where
 *   committing a cell edit only re-rendered the edited row; sibling rows kept
 *   stale computed values.  These tests will catch that regression by
 *   asserting that calculated fields on OTHER rows update after an edit.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a locator for the data row whose Fund Name cell contains `name`. */
function fundRow(page: Page, name: string) {
  return page.getByRole('row').filter({
    has: page.locator(`[data-field="nameString"]:has-text("${name}")`),
  });
}

/** Returns the Amount to Invest cell for a given fund row. */
function amountCell(page: Page, fundName: string) {
  return fundRow(page, fundName).locator('[data-field="amountToInvestString"]');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('DataGrid regression: editing one row must update all rows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait until both default fund rows are visible before each test
    await fundRow(page, 'VFIAX').waitFor();
    await fundRow(page, 'VTSAX').waitFor();
  });

  test('initial render shows correct default calculated values', async ({ page }) => {
    // Default: invest $100, VFIAX balance=$100 / target=40%, VTSAX balance=$100 / target=60%
    // VFIAX gap to target: target $160 in $400 total... wait: no build step, using initial values
    // With $100 total balance and $100 to invest: VFIAX target 40% → $160 future on $200 total
    // VFIAX gap = $60, VTSAX gap = $140; total gap = $200 > $100 so proportional fill
    // Actually with balance=$100 each, invest=$100: total future=$300
    // VFIAX target 40% of $300 = $120; current $100; gap = $20
    // VTSAX target 60% of $300 = $180; current $100; gap = $80
    // Total gap = $100 = amount to invest → VFIAX gets $20, VTSAX gets $80
    await expect(amountCell(page, 'VFIAX')).toContainText('$20.00');
    await expect(amountCell(page, 'VTSAX')).toContainText('$80.00');
  });

  /**
   * CRITICAL REGRESSION TEST — no mocking required.
   *
   * This is the same scenario as the Vitest `simulateCellCommit` test but
   * exercises the full DataGrid cell-edit flow in a real browser:
   *   double-click → edit input → type → Enter to commit → processRowUpdate fires
   *   → React state updates → DataGrid re-renders ALL rows from new `rows` prop.
   *
   * A buggy DataGrid version will pass the first assertion (edited row updates)
   * but fail the second (sibling row stays stale).
   */
  test('editing VFIAX balance updates calculated fields in OTHER rows (regression)', async ({ page }) => {
    const balanceCell = fundRow(page, 'VFIAX').locator('[data-field="currentBalanceString"]');

    // Single click to focus/select the cell — does NOT enter edit mode yet.
    await balanceCell.click();

    // Pressing a printable key on a focused DataGrid cell calls
    //   startCellEditMode({ id, field, deleteValue: true, initialValue: '2' })
    // DataGrid enters edit mode with the old value cleared and '2' as the
    // initial character.  No intermediate empty-string state means no
    // validation error that would cause Tab to revert to the old value.
    await page.keyboard.press('2');

    // Wait for the edit-mode input to appear before typing further characters.
    // page.keyboard.type() dispatches events before React can re-render the
    // new input element, so '0' and '0' would be missed.  Waiting for the
    // input element and then calling type() on it directly is reliable.
    const editInput = balanceCell.locator('input');
    await editInput.waitFor({ state: 'visible' });

    // Append the remaining digits directly on the input element
    await editInput.type('00');

    // DataGrid v6's GridEditInputCell debounces setEditCellValue() by 200ms
    // in its onChange handler.  If Tab fires before the debounce resolves,
    // stopCellEditMode reads the stale pre-edit value from React state and
    // calls processRowUpdate with the OLD balance.  Waiting 250ms lets the
    // debounce fire so React state reflects '200' before we commit.
    await expect(editInput).toHaveValue('200');
    await page.waitForTimeout(250);

    // Tab commits the edit (triggers processRowUpdate) and moves focus away
    await editInput.press('Tab');

    // The edited row (VFIAX) is now over-target:
    //   total balance = $300, invest = $100, total future = $400
    //   VFIAX target 40% of $400 = $160 < current $200 → over-target → gets $0
    await expect(amountCell(page, 'VFIAX')).toContainText('$0.00');

    // THE CRITICAL ASSERTION — this is what the buggy version fails:
    //   VTSAX target 60% of $400 = $240; current $100; gap = $140 > $100
    //   VTSAX gets the full remaining $100 to invest.
    await expect(amountCell(page, 'VTSAX')).toContainText('$100.00');
  });

  test('add fund button inserts a new editable row', async ({ page }) => {
    await page.getByRole('button', { name: /add fund/i }).click();
    await expect(page.getByRole('row').filter({ hasText: 'New Fund' })).toBeVisible();
  });

  test('delete button removes the fund row', async ({ page }) => {
    // The delete action renders as a menuitem inside the actions cell
    const actionsCell = fundRow(page, 'VFIAX').locator('[data-field="actions"]');
    await actionsCell.getByRole('menuitem').click();

    await expect(fundRow(page, 'VFIAX')).not.toBeVisible();
    await expect(fundRow(page, 'VTSAX')).toBeVisible();
  });

  test('changing the investment amount updates all fund rows', async ({ page }) => {
    const investmentInput = page.getByLabel(/investment amount/i);
    await investmentInput.fill('200');

    // With balance=$100 each and $200 to invest:
    //   total future = $400; VFIAX target $160 gap=$60; VTSAX target $240 gap=$140
    //   total gap = $200 = amount to invest → VFIAX gets $60, VTSAX gets $140
    await expect(amountCell(page, 'VFIAX')).toContainText('$60.00');
    await expect(amountCell(page, 'VTSAX')).toContainText('$140.00');
  });
});
