import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// Run tests in serial mode to avoid session and DB race conditions
test.describe.configure({ mode: 'serial' });

test.describe('ERP E2E QA Test Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Listen for console logs and page errors
    page.on('console', msg => console.log(`[BROWSER LOG] [${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.message}`));
  });

  test('Module 1: Invalid Login Validation', async ({ page }) => {
    page.setDefaultTimeout(15000);

    // 1. Visit login page
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveTitle(/KMLWJ/i);

    // 2. Incorrect credentials
    await page.fill('input[type="email"]', 'admin@erp.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    
    // Expect error alert text
    await expect(page.locator('text=Invalid credentials').first()).toBeVisible({ timeout: 15000 });
  });

  test('Module 2: Success Login & Dashboard', async ({ page }) => {
    page.setDefaultTimeout(15000);

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@erp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 15000 });

    // Verify main dashboard metrics load
    await expect(page.locator('h2:has-text("Dashboard"), h1:has-text("Dashboard")').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Live Data').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Quick Actions').first()).toBeVisible({ timeout: 15000 });
  });

  test('Module 3: Chart of Accounts & General Ledger', async ({ page }) => {
    page.setDefaultTimeout(15000);

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@erp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Go to COA
    await page.goto(`${BASE_URL}/coa`);
    await expect(page.locator('h1:has-text("Chart of Accounts"), h2:has-text("Chart of Accounts")').first()).toBeVisible({ timeout: 15000 });
    
    // Verify accounts load
    await expect(page.locator('text=Assets').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Liabilities').first()).toBeVisible({ timeout: 15000 });

    // Go to Ledger
    await page.goto(`${BASE_URL}/ledger`);
    await expect(page.locator('h1:has-text("General Ledger"), h2:has-text("General Ledger")').first()).toBeVisible({ timeout: 15000 });
  });

  test('Module 4: Trial Balance & Financial Statements', async ({ page }) => {
    page.setDefaultTimeout(15000);

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@erp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Trial Balance
    await page.goto(`${BASE_URL}/trial-balance-sheet`);
    await expect(page.locator('h1:has-text("Trial Balance Matrix"), h2:has-text("Trial Balance Matrix")').first()).toBeVisible({ timeout: 15000 });
  });

  test('Module 5: Hall Bookings & Members', async ({ page }) => {
    page.setDefaultTimeout(15000);

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@erp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Hall bookings list
    await page.goto(`${BASE_URL}/hall-bookings`);
    await expect(page.locator('h1:has-text("Hall Bookings"), h2:has-text("Hall Bookings")').first()).toBeVisible({ timeout: 15000 });

    // Members list
    await page.goto(`${BASE_URL}/members`);
    await expect(page.locator('h1:has-text("Community Members Directory"), h2:has-text("Community Members Directory")').first()).toBeVisible({ timeout: 15000 });
  });

  test('Module 5.5: Hall Booking Auto-Fill Charges Logic', async ({ page }) => {
    page.setDefaultTimeout(15000);

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@erp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Go directly to the new booking form
    await page.goto(`${BASE_URL}/hall-bookings/new`);
    await expect(page.locator('text=Booker Details').first()).toBeVisible({ timeout: 15000 });

    // Select Sadaya Hall from dropdown
    await page.selectOption('select[name="hallId"]', { label: 'Sadaya Hall' });
    
    // Assert amount fields are filled with 28000 automatically
    const amountVal = await page.inputValue('input[name="amount"]');
    expect(amountVal).toBe('28000');

    const netAmountVal = await page.inputValue('input[name="netAmount"]');
    expect(netAmountVal).toBe('28000');

    const receivedAmountVal = await page.inputValue('input[name="receivedAmount"]');
    expect(receivedAmountVal).toBe('28000');

    // Select Bagh-e-Hajiani Kareema from dropdown
    await page.selectOption('select[name="hallId"]', { label: 'Bagh-e-Hajiani Kareema' });

    // Assert amount fields are updated to 46000 automatically
    const amountVal2 = await page.inputValue('input[name="amount"]');
    expect(amountVal2).toBe('46000');
  });

  test('Module 5.6: Expense Dynamic Sub-Type Form Logic', async ({ page }) => {
    page.setDefaultTimeout(15000);

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@erp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Navigate to quick add expense
    await page.goto(`${BASE_URL}/bank-vouchers/expense/new`);
    await expect(page.locator('text=Add Expense').first()).toBeVisible({ timeout: 15000 });

    // Click "Bus Expense" button
    await page.click('button:has-text("Bus Expense")');

    // Verify Expense Type dropdown is visible
    const selectDropdown = page.locator('select:near(label:has-text("Expense Type"))').first();
    await expect(selectDropdown).toBeVisible({ timeout: 15000 });

    // Select "Other" option from dropdown
    await selectDropdown.selectOption({ value: 'Other' });

    // Verify custom expense name input is visible
    const customInput = page.locator('input[placeholder="e.g. Battery Replacement"]');
    await expect(customInput).toBeVisible({ timeout: 15000 });
  });

  test('Module 5.7: Hall Expense Dynamic Sub-Type Form Logic', async ({ page }) => {
    page.setDefaultTimeout(15000);

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@erp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Navigate to quick add expense
    await page.goto(`${BASE_URL}/bank-vouchers/expense/new`);
    await expect(page.locator('text=Add Expense').first()).toBeVisible({ timeout: 15000 });

    // Click "Hall Expense" button
    await page.click('button:has-text("Hall Expense")');

    // Verify Hall dropdown is visible
    const hallSelect = page.locator('select:near(label:has-text("Hall"))').first();
    await expect(hallSelect).toBeVisible({ timeout: 15000 });

    // Verify Expense Type dropdown is visible
    const selectDropdown = page.locator('select:near(label:has-text("Expense Type"))').first();
    await expect(selectDropdown).toBeVisible({ timeout: 15000 });

    // Select "Other" option from dropdown
    await selectDropdown.selectOption({ value: 'Other' });

    // Verify custom expense name input is visible
    const customInput = page.locator('input[placeholder="e.g. Glass Replacement"]');
    await expect(customInput).toBeVisible({ timeout: 15000 });
  });

  test('Module 5.8: Donation Received Custom Type Form Logic', async ({ page }) => {
    page.setDefaultTimeout(15000);

    // 1. Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@erp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // 2. Navigate to new donation received form
    await page.goto(`${BASE_URL}/donations-received/new`);

    // 3. Verify custom input is not visible initially
    const customInput = page.locator('input[placeholder="Enter Donation Type"]');
    await expect(customInput).not.toBeVisible();

    // 4. Select CUSTOM and verify custom input is visible
    await page.selectOption('select[required]:has(option:has-text("GENERAL DONATION"))', 'CUSTOM');
    await expect(customInput).toBeVisible();

    // 5. Select ZAKAT and verify custom input is hidden
    await page.selectOption('select[required]:has(option:has-text("GENERAL DONATION"))', 'ZAKAT');
    await expect(customInput).not.toBeVisible();

    // 6. Select CUSTOM again, fill details, and submit
    await page.selectOption('select[required]:has(option:has-text("GENERAL DONATION"))', 'CUSTOM');
    await customInput.fill('Water Cooler Donation');
    
    // Quick Add Donor
    await page.click('button:has-text("Quick Add Donor")');
    await page.fill('input[placeholder="e.g. Muhammad Ali"]', 'Test E2E Donor');
    await page.click('button:has-text("Create & Select")');
    await page.waitForTimeout(1000);

    // Fill amount
    await page.fill('input[placeholder="0"]', '5000');

    // Submit form
    await page.click('button[type="submit"]');

    // 7. Verify redirection and that the custom label is displayed in the list
    await expect(page).toHaveURL(`${BASE_URL}/donations-received`);
    await expect(page.locator('text=Water Cooler Donation').first()).toBeVisible({ timeout: 15000 });
  });

  test('Module 6: Role Based Access Control (RBAC)', async ({ page }) => {
    page.setDefaultTimeout(15000);

    // 1. Login as Guest/Auditor
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'guest@erp.com');
    await page.fill('input[type="password"]', 'guest123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // 2. Access protected route: User Management (/users-roles)
    await page.goto(`${BASE_URL}/users-roles`);
    // Should display guard message
    await expect(page.locator('text=You don\'t have access to this page').first()).toBeVisible({ timeout: 15000 });

    // 3. Access protected route: Expenses (/expenses)
    await page.goto(`${BASE_URL}/expenses`);
    // Should display guard message
    await expect(page.locator('text=You don\'t have access to this page').first()).toBeVisible({ timeout: 15000 });
  });

});
