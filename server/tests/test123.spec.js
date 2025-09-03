
import { test, expect } from '@playwright/test';

test('Login and add product to cart', async ({ page }) => {
  const username =  'standard_user';
  const password =  'secret_sauce';

  await page.goto('https://saucedemo.com');

  await page.fill('input[name="user-name"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('input[type="submit"]');

  await expect(page).toHaveURL(/.*\/inventory/);
  
  await page.click('text="Sauce Labs Backpack"');
  await page.click('text="Add to cart"');
  
  await expect(page.locator('.shopping_cart_badge')).toHaveText('1', { ignoreCase: true });
});
