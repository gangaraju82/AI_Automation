
import { test, expect } from '@playwright/test';

test('Login and add product to cart', async ({ page }) => {
    // Navigate to the website
    await page.goto('https://saucedemo.com');

    // Perform login
    await page.fill('[data-test="username"]',  'standard_user');
    await page.fill('[data-test="password"]',  'secret_sauce');
    await page.click('[data-test="login-button"]');
    
    // Ensure we're on the products page
    await expect(page).toHaveURL(/.*\/inventory\.html/);

    // Add a product to the cart
    await page.click('text="Sauce Labs Backpack"'); // Unique selector for a specific product
    await page.click('"Add to cart"');

    // Verify that 1 product is added to the cart
    const cartCount = await page.locator('.shopping_cart_badge').textContent();
    expect(parseInt(cartCount || '0')).toBe(1);
});
