
import { test, expect } from '@playwright/test';

test('Amazon search and add product to cart', async ({ page }) => {
    // Navigate to Amazon
    await page.goto('https://amazon.in');

    // Wait for search box and type "iphone 16"
    await page.fill('input[name="field-keywords"]', 'iphone 16');
    await page.press('input[name="field-keywords"]', 'Enter');

    // Wait for product list and select the first product
    await page.waitForSelector('.s-main-slot .s-result-item', { state: 'visible' });
    const firstProduct = await page.locator('.s-main-slot .s-result-item').first();
    await firstProduct.click();

    // Wait for Add to Cart button and click it
    await page.waitForSelector('#add-to-cart-button', { state: 'visible' });
    await page.click('#add-to-cart-button');

    // Wait for confirmation and navigate to cart
    await page.waitForSelector('.sw-atc-text', { state: 'visible' });
    await page.click('a[href*="/cart"]');

    // Wait for cart page to load and verify iPhone is in the cart
    await page.waitForSelector('.sc-product-title', { state: 'visible' });
    const cartProductTitle = await page.locator('.sc-product-title').innerText();
    expect(cartProductTitle.toLowerCase()).toContain('iphone 16');
});
