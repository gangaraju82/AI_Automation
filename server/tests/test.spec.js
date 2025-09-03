
import { test, expect } from '@playwright/test';

test('SauceDemo Login and Add to Cart', async ({ page }) => {
  // Navigate to SauceDemo
  await page.goto('https://saucedemo.com');

  // Login
  await page.fill('input[name="user-name"]',  'standard_user');
  await page.fill('input[name="password"]',  'secret_sauce');
  await page.click('input[type="submit"]');

  // Wait for the product page to load
  await page.waitForSelector('.inventory_list');

  // Add a product to the cart (selecting the first product for this example)
  await page.click('.inventory_item:nth-child(1) .btn_inventory');

  // Verify the cart count
  const cartCount = await page.locator('.shopping_cart_badge').innerText();
  expect(cartCount.trim().toLowerCase()).toBe('1');
});
