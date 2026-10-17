import { test, expect, Page } from '@playwright/test';

/**
 * Commas in DataGrid cell edits are thousands separators, the same as in the
 * Investment Amount field. They must be stripped before the value reaches
 * `new Big()`; otherwise big.js throws from `preProcessEditCellProps`
 * (https://github.com/skylerwlewis/rebalancing-calculator/issues/124).
 */

const fundRow = (page: Page, name: string) =>
  page.getByRole('row').filter({
    has: page.locator(`[data-field="nameString"]:has-text("${name}")`),
  });

const cell = (page: Page, fundName: string, field: string) =>
  fundRow(page, fundName).locator(`[data-field="${field}"]`);

/** Types `text` into a cell and presses Enter. See AGENTS.md "DataGrid cell editing". */
const editCell = async (page: Page, fundName: string, field: string, text: string) => {
  const target = cell(page, fundName, field);
  await target.click();
  await page.keyboard.press(text[0]);
  const input = target.locator('input');
  await input.waitFor({ state: 'visible' });
  await input.pressSequentially(text.slice(1));
  await expect(input).toHaveValue(text);
  await page.waitForTimeout(250);
  await input.press('Enter');
  return input;
};

test.describe('comma input in DataGrid cells', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto('/');
    await fundRow(page, 'VFIAX').waitFor();
    await fundRow(page, 'VTSAX').waitFor();
  });

  test.afterEach(() => {
    expect(pageErrors).toEqual([]);
  });

  test('Target Percent accepts 5,0 as 50%', async ({ page }) => {
    await editCell(page, 'VFIAX', 'targetPercentString', '5,0');

    await expect(cell(page, 'VFIAX', 'targetPercentString')).toHaveText('50%');
    await expect(cell(page, 'Total', 'targetPercentString')).toHaveText('110%');
  });

  test('Target Percent flags 1,000 as an invalid percentage', async ({ page }) => {
    const input = await editCell(page, 'VFIAX', 'targetPercentString', '1,000');

    // An edit with error: true is not committed; the cell stays in edit mode, flagged.
    await expect(input).toBeVisible();
    await expect(cell(page, 'VFIAX', 'targetPercentString').locator('.Mui-error')).toBeVisible();
    await expect(cell(page, 'Total', 'targetPercentString')).toHaveText('100%');
  });

  test('Current Balance accepts 1,000 as $1,000.00', async ({ page }) => {
    await editCell(page, 'VFIAX', 'currentBalanceString', '1,000');

    await expect(cell(page, 'VFIAX', 'currentBalanceString')).toHaveText('$1,000.00');
    // Total future = $1,200; VFIAX (40% = $480) is over target, so VTSAX gets the full $100.
    await expect(cell(page, 'VFIAX', 'amountToInvestString')).toHaveText('$0.00');
    await expect(cell(page, 'VTSAX', 'amountToInvestString')).toHaveText('$100.00');
  });
});
