import { test, expect } from '@playwright/test';

test('Login and add products to cart', async ({ page }) => {
    // Launch the application
    await page.goto('https://www.saucedemo.com/');

    // Login with provided credentials
    await page.fill('#user-name', 'standard_user');
    await page.fill('#password', 'secret_sauce');
    await page.click('#login-button');

    // Verify that the user is redirected to the inventory page
    await expect(page).toHaveURL('https://www.saucedemo.com/inventory.html');

    // Add first product to the cart
    await page.waitForSelector('.inventory_item');
    await page.click('.inventory_item:nth-child(1) .btn_inventory');

    // Add second product to the cart
    await page.click('.inventory_item:nth-child(2) .btn_inventory');

    // Verify that 2 products are added to the cart
    await page.click('.shopping_cart_link');
    await expect(page.locator('.cart_item')).toHaveCount(2);

    // Logout
    await page.click('#react-burger-menu-btn');
    await page.click('#logout_sidebar_link');

    // Close the browser
    await page.close();
});