
import { test, expect } from '@playwright/test';

test('Login and add product to cart', async ({ page }) => {
  const username =  'standard_user';
  const password =  'secret_sauce';

  // Launch the website
  await page.goto('https://saucedemo.com');

  // Login
  await page.fill('input[id="user-name"]', username);
  await page.fill('input[id="password"]', password);
  await page.click('input[id="login-button"]');

  // Wait for the products page to load
  await page.waitForSelector('.inventory_list');

  // Add a product to the cart
  await page.click('.btn_inventory');

  // Verify that 1 product is added to the cart
  const cartCount = await page.locator('.shopping_cart_badge').innerText();
  expect(parseInt(cartCount)).toBe(1);
});
