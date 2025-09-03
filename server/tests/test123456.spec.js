
import { test, expect } from '@playwright/test';

test('Login and add product to cart', async ({ page }) => {
    // Navigate to the website
    await page.goto('https://saucedemo.com');

    // Login with environment variables
    await page.fill('#user-name',  'standard_user');
    await page.fill('#password',  'secret_sauce');
    await page.click('#login-button');

    // Wait for the products page to load
    await page.waitForSelector('.inventory_item');

    // Add the first product to cart
    await page.click('.btn_inventory');

    // Wait for the cart icon
    await page.waitForSelector('.shopping_cart_badge');

    // Verify that 1 product is added to the cart
    const cartCount = await page.textContent('.shopping_cart_badge');
    expect(cartCount?.trim()).toBe('1');
});
