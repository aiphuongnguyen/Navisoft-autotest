// tests/cash-vsd-withdraw-specific.spec.ts
import { test, expect, Page } from '@playwright/test';

// Page Object Model for VSD Withdraw
class CashVSDWithdrawPage {
  constructor(public page: Page) {}

  // Selectors based on the PDF document
  get availableAmount() { return this.page.locator('[data-testid="cash-vsd-withdraw-statavailable"]'); }
  get beneficiaryAccount() { return this.page.locator('[data-testid="cash-vsd-withdraw-textbeneficiary"]'); }
  get transferAmountInput() { return this.page.locator('[data-testid="cash-vsd-withdraw-inputamount"]'); }
  get contentInput() { return this.page.locator('[data-testid="cash-vsd-withdraw-inputcontent"]'); }
  get resetButton() { return this.page.locator('[data-testid="cash-vsd-withdraw-btn-reset"]'); }
  get confirmButton() { return this.page.locator('[data-testid="cash-vsd-withdraw-btn-confirm"]'); }
  get modal() { return this.page.locator('[data-testid="cash-vsd-withdraw-modal"]'); }
  get modalConfirmButton() { return this.page.locator('[data-testid="cash-vsd-withdraw-modal-btnconfirm"]'); }
  get modalCancelButton() { return this.page.locator('[data-testid="cash-vsd-withdraw-modal-btncancel"]'); }

  // Helper methods
  async login() {
    await this.page.goto('/login');
    await this.page.fill('[data-testid="username"]', 'test2');
    await this.page.fill('[data-testid="password"]', '123456');
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToWithdrawPage() {
    await this.page.goto('/cash-vsd-withdraw');
    await this.page.waitForLoadState('networkidle');
  }

  async fillAmount(amount: string) {
    await this.transferAmountInput.fill(amount);
  }

  async fillContent(content: string) {
    await this.contentInput.fill(content);
  }

  async clickOutsideField() {
    await this.page.locator('body').click();
  }

  async getErrorMessage(): Promise<string> {
    const errorSelectors = [
      '.error-message',
      '[class*="error"]',
      '[class*="invalid"]',
      '.field-error',
      '[data-testid*="error"]'
    ];
    
    for (const selector of errorSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible()) {
        return await element.textContent() || '';
      }
    }
    return '';
  }

  async isConfirmButtonDisabled(): Promise<boolean> {
    return await this.confirmButton.isDisabled();
  }

