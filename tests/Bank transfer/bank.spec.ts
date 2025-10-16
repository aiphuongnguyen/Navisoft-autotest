import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test Data Constants
const TEST_DATA = {
  LOGIN: {
    USERNAME: 'test2',
    PASSWORD: '123456'
  },
  TRANSFER: {
    VALID_AMOUNT: '100',
    INVALID_HIGH_AMOUNT: '500000000',
    ZERO_AMOUNT: '0',
    NEGATIVE_AMOUNT: '-100000',
    VALID_CONTENT: 'Nộp ký quỹ',
    CONTENT_255_CHARS: 'A'.repeat(255),
    CONTENT_256_CHARS: 'A'.repeat(256)
  },
  ERROR_MESSAGES: {
    AMOUNT_EXCEEDS: 'Amount must be ≤ available',
    AMOUNT_ZERO: 'Amount must be greater than 0',
    CONTENT_LIMIT: 'Content should less than 255 characters',
    BUSINESS_HOURS: 'Transactions after business hours',
    NON_BUSINESS_DAY: 'Transactions are not allowed on non-business days'
  }
};

// Page Object Selectors
const SELECTORS = {
  ACCOUNT_NUMBER: '[data-testid="bank-transfer-dropdownacctno"]',
  AVAILABLE_AMOUNT: '[data-testid="bank-transfer-labelavailable"]',
  BENEFICIARY_ACCOUNT: '[data-testid="bank-transfer-dropdownbeneficiary"]',
  TRANSFER_AMOUNT: '[data-testid="bank-transfer-input-amount"]',
  CONTENT: '[data-testid="bank-transfer-input-content"]',
  RESET_BUTTON: '[data-testid="banktransfer-action-reset"]',
  NEXT_BUTTON: '[data-testid="banktransfer-action-next"]',
  ADD_BANK_ACCOUNT: '[data-testid="banktransfer-actionaddbank"]',
  MODAL_CONFIRM: '[data-testid="banktransfer-modal"]',
  CONFIRM_BUTTON: '[data-testid="banktransfer-modal-btnconfirm"]',
  CANCEL_BUTTON: '[data-testid="banktransfer-modal-btncancel"]'
};

// Helper Functions
class BankTransferHelper {
  constructor(private page: Page) {}

  async login() {
    // Implement login logic here
    await this.page.goto('/login');
    await this.page.fill('[data-testid="login-input-username"]', TEST_DATA.LOGIN.USERNAME);
    await this.page.fill('[data-testid="login-input-password"]', TEST_DATA.LOGIN.PASSWORD);
    await this.page.click('[data-testid="login-btn-submit"]');
    await this.page.waitForURL('**/dashboard**');
  }

  async navigateToBankTransfer() {
    await this.page.goto('/bank-transfer');
    await this.page.waitForLoadState('networkidle');
  }

  async fillTransferAmount(amount: string) {
    await this.page.fill(SELECTORS.TRANSFER_AMOUNT, amount);
  }

  async fillContent(content: string) {
    await this.page.fill(SELECTORS.CONTENT, content);
  }

  async clickOutsideField() {
    await this.page.click('body');
  }

  async resetForm() {
    await this.page.click(SELECTORS.RESET_BUTTON);
  }

  async clickNext() {
    await this.page.click(SELECTORS.NEXT_BUTTON);
  }

  async isNextButtonDisabled(): Promise<boolean> {
    return await this.page.isDisabled(SELECTORS.NEXT_BUTTON);
  }

  async waitForModal() {
    await this.page.waitForSelector(SELECTORS.MODAL_CONFIRM);
  }

  async confirmTransfer() {
    await this.page.click(SELECTORS.CONFIRM_BUTTON);
  }

  async cancelTransfer() {
    await this.page.click(SELECTORS.CANCEL_BUTTON);
  }

  async getErrorMessage(): Promise<string> {
    const errorElement = await this.page.locator('.error-message, .field-error, [class*="error"]').first();
    return await errorElement.textContent() || '';
  }

