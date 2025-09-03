
import { test, expect } from '@playwright/test';

test('Contact Us Search', async ({ page }) => {
    // Launch the website
    await page.goto('https://www.britishairways.com/travel/helpcentre/public/en_gb/');

    // Wait for the search input and type 'contact'
    const searchInput = page.locator('input[placeholder="Search"]');
    await searchInput.fill('contact');

    // Click the search button
    const searchButton = page.locator('button:has-text("Search")');
    await searchButton.click();

    // Wait for the 'Contact Us' link and click it
    const contactUsLink = page.locator('a:has-text("Contact us")');
    await contactUsLink.click();

    // Optionally wait for the navigation to complete
    await expect(page).toHaveURL(/.*contact-us/i);
});
