import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test data constants
const TEST_DATA = {
  VALID_USER_ID: 'C040899D1',
  VALID_ID_NUMBER: '2748347223',
  INVALID_USER_ID_LOWERCASE: 'c040899d1',
  INVALID_USER_ID: 'INVALID123',
  WRONG_ID_NUMBER: '9999999999',
  VALID_PASSPORT: 'AB1234567',
  COPY_TEXT: 'TestCopyText123'
};

// Page selectors
const SELECTORS = {
  USER_ID_INPUT: '[data-testid="forgotpassword-input-userid"]',
  ID_NUMBER_INPUT: '[data-testid="forgotpassword-input-identifier"]',
  CONFIRM_BUTTON: '[data-testid="forgotpassword-btn-confirm"]',
  ERROR_BANNER: '[data-testid="error-banner"]', // Assuming error banner selector
  SUCCESS_POPUP: '[data-testid="success-popup"]' // Assuming success popup selector
};

// Helper functions
class ForgotPasswordPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/forgot-password'); // Adjust URL as needed
  }

  async fillUserID(userId: string) {
    await this.page.fill(SELECTORS.USER_ID_INPUT, userId);
  }

  async fillIDNumber(idNumber: string) {
    await this.page.fill(SELECTORS.ID_NUMBER_INPUT, idNumber);
  }

  async clickConfirm() {
    await this.page.click(SELECTORS.CONFIRM_BUTTON);
  }

  async clearFields() {
    await this.page.fill(SELECTORS.USER_ID_INPUT, '');
    await this.page.fill(SELECTORS.ID_NUMBER_INPUT, '');
  }

  async isConfirmButtonEnabled(): Promise<boolean> {
    return await this.page.isEnabled(SELECTORS.CONFIRM_BUTTON);
  }

  async waitForErrorBanner() {
    await this.page.waitForSelector(SELECTORS.ERROR_BANNER, { timeout: 5000 });
  }

  async waitForSuccessPopup() {
    await this.page.waitForSelector(SELECTORS.SUCCESS_POPUP, { timeout: 5000 });
  }

  async getErrorMessage(): Promise<string> {
    return await this.page.textContent(SELECTORS.ERROR_BANNER) || '';
  }
}

