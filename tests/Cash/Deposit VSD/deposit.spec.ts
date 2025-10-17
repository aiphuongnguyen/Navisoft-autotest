import { test, expect, Page } from '@playwright/test';

// Helper class for VSD Deposit page interactions
class VSDDepositPage {
  constructor(private page: Page) {}

  // Locators
  get accountNumber() { return this.page.getByTestId('vsd-depositinput-acctno'); }
  get availableAmount() { return this.page.getByTestId('vsd-depositlabel-available'); }
  get transferAmount() { return this.page.getByTestId('vsd-depositinput-amount'); }
  get content() { return this.page.getByTestId('vsd-depositinput-content'); }
  get resetButton() { return this.page.getByTestId('vsd-depositbtn-reset'); }
  get confirmButton() { return this.page.getByTestId('vsd-depositbtn-confirm'); }
  get modal() { return this.page.getByTestId('vsd-depositmodal'); }
  get modalConfirmButton() { return this.page.getByTestId('vsd-depositmodal-btn-confirm'); }
  get modalCancelButton() { return this.page.getByTestId('vsd-depositmodal-btn-cancel'); }

  // Helper methods
  async login() {
    // Implement login logic here based on your application
    // This is a placeholder - adjust according to your login flow
    await this.page.fill('[data-testid="username"]', 'test2');
    await this.page.fill('[data-testid="password"]', '123456');
    await this.page.click('[data-testid="login-button"]');
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async getAvailableBalance(): Promise<number> {
    const balanceText = await this.availableAmount.textContent();
    // Extract number from text - adjust regex based on your format
    const balance = balanceText?.match(/[\d,]+/)?.[0]?.replace(/,/g, '');
    return balance ? parseInt(balance) : 0;
  }

  async fillTransferAmount(amount: string) {
    await this.transferAmount.clear();
    await this.transferAmount.fill(amount);
  }

  async fillContent(content: string) {
    await this.content.clear();
    await this.content.fill(content);
  }

  async clickOutsideField() {
    await this.page.click('body');
  }

  async isConfirmButtonDisabled(): Promise<boolean> {
    return await this.confirmButton.isDisabled();
  }

  async getErrorMessage(): Promise<string | null> {
    // Adjust selector based on your error message implementation
    const errorElement = this.page.locator('.error-message, .field-error, [class*="error"]').first();
    return await errorElement.isVisible() ? await errorElement.textContent() : null;
  }

  async hasRedBorder(element: any): Promise<boolean> {
    const borderColor = await element.evaluate((el: HTMLElement) => 
      getComputedStyle(el).borderColor
    );
    return borderColor.includes('rgb(255, 0, 0)') || borderColor.includes('red');
  }

  async waitForToast() {
    await this.page.waitForSelector('[class*="toast"], [class*="notification"]', { 
      state: 'visible' 
    });
  }

  async waitForHistoryNavigation() {
    await this.page.waitForURL(/.*history.*|.*deposit.*history.*/);
  }

  // Set system time for business hours testing
  async setSystemTime(dateTime: Date) {
    await this.page.addInitScript(`{
      Date.now = () => ${dateTime.getTime()};
      const OriginalDate = Date;
      Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(${dateTime.getTime()});
          } else {
            super(...args);
          }
        }
        static now() {
          return ${dateTime.getTime()};
        }
      }
    }`);
  }
}

test.describe('VSD Deposit - Cash Transfer Tests', () => {
  let vsdPage: VSDDepositPage;

  test.beforeEach(async ({ page }) => {
    vsdPage = new VSDDepositPage(page);
    
    // Login and navigate to VSD deposit page
    await page.goto('/'); // Adjust base URL
    await vsdPage.login();
    await page.goto('/vsd-deposit'); // Adjust VSD deposit page URL
    await vsdPage.waitForPageLoad();
  });

  test('TC_19: Valid amount within range accepted (> 50,000 and ≤ available)', async ({ page }) => {
    await test.step('Enter valid amount 100,000', async () => {
      await vsdPage.fillTransferAmount('100000');
    });

    await test.step('Click outside field', async () => {
      await vsdPage.clickOutsideField();
    });

    await test.step('Verify valid amount accepted, no error displayed', async () => {
      const errorMessage = await vsdPage.getErrorMessage();
      expect(errorMessage).toBeNull();
      
      const isDisabled = await vsdPage.isConfirmButtonDisabled();
      expect(isDisabled).toBeFalsy();
    });
  });

  test('TC_20: Confirm button disabled when amount field empty', async ({ page }) => {
    await test.step('Leave Transfer Amount field empty', async () => {
      await vsdPage.transferAmount.clear();
    });

    await test.step('Verify Next button is disabled', async () => {
      const isDisabled = await vsdPage.isConfirmButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_21: Error message when transfer amount exceeds available balance', async ({ page }) => {
    await test.step('Enter Transfer Amount = 500,000,000 (>Available amount)', async () => {
      await vsdPage.fillTransferAmount('500000000');
    });

    await test.step('Click outside field', async () => {
      await vsdPage.clickOutsideField();
    });

    await test.step('Verify error message and confirm button disabled', async () => {
      const errorMessage = await vsdPage.getErrorMessage();
      expect(errorMessage).toContain('Amount must be > 50,000 and ≤ available');
      
      const isDisabled = await vsdPage.isConfirmButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_22: Error message when entered amount ≤ 50,000', async ({ page }) => {
    await test.step('Enter amount = 40,000', async () => {
      await vsdPage.fillTransferAmount('40000');
    });

    await test.step('Click outside field', async () => {
      await vsdPage.clickOutsideField();
    });

    await test.step('Verify error message and confirm button disabled', async () => {
      const errorMessage = await vsdPage.getErrorMessage();
      expect(errorMessage).toContain('Amount must be > 50,000 and ≤ available');
      
      const isDisabled = await vsdPage.isConfirmButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_24: Valid content accepted within character limit', async ({ page }) => {
    await test.step('Enter content "Nộp ký quỹ"', async () => {
      await vsdPage.fillContent('Nộp ký quỹ');
    });

    await test.step('Click outside field', async () => {
      await vsdPage.clickOutsideField();
    });

    await test.step('Verify valid content accepted, no error displayed', async () => {
      const errorMessage = await vsdPage.getErrorMessage();
      expect(errorMessage).toBeNull();
    });
  });

  test('TC_25: Error message when content exceeds 255 characters', async ({ page }) => {
    const longContent = 'a'.repeat(256);

    await test.step('Enter 256+ character string', async () => {
      await vsdPage.fillContent(longContent);
    });

    await test.step('Click outside field', async () => {
      await vsdPage.clickOutsideField();
    });

    await test.step('Verify error message with red border and confirm button disabled', async () => {
      const errorMessage = await vsdPage.getErrorMessage();
      expect(errorMessage).toContain('Content should less than 255 characters');
      
      const hasRedBorder = await vsdPage.hasRedBorder(vsdPage.content);
      expect(hasRedBorder).toBeTruthy();
      
      const isDisabled = await vsdPage.isConfirmButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_26: Content with exactly 255 characters accepted', async ({ page }) => {
    const exactContent = 'a'.repeat(255);

    await test.step('Enter exactly 255 characters', async () => {
      await vsdPage.fillContent(exactContent);
    });

    await test.step('Click outside field', async () => {
      await vsdPage.clickOutsideField();
    });

    await test.step('Verify content accepted, no error displayed', async () => {
      const errorMessage = await vsdPage.getErrorMessage();
      expect(errorMessage).toBeNull();
    });
  });

  test('TC_27: Reset button clears all editable fields', async ({ page }) => {
    await test.step('Enter Transfer Amount and content', async () => {
      await vsdPage.fillTransferAmount('100000');
      await vsdPage.fillContent('Nộp ký quỹ');
    });

    await test.step('Click Reset button', async () => {
      await vsdPage.resetButton.click();
    });

    await test.step('Verify fields are cleared', async () => {
      const amountValue = await vsdPage.transferAmount.inputValue();
      const contentValue = await vsdPage.content.inputValue();
      
      expect(amountValue).toBe('');
      expect(contentValue).toBe('');
    });
  });

  test('TC_28: Form submitted successfully with all valid input data', async ({ page }) => {
    await test.step('Fill form with valid data', async () => {
      await vsdPage.fillTransferAmount('50000');
      await vsdPage.fillContent('Nộp ký quỹ');
    });

    await test.step('Click confirm button', async () => {
      await vsdPage.confirmButton.click();
    });

    await test.step('Click confirm button on modal', async () => {
      await expect(vsdPage.modal).toBeVisible();
      await vsdPage.modalConfirmButton.click();
    });

    await test.step('Verify success toast and navigation to history', async () => {
      await vsdPage.waitForToast();
      await vsdPage.waitForHistoryNavigation();
      
      expect(page.url()).toMatch(/.*history.*|.*deposit.*history.*/);
    });
  });

  test('TC_29: Form submitted successfully when content field is empty', async ({ page }) => {
    await test.step('Fill transfer amount only', async () => {
      await vsdPage.fillTransferAmount('50000');
      // Leave content empty
    });

    await test.step('Click confirm button', async () => {
      await vsdPage.confirmButton.click();
    });

    await test.step('Click confirm button on modal', async () => {
      await expect(vsdPage.modal).toBeVisible();
      await vsdPage.modalConfirmButton.click();
    });

    await test.step('Verify success toast and navigation to history', async () => {
      await vsdPage.waitForToast();
      await vsdPage.waitForHistoryNavigation();
      
      expect(page.url()).toMatch(/.*history.*|.*deposit.*history.*/);
    });
  });

  test('TC_30: Back to VSD deposit screen when click cancel button', async ({ page }) => {
    const originalUrl = page.url();

    await test.step('Fill form data', async () => {
      await vsdPage.fillTransferAmount('50000');
      // Leave content empty
    });

    await test.step('Click confirm button', async () => {
      await vsdPage.confirmButton.click();
    });

    await test.step('Click Cancel button on modal', async () => {
      await expect(vsdPage.modal).toBeVisible();
      await vsdPage.modalCancelButton.click();
    });

    await test.step('Verify return to deposit screen with values remaining', async () => {
      await expect(vsdPage.modal).toBeHidden();
      expect(page.url()).toBe(originalUrl);
      
      const amountValue = await vsdPage.transferAmount.inputValue();
      expect(amountValue).toBe('50000');
    });
  });

  test('TC_32: Transfer failed outside business hours (08:00-16:00)', async ({ page }) => {
    // Set time to outside business hours (e.g., 18:00)
    const outsideBusinessHours = new Date();
    outsideBusinessHours.setHours(18, 0, 0, 0);
    
    await test.step('Set system time outside business hours', async () => {
      await vsdPage.setSystemTime(outsideBusinessHours);
      await page.reload();
      await vsdPage.waitForPageLoad();
    });

    await test.step('Fill all required fields correctly', async () => {
      await vsdPage.fillTransferAmount('100000');
      await vsdPage.fillContent('Test transfer');
    });

    await test.step('Click Confirm button', async () => {
      await vsdPage.confirmButton.click();
      if (await vsdPage.modal.isVisible()) {
        await vsdPage.modalConfirmButton.click();
      }
    });

    await test.step('Verify error message for business hours', async () => {
      const errorMessage = await vsdPage.getErrorMessage();
      expect(errorMessage).toContain('Transactions after business hours');
    });
  });

  test('TC_33: Transfer failed on non-business days', async ({ page }) => {
    // Set time to weekend (Saturday)
    const weekend = new Date();
    weekend.setDate(weekend.getDate() + (6 - weekend.getDay())); // Set to Saturday
    weekend.setHours(10, 0, 0, 0); // 10:00 AM on Saturday

    await test.step('Set system time to weekend', async () => {
      await vsdPage.setSystemTime(weekend);
      await page.reload();
      await vsdPage.waitForPageLoad();
    });

    await test.step('Fill all required fields correctly', async () => {
      await vsdPage.fillTransferAmount('100000');
      await vsdPage.fillContent('Test transfer');
    });

    await test.step('Click Confirm button', async () => {
      await vsdPage.confirmButton.click();
      if (await vsdPage.modal.isVisible()) {
        await vsdPage.modalConfirmButton.click();
      }
    });

    await test.step('Verify error message for non-business days', async () => {
      const errorMessage = await vsdPage.getErrorMessage();
      expect(errorMessage).toContain('Transactions after business hours');
    });
  });
});