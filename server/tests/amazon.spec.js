
import { test, expect } from '@playwright/test';

test('Amazon Search and Add to Cart', async ({ page }) => {
    await page.goto('https://amazon.in');

    // Wait for the search bar and type the search query
    const searchBar = page.locator('#twotabsearchtextbox');
    await searchBar.fill('Apple iPhone 15 (128 GB) - Yellow');
    await searchBar.press('Enter');

    // Wait for results and click on the specific iPhone
    const iphoneLink = page.locator('text=Apple iPhone 15 (128 GB) - Yellow');
    await expect(iphoneLink).toBeVisible();
    await iphoneLink.click();

    // Wait for add to cart button and click it
    const addToCartButton = page.locator('#add-to-cart-button');
    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();

    // Wait for confirmation and verify item added
    await page.waitForSelector('.a-size-medium.a-color-success');
    const confirmationMessage = await page.locator('.a-size-medium.a-color-success').innerText();
    expect(confirmationMessage.toLowerCase()).toContain('added to cart');
});
