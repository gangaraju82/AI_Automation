
import { test, expect } from '@playwright/test';

test('Search and add iPhone 16 to cart', async ({ page }) => {
    // Launch website
    await page.goto('https://www.amazon.in/');

    // Enter search term
    await page.fill('input[name="field-keywords"]', 'i phone 16');

    // Submit search
    await Promise.all([
        page.click('input[type="submit"]'),
        page.waitForNavigation()
    ]);

    // Click on apple checkbox in brands category
    await page.check('text=Apple');

    // Wait for items to load
    await page.waitForTimeout(3000);

    // Click on the iPhone 16 125GB item
    await page.click('text=iphone 16 125gb');

    // Wait for navigation to item page
    await page.waitForNavigation();

    // Click add to cart button
    await page.click('text=Add to Cart');

    // Verify if item is added to the cart
    const cartCount = await page.textContent('#nav-cart-count');
    expect(cartCount).toBe('1'); // Compare as string for case insensitivity
});
