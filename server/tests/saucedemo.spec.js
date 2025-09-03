
import { test, expect } from '@playwright/test';

test('SauceDemo - Login and Add Product to Cart', async ({ page }) => {
    // Launch the website
    await page.goto('https://saucedemo.com');

    // Login with credentials from environment variables
    await page.fill('[data-test="username"]', process.env.USERNAME);
    await page.fill('[data-test="password"]', process.env.PASSWORD);
    await page.click('[data-test="login-button"]');
    
    // Wait for the inventory page to load
    await expect(page.locator('.inventory_list')).toBeVisible();

    // Add the first product to the cart
    await page.click('.inventory_item:first-of-type .btn_inventory');

    // Wait for the cart icon to update
    const cartCount = page.locator('.shopping_cart_badge');
    await expect(cartCount).toBeVisible();

    // Verify that 1 product is added to the cart
    await expect(cartCount).toHaveText('1', { ignoreCase: true });
});