  async simulateBusinessHoursCheck(): Promise<boolean> {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Simulate business hours: Monday-Friday 08:00-16:00
    const isBusinessDay = day >= 1 && day <= 5;
    const isBusinessHour = hour >= 8 && hour <= 16;
    
    return isBusinessDay && isBusinessHour;
  }
}

test.describe('Bank Transfer Automation Tests', () => {
  let helper: BankTransferHelper;

  test.beforeEach(async ({ page }) => {
    helper = new BankTransferHelper(page);
    await helper.login();
    await helper.navigateToBankTransfer();
  });

  // TC_24: Transfer Amount Validation - Empty field
  test('TC_24: Verify Next button is disabled when transfer amount field is empty', async ({ page }) => {
    // Leave Transfer Amount field empty
    await helper.fillTransferAmount('');
    
    // Verify Next button is disabled
    const isDisabled = await helper.isNextButtonDisabled();
    expect(isDisabled).toBeTruthy();
  });

  // TC_25: Valid transfer amount within available balance
  test('TC_25: Verify valid transfer amount within available balance is accepted', async ({ page }) => {
    // Enter valid amount
    await helper.fillTransferAmount(TEST_DATA.TRANSFER.VALID_AMOUNT);
    await helper.clickOutsideField();
    
    // Wait for validation
    await page.waitForTimeout(1000);
    
    // Verify no error message and valid amount accepted
    const errorMessage = await helper.getErrorMessage();
    expect(errorMessage).toBe('');
    
    // Verify Next button is enabled
    const isDisabled = await helper.isNextButtonDisabled();
    expect(isDisabled).toBeFalsy();
  });

  // TC_26: Transfer amount exceeds available balance
  test('TC_26: Verify error when transfer amount exceeds available balance', async ({ page }) => {
    // Enter amount exceeding available balance
    await helper.fillTransferAmount(TEST_DATA.TRANSFER.INVALID_HIGH_AMOUNT);
    await helper.clickOutsideField();
    
    // Wait for validation
    await page.waitForTimeout(1000);
    
    // Verify error message displays
    const errorMessage = await helper.getErrorMessage();
    expect(errorMessage).toContain(TEST_DATA.ERROR_MESSAGES.AMOUNT_EXCEEDS);
    
    // Verify Next button is disabled
    const isDisabled = await helper.isNextButtonDisabled();
    expect(isDisabled).toBeTruthy();
  });

  // TC_27: Zero transfer amount
  test('TC_27: Verify error when transfer amount is zero', async ({ page }) => {
    // Enter zero amount
    await helper.fillTransferAmount(TEST_DATA.TRANSFER.ZERO_AMOUNT);
    await helper.clickOutsideField();
    
    // Wait for validation
    await page.waitForTimeout(1000);
    
    // Verify error message displays
    const errorMessage = await helper.getErrorMessage();
    expect(errorMessage).toContain(TEST_DATA.ERROR_MESSAGES.AMOUNT_ZERO);
    
    // Verify Next button is disabled
    const isDisabled = await helper.isNextButtonDisabled();
    expect(isDisabled).toBeTruthy();
  });

  // TC_28: Negative transfer amount
  test('TC_28: Verify negative values are prevented by input validation', async ({ page }) => {
    // Attempt to enter negative amount
    await helper.fillTransferAmount(TEST_DATA.TRANSFER.NEGATIVE_AMOUNT);
    await helper.clickOutsideField();
    
    // Wait for validation
    await page.waitForTimeout(1000);
    
    // Verify negative values are prevented or error shown
    const actualValue = await page.inputValue(SELECTORS.TRANSFER_AMOUNT);
    expect(actualValue).not.toBe(TEST_DATA.TRANSFER.NEGATIVE_AMOUNT);
    
    // Verify Next button is disabled
    const isDisabled = await helper.isNextButtonDisabled();
    expect(isDisabled).toBeTruthy();
  });

  // TC_29: Valid content within character limit
  test('TC_29: Verify valid content within character limit is accepted', async ({ page }) => {
    // Enter valid content
    await helper.fillContent(TEST_DATA.TRANSFER.VALID_CONTENT);
    await helper.clickOutsideField();
    
    // Wait for validation
    await page.waitForTimeout(1000);
    
    // Verify no error message
    const errorMessage = await helper.getErrorMessage();
    expect(errorMessage).toBe('');
  });

  // TC_30: Content exceeds 255 characters
  test('TC_30: Verify error when content exceeds 255 characters', async ({ page }) => {
    // Enter content with 256+ characters
    await helper.fillContent(TEST_DATA.TRANSFER.CONTENT_256_CHARS);
    await helper.clickOutsideField();
    
    // Wait for validation
    await page.waitForTimeout(1000);
    
    // Verify error message displays
    const errorMessage = await helper.getErrorMessage();
    expect(errorMessage).toContain(TEST_DATA.ERROR_MESSAGES.CONTENT_LIMIT);
    
    // Verify field has red border (check CSS class or style)
    const contentField = page.locator(SELECTORS.CONTENT);
    const hasErrorStyle = await contentField.evaluate(el => 
      window.getComputedStyle(el).borderColor.includes('rgb(255, 0, 0)') ||
      el.classList.contains('error') ||
      el.classList.contains('invalid')
    );
    expect(hasErrorStyle).toBeTruthy();
    
    // Verify Next button is disabled
    const isDisabled = await helper.isNextButtonDisabled();
    expect(isDisabled).toBeTruthy();
  });

  // TC_31: Content with exactly 255 characters
  test('TC_31: Verify content with exactly 255 characters is accepted', async ({ page }) => {
    // Enter content with exactly 255 characters
    await helper.fillContent(TEST_DATA.TRANSFER.CONTENT_255_CHARS);
    await helper.clickOutsideField();
    
    // Wait for validation
    await page.waitForTimeout(1000);
    
    // Verify no error message
    const errorMessage = await helper.getErrorMessage();
    expect(errorMessage).toBe('');
  });

  // TC_32: Reset button functionality
  test('TC_32: Verify Reset button clears all editable fields', async ({ page }) => {
    // Fill transfer amount and content
    await helper.fillTransferAmount(TEST_DATA.TRANSFER.VALID_AMOUNT);
    await helper.fillContent(TEST_DATA.TRANSFER.VALID_CONTENT);
    
    // Click Reset button
    await helper.resetForm();
    
    // Wait for reset action
    await page.waitForTimeout(500);
    
    // Verify fields are cleared
    const amountValue = await page.inputValue(SELECTORS.TRANSFER_AMOUNT);
    const contentValue = await page.inputValue(SELECTORS.CONTENT);
    
    expect(amountValue).toBe('');
    expect(contentValue).toBe('');
  });

  // TC_33: Form submission with all valid data
  test('TC_33: Verify form submits successfully with all valid input data', async ({ page }) => {
    // Fill valid data
    await helper.fillTransferAmount(TEST_DATA.TRANSFER.VALID_AMOUNT);
    await helper.fillContent(TEST_DATA.TRANSFER.VALID_CONTENT);
    
    // Click Next button
    await helper.clickNext();
    
    // Wait for modal to appear
    await helper.waitForModal();
    
    // Click Confirm button
    await helper.confirmTransfer();
    
    // Wait for success response
    await page.waitForTimeout(2000);
    
    // Verify success toast or navigation to history screen
    const currentUrl = page.url();
    const hasSuccessToast = await page.locator('.toast-success, .success-message, [class*="success"]').isVisible();
    
    expect(currentUrl.includes('/history') || hasSuccessToast).toBeTruthy();
  });

  // TC_34: Form submission with empty content
  test('TC_34: Verify form submits successfully when content field is empty', async ({ page }) => {
    // Fill transfer amount only
    await helper.fillTransferAmount(TEST_DATA.TRANSFER.VALID_AMOUNT);
    
    // Click Next button
    await helper.clickNext();
    
    // Wait for modal
    await helper.waitForModal();
    
    // Click Confirm button
    await helper.confirmTransfer();
    
    // Wait for response
    await page.waitForTimeout(2000);
    
    // Verify success and navigation to history screen
    const currentUrl = page.url();
    expect(currentUrl).toContain('/history');
  });

  // TC_35: Cancel button functionality
  test('TC_35: Verify cancel button returns to bank transfer screen', async ({ page }) => {
    // Fill transfer amount
    await helper.fillTransferAmount(TEST_DATA.TRANSFER.VALID_AMOUNT);
    
    // Click Next button
    await helper.clickNext();
    
    // Wait for modal
    await helper.waitForModal();
    
    // Click Cancel button
    await helper.cancelTransfer();
    
    // Wait for modal dismissal
    await page.waitForTimeout(1000);
    
    // Verify modal is dismissed and values remain
    const isModalVisible = await page.locator(SELECTORS.MODAL_CONFIRM).isVisible();
    expect(isModalVisible).toBeFalsy();
    
    // Verify values are preserved
    const amountValue = await page.inputValue(SELECTORS.TRANSFER_AMOUNT);
    expect(amountValue).toBe(TEST_DATA.TRANSFER.VALID_AMOUNT);
  });

  // TC_36: Add/Remove Bank Account navigation
  test('TC_36: Verify navigation to Add/Remove Bank Account screen', async ({ page }) => {
    // Click Add/Remove bank account button
    await page.click(SELECTORS.ADD_BANK_ACCOUNT);
    
    // Wait for navigation
    await page.waitForTimeout(1000);
    
    // Verify navigation to Add/Remove bank account screen
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(add-remove-bank|bank-account)/);
  });

  // TC_37: Transfer failed outside business hours (weekdays)
  test('TC_37: Verify transfer fails outside business hours on weekdays', async ({ page }) => {
    // Mock time using page.clock (Playwright built-in)
    const mockDate = new Date();
    mockDate.setHours(18, 0, 0, 0); // 6:00 PM
    mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 2); // Tuesday
    
    await page.clock.setFixedTime(mockDate);
    
    // Rest of your test code remains the same
    await helper.fillTransferAmount(TEST_DATA.TRANSFER.VALID_AMOUNT);
    await helper.fillContent(TEST_DATA.TRANSFER.VALID_CONTENT);
    
    await helper.clickNext();
    await helper.waitForModal();
    await helper.confirmTransfer();
    
    await page.waitForTimeout(2000);
    
    const errorMessage = await helper.getErrorMessage();
    expect(errorMessage).toContain(TEST_DATA.ERROR_MESSAGES.BUSINESS_HOURS);
  });

  // TC_38: Transfer failed on non-business days
  test('TC_38: Verify transfer fails on non-business days', async ({ page }) => {
    // Mock time to be weekend (Sunday at 10:00 AM)
    const mockDate = new Date();
    mockDate.setHours(10, 0, 0, 0); // 10:00 AM (business hours)
    mockDate.setDate(mockDate.getDate() - mockDate.getDay()); // Sunday
    
    await page.clock.setFixedTime(mockDate);
    
    // Fill valid data
    await helper.fillTransferAmount(TEST_DATA.TRANSFER.VALID_AMOUNT);
    await helper.fillContent(TEST_DATA.TRANSFER.VALID_CONTENT);
    
    // Click Next and Confirm
    await helper.clickNext();
    await helper.waitForModal();
    await helper.confirmTransfer();
    
    // Wait for response
    await page.waitForTimeout(2000);
    
    // Verify error message for non-business days
    const errorMessage = await helper.getErrorMessage();
    expect(errorMessage).toContain(TEST_DATA.ERROR_MESSAGES.NON_BUSINESS_DAY);
  });
  });

