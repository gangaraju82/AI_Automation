
import { test, expect } from '@playwright/test';

test('Login and add product to cart', async ({ page }) => {
  const username =  'standard_user';
  const password =  'secret_sauce';

  await page.goto('https://saucedemo.com');
  await page.fill('input[id="user-name"]', username);
  await page.fill('input[id="password"]', password);
  await page.click('input[id="login-button"]');

  await page.waitForSelector('.inventory_item');
  await page.click('.inventory_item:first-of-type button');

  await page.waitForSelector('.shopping_cart_badge');
  const cartCount = await page.innerText('.shopping_cart_badge');
  
  expect(cartCount).toBe('1');
});
