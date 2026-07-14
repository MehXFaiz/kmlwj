import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error('[BROWSER EXCEPTION]', err);
  });

  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/')) {
      console.log(`[API REQUEST] [${request.method()}] ${url}`);
    }
  });

  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/')) {
      console.log(`[API RESPONSE] [${response.status()}] ${url}`);
    }
  });

  console.log("Navigating to login page...");
  await page.goto('http://localhost:5173/login');
  
  console.log("Submitting login form...");
  await page.fill('input[type="email"]', 'admin@erp.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  console.log("Waiting for dashboard to load...");
  await page.waitForURL('http://localhost:5173/');
  await page.waitForTimeout(5000);

  console.log("\n--- CLEARING CONSOLE LOGS & TRIGGERING REFRESH ---");
  const refreshButton = page.locator('button:has-text("Refresh")');
  await refreshButton.click();
  
  console.log("Clicked! Waiting 15 seconds to capture responses...");
  await page.waitForTimeout(15000);

  console.log("Diagnostics finished.");
  await browser.close();
}

main().catch(err => {
  console.error("Diagnostic execution error:", err);
  process.exit(1);
});
