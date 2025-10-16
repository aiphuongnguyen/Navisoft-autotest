import { test, expect } from '@playwright/test';
import { APIRequestContext } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const API_ENDPOINTS = { LOGIN: '/api/auth/login' };
const TEST_CREDENTIALS = { username: 'linhdtt01', password: 'Y)7m0Fy!'};//, channel: 'OT' };
const UI_SELECTORS = {
  usernameInput: '[data-testid="login-input-username"]',
  passwordInput: '[data-testid="login-input-password"]',
  submitButton: '[data-testid="login-btn-submit"]'
};

test.describe('Login - API vs UI Data Comparison', () => {
  let apiContext: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({ baseURL: BASE_URL });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('Compare API response data vs UI displayed data', async ({ page }) => {
    // STEP 1: Call API để lấy data
    const apiResponse = await apiContext.post(API_ENDPOINTS.LOGIN, { data: TEST_CREDENTIALS });
    const apiData = await apiResponse.json();
    console.log('API trả về:', apiData);
    
    // STEP 2: Login qua UI
    await page.goto('/');
    await page.fill(UI_SELECTORS.usernameInput, TEST_CREDENTIALS.username);
    await page.fill(UI_SELECTORS.passwordInput, TEST_CREDENTIALS.password);
    await page.click(UI_SELECTORS.submitButton);
    await page.waitForTimeout(2000);
    
    // STEP 3: Extract data từ UI sau khi login
    const uiData = {
      id: await page.locator('p:has(strong:text("ID:"))').textContent(),
      name: await page.locator('p:has(strong:text("Tên:"))').textContent(),
      phone: await page.locator('p:has(strong:text("Số ĐT:"))').textContent(),
      username: await page.locator('p:has(strong:text("Username:"))').textContent(),
      email: await page.locator('p:has(strong:text("Email:"))').textContent(),
      accountType: await page.locator('p:has(strong:text("Loại TK:"))').textContent(),
      balance: await page.locator('p:has(strong:text("Số dư:"))').textContent()
    };
    console.log('UI hiển thị:', uiData);
    
    // STEP 4: So sánh API data vs UI data
    expect(uiData.id).toContain(apiData.data.id);
    expect(uiData.name).toContain(apiData.data.name);
    expect(uiData.phone).toContain(apiData.data.phone);
    expect(uiData.username).toContain(apiData.data.username);
    expect(uiData.email).toContain(apiData.data.email);
    expect(uiData.accountType).toContain(apiData.data.accountType);
    expect(uiData.balance).toContain(apiData.data.balance.toLocaleString('vi-VN'));
    
    console.log('So sánh hoàn tất');
  });
});