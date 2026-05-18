import { test, expect } from "@playwright/test"

/**
 * Smoke: marketing home responds.
 * Run locally: npx playwright test (requires `npm run dev` or PLAYWRIGHT_BASE_URL).
 */
test("home page loads", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/Raw English|Speakflow/i)
})