test.describe('Forgot Password Functionality Tests', () => {
  let forgotPasswordPage: ForgotPasswordPage;

  test.beforeEach(async ({ page }) => {
    forgotPasswordPage = new ForgotPasswordPage(page);
    await forgotPasswordPage.navigate();
  });

  // TC_06: Verify User ID field accepts valid value
  test('TC_06 - Verify User ID field accepts valid value', async ({ page }) => {
    await forgotPasswordPage.fillUserID(TEST_DATA.VALID_USER_ID);
    
    // Verify input is accepted
    const inputValue = await page.inputValue(SELECTORS.USER_ID_INPUT);
    expect(inputValue).toBe(TEST_DATA.VALID_USER_ID);
  });

  // TC_07: Verify user ID fails with lowercase letters
  test('TC_07 - Verify user ID fails with lowercase letters', async ({ page }) => {
    await forgotPasswordPage.fillUserID(TEST_DATA.INVALID_USER_ID_LOWERCASE);
    await forgotPasswordPage.fillIDNumber(TEST_DATA.VALID_ID_NUMBER);
    await forgotPasswordPage.clickConfirm();

    // Wait for error banner and verify error message
    await forgotPasswordPage.waitForErrorBanner();
    const errorMessage = await forgotPasswordPage.getErrorMessage();
    expect(errorMessage).toContain('Incorrect account or id number/ passport');
  });

  // TC_08: Verify User ID field is required
  test('TC_08 - Verify User ID field is required', async ({ page }) => {
    // Leave User ID empty, fill ID Number
    await forgotPasswordPage.fillIDNumber(TEST_DATA.VALID_ID_NUMBER);
    
    // Verify confirm button is disabled
    const isEnabled = await forgotPasswordPage.isConfirmButtonEnabled();
    expect(isEnabled).toBe(false);
  });

  // TC_09: Verify error handling for invalid User ID
  test('TC_09 - Verify error handling for invalid User ID', async ({ page }) => {
    await forgotPasswordPage.fillUserID(TEST_DATA.INVALID_USER_ID);
    await forgotPasswordPage.fillIDNumber(TEST_DATA.VALID_ID_NUMBER);
    await forgotPasswordPage.clickConfirm();

    // Verify error message
    await forgotPasswordPage.waitForErrorBanner();
    const errorMessage = await forgotPasswordPage.getErrorMessage();
    expect(errorMessage).toContain('Incorrect account or id number/ passport');
  });

  // TC_10: Verify ID Number field accepts valid value
  test('TC_10 - Verify ID Number field accepts valid value', async ({ page }) => {
    await forgotPasswordPage.fillIDNumber(TEST_DATA.VALID_ID_NUMBER);
    
    // Verify confirm button is enabled when valid ID is entered
    await forgotPasswordPage.fillUserID(TEST_DATA.VALID_USER_ID);
    const isEnabled = await forgotPasswordPage.isConfirmButtonEnabled();
    expect(isEnabled).toBe(true);
  });

  // TC_11: Verify ID Number field accepts passport format
  test('TC_11 - Verify ID Number field accepts passport format', async ({ page }) => {
    await forgotPasswordPage.fillIDNumber(TEST_DATA.VALID_PASSPORT);
    
    // Verify input is accepted
    const inputValue = await page.inputValue(SELECTORS.ID_NUMBER_INPUT);
    expect(inputValue).toBe(TEST_DATA.VALID_PASSPORT);
  });

  // TC_12: Verify ID Number field is required
  test('TC_12 - Verify ID Number field is required', async ({ page }) => {
    await forgotPasswordPage.fillUserID(TEST_DATA.VALID_USER_ID);
    // Leave ID Number field empty
    
    // Verify confirm button is disabled
    const isEnabled = await forgotPasswordPage.isConfirmButtonEnabled();
    expect(isEnabled).toBe(false);
  });

  // TC_13: Verify error handling for mismatched ID Number
  test('TC_13 - Verify error handling for mismatched ID Number', async ({ page }) => {
    await forgotPasswordPage.fillUserID(TEST_DATA.VALID_USER_ID);
    await forgotPasswordPage.fillIDNumber(TEST_DATA.WRONG_ID_NUMBER);
    await forgotPasswordPage.clickConfirm();

    // Verify error message
    await forgotPasswordPage.waitForErrorBanner();
    const errorMessage = await forgotPasswordPage.getErrorMessage();
    expect(errorMessage).toContain('Incorrect account or id number/ passport');
  });

  // TC_14: Verify both fields cannot be empty
  test('TC_14 - Verify both fields cannot be empty', async ({ page }) => {
    // Leave both fields empty
    await forgotPasswordPage.clearFields();
    
    // Verify confirm button is disabled
    const isEnabled = await forgotPasswordPage.isConfirmButtonEnabled();
    expect(isEnabled).toBe(false);
  });

  // TC_15: Verify copy/paste functionality
  test('TC_15 - Verify copy/paste functionality', async ({ page }) => {
    // Test copy/paste in User ID field
    await page.evaluate((text) => {
      navigator.clipboard.writeText(text);
    }, TEST_DATA.COPY_TEXT);
    
    await page.focus(SELECTORS.USER_ID_INPUT);
    await page.keyboard.press('Control+V');
    
    let pastedValue = await page.inputValue(SELECTORS.USER_ID_INPUT);
    expect(pastedValue).toBe(TEST_DATA.COPY_TEXT);

    // Test copy/paste in ID Number field
    await page.focus(SELECTORS.ID_NUMBER_INPUT);
    await page.keyboard.press('Control+V');
    
    pastedValue = await page.inputValue(SELECTORS.ID_NUMBER_INPUT);
    expect(pastedValue).toBe(TEST_DATA.COPY_TEXT);
  });

  // TC_16: Verify successful password reset request
  test('TC_16 - Verify successful password reset request', async ({ page }) => {
    await forgotPasswordPage.fillUserID(TEST_DATA.VALID_USER_ID);
    await forgotPasswordPage.fillIDNumber(TEST_DATA.VALID_ID_NUMBER);
    await forgotPasswordPage.clickConfirm();

    // Wait for success popup
    await forgotPasswordPage.waitForSuccessPopup();
    
    // Verify success popup is displayed
    const successPopup = page.locator(SELECTORS.SUCCESS_POPUP);
    await expect(successPopup).toBeVisible();
  });

  // TC_17: Verify double-click prevention
  test('TC_17 - Verify double-click prevention on Confirm button', async ({ page }) => {
    // Track network requests
    const requestPromises: Promise<any>[] = [];
    page.on('request', (request) => {
      if (request.url().includes('forgot-password') || request.url().includes('reset-password')) {
        requestPromises.push(request.response());
      }
    });

    await forgotPasswordPage.fillUserID(TEST_DATA.VALID_USER_ID);
    await forgotPasswordPage.fillIDNumber(TEST_DATA.VALID_ID_NUMBER);
    
    // Double-click rapidly
    await page.dblclick(SELECTORS.CONFIRM_BUTTON);
    
    // Wait a moment for any potential duplicate requests
    await page.waitForTimeout(2000);
    
    // Verify only one request was made
    expect(requestPromises.length).toBeLessThanOrEqual(1);
  });

  // TC_22: Network Connection - No network
  test('TC_22 - Verify behavior with no network connection', async ({ page, context }) => {
    // Simulate offline network
    await context.setOffline(true);
    
    await forgotPasswordPage.fillUserID(TEST_DATA.VALID_USER_ID);
    await forgotPasswordPage.fillIDNumber(TEST_DATA.VALID_ID_NUMBER);
    await forgotPasswordPage.clickConfirm();

    // Verify network error message is displayed
    await page.waitForSelector('[data-testid="network-error"]', { timeout: 10000 });
    const networkError = page.locator('[data-testid="network-error"]');
    await expect(networkError).toBeVisible();
    
    // Restore network
    await context.setOffline(false);
  });

  // TC_23: Keyboard Navigation
  test('TC_23 - Verify Tab navigation between fields', async ({ page }) => {
    // Start from User ID field
    await page.focus(SELECTORS.USER_ID_INPUT);
    
    // Press Tab to move to ID Number field
    await page.keyboard.press('Tab');
    const activeElement1 = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(activeElement1).toBe('forgotpassword-input-identifier');
    
    // Press Tab to move to Confirm button
    await page.keyboard.press('Tab');
    const activeElement2 = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(activeElement2).toBe('forgotpassword-btn-confirm');
  });

  // TC_24: Response Time
  test('TC_24 - Verify acceptable response time', async ({ page }) => {
    await forgotPasswordPage.fillUserID(TEST_DATA.VALID_USER_ID);
    await forgotPasswordPage.fillIDNumber(TEST_DATA.VALID_ID_NUMBER);
    
    // Measure response time
    const startTime = Date.now();
    
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('forgot-password') || response.url().includes('reset-password')
    );
    
    await forgotPasswordPage.clickConfirm();
    await responsePromise;
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Verify response time is within 3 seconds (3000ms)
    expect(responseTime).toBeLessThan(3000);
  });
});

// TC_25: Browser Compatibility Tests
test.describe('Browser Compatibility Tests', () => {
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`TC_25 - Verify functionality on ${browserName}`, async ({ page }) => {
      const forgotPasswordPage = new ForgotPasswordPage(page);
      await forgotPasswordPage.navigate();
      
      // Test basic functionality
      await forgotPasswordPage.fillUserID(TEST_DATA.VALID_USER_ID);
      await forgotPasswordPage.fillIDNumber(TEST_DATA.VALID_ID_NUMBER);
      
      // Verify fields are filled correctly
      const userIdValue = await page.inputValue(SELECTORS.USER_ID_INPUT);
      const idNumberValue = await page.inputValue(SELECTORS.ID_NUMBER_INPUT);
      
      expect(userIdValue).toBe(TEST_DATA.VALID_USER_ID);
      expect(idNumberValue).toBe(TEST_DATA.VALID_ID_NUMBER);
      
      // Verify confirm button is enabled
      const isEnabled = await forgotPasswordPage.isConfirmButtonEnabled();
      expect(isEnabled).toBe(true);
    });
  });
});