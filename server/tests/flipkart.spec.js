
import { test, expect } from '@playwright/test';

test('Search for iPhone 16 and verify Apple product', async ({ page }) => {
    await page.goto('https://www.flipkart.com/');

    // Close login modal if it appears
    const loginModalCloseButton = page.locator('button._2KpZ6l._2doB4z');
    if (await loginModalCloseButton.isVisible()) {
        await loginModalCloseButton.click();
    }

    await page.fill('input[title="Search for products, brands and more"]', 'iphone 16');
    await page.press('input[title="Search for products, brands and more"]', 'Enter');

    await page.waitForTimeout(2000); // Wait for search results to load

    await page.locator('text=6 GB Above').first().click();
    await page.waitForTimeout(2000); // Wait for filters to apply

    const appleProducts = await page.locator('h2._4rR01T').allTextContents();
    const isAppleProductPresent = appleProducts.some(product => product.toLowerCase().includes('apple'));

    expect(isAppleProductPresent).toBeTruthy();
});