  async getFieldValue(field: 'amount' | 'content'): Promise<string> {
    const element = field === 'amount' ? this.transferAmountInput : this.contentInput;
    return await element.inputValue();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async clickConfirm() {
    await this.confirmButton.click();
  }

  async waitForModal() {
    await this.modal.waitFor({ state: 'visible' });
  }

  async clickModalConfirm() {
    await this.modalConfirmButton.click();
  }

  async clickModalCancel() {
    await this.modalCancelButton.click();
  }

  async waitForToast() {
    await this.page.locator('[class*="toast"], [class*="notification"], [class*="alert"]').first().waitFor({ state: 'visible' });
  }

  async isOnHistoryPage(): Promise<boolean> {
    return this.page.url().includes('history') || 
           await this.page.locator('[data-testid*="history"], [href*="history"]').isVisible();
  }
}

test.describe('Cash VSD Withdraw - Specific Test Cases', () => {
  let withdrawPage: CashVSDWithdrawPage;

  test.beforeEach(async ({ page }) => {
    withdrawPage = new CashVSDWithdrawPage(page);
    await withdrawPage.login();
    await withdrawPage.navigateToWithdrawPage();
  });

  // TC_19: Valid amount within range accepted
  test('TC_19: Valid amount within range accepted (> 50,000 and ≤ available)', async () => {
    // Step 1: Enter amount 100,000,000
    await withdrawPage.fillAmount('100000000');
    
    // Step 2: Click outside field
    await withdrawPage.clickOutsideField();
    
    // Expected: Valid amount accepted, no error displayed
    const errorMessage = await withdrawPage.getErrorMessage();
    expect(errorMessage).toBe('');
  });

  // TC_20: Confirm button disabled when amount field empty
  test('TC_20: Confirm button disabled when amount field empty', async () => {
    // Leave Transfer Amount field empty (default state)
    const amountValue = await withdrawPage.getFieldValue('amount');
    expect(amountValue).toBe('');
    
    // Expected: Next button is disabled
    const isDisabled = await withdrawPage.isConfirmButtonDisabled();
    expect(isDisabled).toBe(true);
  });

  // TC_21: Error when transfer amount exceeds available balance
  test('TC_21: Verify error message when entered transfer amount exceeds available balance', async () => {
    // Step 1: Enter Transfer Amount = 500,000,000 (>Available amount)
    await withdrawPage.fillAmount('500000000');
    
    // Step 2: Click outside field
    await withdrawPage.clickOutsideField();
    
    // Expected: Error message "Amount must be > 50,000 and ≤ available" displays
    const errorMessage = await withdrawPage.getErrorMessage();
    expect(errorMessage).toContain('Amount must be > 50,000 and ≤ available');
    
    // Expected: Confirm button disabled
    const isDisabled = await withdrawPage.isConfirmButtonDisabled();
    expect(isDisabled).toBe(true);
  });

  // TC_22: Error when amount ≤ 50,000
  test('TC_22: Verify error message when entered amount ≤ 50,000', async () => {
    // Step 1: Enter amount = 40,000
    await withdrawPage.fillAmount('40000');
    
    // Step 2: Click outside field
    await withdrawPage.clickOutsideField();
    
    // Expected: Error message "Amount must be > 50,000 and ≤ available" displays
    const errorMessage = await withdrawPage.getErrorMessage();
    expect(errorMessage).toContain('Amount must be > 50,000 and ≤ available');
    
    // Expected: Confirm button disabled
    const isDisabled = await withdrawPage.isConfirmButtonDisabled();
    expect(isDisabled).toBe(true);
  });

  // TC_24: Valid content within character limit
  test('TC_24: Verify content accepted when enter valid content within character limit', async () => {
    // Step 1: Enter content "Nộp ký quỹ"
    await withdrawPage.fillContent('Nộp ký quỹ');
    
    // Step 2: Click outside field
    await withdrawPage.clickOutsideField();
    
    // Expected: Valid content accepted, no error displayed
    const errorMessage = await withdrawPage.getErrorMessage();
    expect(errorMessage).toBe('');
  });

  // TC_25: Error when content exceeds 255 characters
  test('TC_25: Verify error message when content exceeds 255 characters', async () => {
    // Step 1: Enter 256+ character string
    const longContent = 'A'.repeat(256);
    await withdrawPage.fillContent(longContent);
    
    // Step 2: Click outside field
    await withdrawPage.clickOutsideField();
    
    // Expected: Error message "Content should less than 255 characters" displays
    const errorMessage = await withdrawPage.getErrorMessage();
    expect(errorMessage).toContain('Content should less than 255 characters');
    
    // Expected: Confirm button disabled
    const isDisabled = await withdrawPage.isConfirmButtonDisabled();
    expect(isDisabled).toBe(true);
  });

  // TC_26: Content with exactly 255 characters accepted
  test('TC_26: Verify transfer content is accepted when entered with exactly 255 characters', async () => {
    // Step 1: Enter exactly 255 characters
    const exactContent = 'A'.repeat(255);
    await withdrawPage.fillContent(exactContent);
    
    // Step 2: Click outside field
    await withdrawPage.clickOutsideField();
    
    // Expected: Content with exactly 255 characters accepted, no error displayed
    const errorMessage = await withdrawPage.getErrorMessage();
    expect(errorMessage).toBe('');
  });

  // TC_27: Reset clears all editable fields
  test('TC_27: Verify all editable fields are cleared when clicking Reset button', async () => {
    // Step 1: Enter Transfer Amount = 100
    await withdrawPage.fillAmount('100');
    
    // Step 2: Enter content "Nộp ký quỹ"
    await withdrawPage.fillContent('Nộp ký quỹ');
    
    // Step 3: Click Reset button
    await withdrawPage.clickReset();
    
    // Expected: Reset clears fields: Transfer Amount, content
    const amountValue = await withdrawPage.getFieldValue('amount');
    const contentValue = await withdrawPage.getFieldValue('content');
    
    expect(amountValue).toBe('');
    expect(contentValue).toBe('');
  });

  // TC_28: Form submitted successfully with valid data
  test('TC_28: Verify form is submitted successfully with all valid input data', async () => {
    // Step 1: Enter Transfer Amount = 50,000
    await withdrawPage.fillAmount('50000');
    
    // Step 2: Enter content "Nộp ký quỹ"
    await withdrawPage.fillContent('Nộp ký quỹ');
    
    // Step 3: Click on confirm button
    await withdrawPage.clickConfirm();
    await withdrawPage.waitForModal();
    
    // Step 4: Click on confirm button on the modal confirm
    await withdrawPage.clickModalConfirm();
    
    // Expected: Dismiss pop-up, show toast, navigate to VSD withdraw history tab
    await withdrawPage.waitForToast();
    
    // Wait for navigation
    await withdrawPage.page.waitForTimeout(2000);
    const isOnHistory = await withdrawPage.isOnHistoryPage();
    expect(isOnHistory).toBe(true);
  });

  // TC_29: Form submitted successfully with empty content
  test('TC_29: Verify form is submitted successfully when content field is left empty', async () => {
    // Step 1: Enter Transfer Amount = 50,000
    await withdrawPage.fillAmount('50000');
    
    // Step 2: Leave content empty (default state)
    
    // Step 3: Click on confirm button
    await withdrawPage.clickConfirm();
    await withdrawPage.waitForModal();
    
    // Step 4: Click on confirm button on the modal confirm
    await withdrawPage.clickModalConfirm();
    
    // Expected: Dismiss pop-up, show toast, navigate to VSD withdraw history tab
    await withdrawPage.waitForToast();
    
    // Wait for navigation
    await withdrawPage.page.waitForTimeout(2000);
    const isOnHistory = await withdrawPage.isOnHistoryPage();
    expect(isOnHistory).toBe(true);
  });

  // TC_30: Back to VSD withdraw screen when click cancel
  test('TC_30: Verify back to VSD withdraw screen when click on cancel button', async () => {
    // Step 1: Enter Transfer Amount = 50,000
    await withdrawPage.fillAmount('50000');
    
    // Step 2: Leave content empty
    
    // Step 3: Click on confirm button
    await withdrawPage.clickConfirm();
    await withdrawPage.waitForModal();
    
    // Step 4: Click on Cancel button on the modal confirm
    await withdrawPage.clickModalCancel();
    
    // Expected: Dismiss pop-up and return to withdraw screen with value remaining
    await expect(withdrawPage.modal).toBeHidden();
    
    const amountValue = await withdrawPage.getFieldValue('amount');
    expect(amountValue).toBe('50000');
  });

  // TC_32: Transfer failed outside business hours
  test('TC_32: Verify that the withdraw failed outside of 08:00–15:55 business days', async () => {
    // Mock time to be outside business hours (e.g., 20:00)
    await withdrawPage.page.clock.install({ time: new Date('2024-01-15T20:00:00') });
    
    // Step 1: Enter Transfer Amount = 50,000
    await withdrawPage.fillAmount('50000');
    
    // Step 2: Leave content empty
    
    // Step 3: Click on confirm button
    await withdrawPage.clickConfirm();
    await withdrawPage.waitForModal();
    
    // Step 4: Click on confirm button on the modal confirm
    await withdrawPage.clickModalConfirm();
    
    // Expected: Error message: Transactions after business hours…
    const errorElement = withdrawPage.page.locator('text=*Transactions after business hours*').first();
    await expect(errorElement).toBeVisible();
  });

  // TC_33: Transfer failed on non-business days
  test('TC_33: Verify that the withdraw failed on non business days', async () => {
    // Mock time to be on weekend (Saturday)
    await withdrawPage.page.clock.install({ time: new Date('2024-01-13T10:00:00') }); // Saturday
    
    // Step 1: Enter Transfer Amount = 50,000
    await withdrawPage.fillAmount('50000');
    
    // Step 2: Leave content empty
    
    // Step 3: Click on confirm button
    await withdrawPage.clickConfirm();
    await withdrawPage.waitForModal();
    
    // Step 4: Click on confirm button on the modal confirm
    await withdrawPage.clickModalConfirm();
    
    // Expected: Error message: Transactions after business hours…
    const errorElement = withdrawPage.page.locator('text=*Transactions after business hours*').first();
    await expect(errorElement).toBeVisible();
  });
});