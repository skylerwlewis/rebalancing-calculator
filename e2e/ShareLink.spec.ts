import { test, expect, Page } from '@playwright/test';

const openShareModal = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByText('Share or Bookmark Your Results')).toBeVisible();
};

test('copies the share link to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openShareModal(page);
  const link = await page.getByRole('textbox').inputValue();

  await page.getByRole('button', { name: 'Copy link' }).click();

  await expect(page.getByText('Link copied to clipboard.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
});

test('selects the link for manual copy when the clipboard write fails', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
  });
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await openShareModal(page);

  await page.getByRole('button', { name: 'Copy link' }).click();

  await expect(page.getByText("Couldn't copy automatically.", { exact: false })).toBeVisible();
  const textbox = page.getByRole('textbox');
  await expect(textbox).toBeFocused();
  const selection = await textbox.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd, el.value.length]);
  expect(selection).toEqual([0, selection[2], selection[2]]);
  expect(pageErrors).toEqual([]);
});
