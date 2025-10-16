import { test, expect, Page } from '@playwright/test';

// Page Object Model for Bank Transfer History
class BankTransferHistoryPage {
  constructor(private page: Page) {}

  // Selectors
  readonly fromDatePicker = '[data-testid="bank-transfer-historydatepicker-fromdate"]';
  readonly toDatePicker = '[data-testid="bank-transfer-historydatepicker-todate"]';
  readonly statusDropdown = '[data-testid="bank-transfer-historydropdown-status"]';
  readonly queryButton = '[data-testid="bank-transfer-history-btnquery"]';
  
  // Table selectors
  getTableRowDate = (index: number) => `[data-testid="bank-transfer-history-row${index}-date"]`;
  getTableRowBeneficiary = (index: number) => `[data-testid="bank-transfer-history-row${index}-beneficiary"]`;
  getTableRowAmount = (index: number) => `[data-testid="bank-transfer-history-row${index}-amount"]`;
  getTableRowFee = (index: number) => `[data-testid="bank-transfer-history-row${index}-fee"]`;
  getTableRowStatus = (index: number) => `[data-testid="bank-transfer-history-row${index}-status"]`;
  getTableRowRemark = (index: number) => `[data-testid="bank-transfer-history-row${index}-remark"]`;

  // Helper methods
  async selectFromDate(date: string) {
    await this.page.fill(this.fromDatePicker, date);
  }

  async selectToDate(date: string) {
    await this.page.fill(this.toDatePicker, date);
  }

  async selectStatus(status: string) {
    await this.page.click(this.statusDropdown);
    await this.page.click(`text="${status}"`);
  }

  async clickQuery() {
    await this.page.click(this.queryButton);
  }

  async getStatusDropdownOptions() {
    await this.page.click(this.statusDropdown);
    const options = await this.page.$$eval('option, [role="option"]', elements => 
      elements.map(el => el.textContent?.trim())
    );
    return options;
  }

  async getSelectedStatus() {
    return await this.page.textContent(this.statusDropdown);
  }

  async isErrorMessageVisible(message: string) {
    return await this.page.isVisible(`text="${message}"`);
  }

  async isEmptyStateVisible() {
    return await this.page.isVisible('text="No cash transfers found"');
  }

  async getTableRowCount() {
    const rows = await this.page.$$('[data-testid*="bank-transfer-history-row"]');
    return rows.length;
  }

  async getTableRowStatusText(index: number) {
    return await this.page.textContent(this.getTableRowStatus(index));
  }
}

// Test setup
test.beforeEach(async ({ page }) => {
  // Login with test credentials
  await page.goto('/login');
  await page.fill('[name="username"]', 'test2');
  await page.fill('[name="password"]', '123456');
  await page.click('[type="submit"]');
  
  // Navigate to Bank Transfer History screen
  await page.goto('/bank-transfer-history');
  await page.waitForLoadState('networkidle');
});

test.describe('Bank Transfer History Tests', () => {
  
  // TC_00: Verify display with correct columns
  test('TC_00: Verify display header with correct fields', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    // Verify header fields are visible
    await expect(page.locator(bankTransferPage.fromDatePicker)).toBeVisible();
    await expect(page.locator(bankTransferPage.toDatePicker)).toBeVisible();
    await expect(page.locator(bankTransferPage.statusDropdown)).toBeVisible();
    await expect(page.locator(bankTransferPage.queryButton)).toBeVisible();
  });

  test('TC_00: Verify display table with correct columns', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    // Check table headers/columns exist (assuming table structure)
    await expect(page.locator('text="Date"')).toBeVisible();
    await expect(page.locator('text="Beneficiary"')).toBeVisible();
    await expect(page.locator('text="Transfer amount"')).toBeVisible();
    await expect(page.locator('text="Fee"')).toBeVisible();
    await expect(page.locator('text="Status"')).toBeVisible();
    await expect(page.locator('text="Remark"')).toBeVisible();
  });

  // TC_18: Test Date Picker Function - 3 months exactly
  test('TC_18: Verify system allows a date range exactly equal to 3 months', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    await bankTransferPage.selectFromDate('01/03/2025');
    await bankTransferPage.selectToDate('31/05/2025');
    await bankTransferPage.clickQuery();
    
    // Verify no error message is displayed
    await expect(page.locator('text="Date range must be within 3 months"')).not.toBeVisible();
    await expect(page.locator('text="To date must be >= from date"')).not.toBeVisible();
  });

  // TC_19: Same from date and to date
  test('TC_19: Verify system accepts from date = to date', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    await bankTransferPage.selectFromDate('01/03/2025');
    await bankTransferPage.selectToDate('01/03/2025');
    await bankTransferPage.clickQuery();
    
    // Verify no error message is displayed
    await expect(page.locator('text="Date range must be within 3 months"')).not.toBeVisible();
    await expect(page.locator('text="To date must be >= from date"')).not.toBeVisible();
  });

  // TC_20: To date < from date error
  test('TC_20: Verify error message when to date < from date', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    await bankTransferPage.selectFromDate('15/06/2025');
    await bankTransferPage.selectToDate('10/06/2025');
    await bankTransferPage.clickQuery();
    
    // Verify error message is displayed
    await expect(page.locator('text="To date must be >= from date"')).toBeVisible();
  });

  // TC_21: Date range exceeds 3 months
  test('TC_21: Verify error when date range exceeds 3 months', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    await bankTransferPage.selectFromDate('01/01/2025');
    await bankTransferPage.selectToDate('05/05/2025');
    await bankTransferPage.clickQuery();
    
    // Verify error message is displayed
    await expect(page.locator('text="Date range must be within 3 months"')).toBeVisible();
  });

  // TC_24: Verify default selection of status dropdown
  test('TC_24: Verify default selection of status dropdown', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    // Check default status is "All"
    const defaultStatus = await bankTransferPage.getSelectedStatus();
    expect(defaultStatus).toBe('All');
  });

  // TC_25: Verify all available status options
  test('TC_25: Verify all available status options in dropdown', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    const options = await bankTransferPage.getStatusDropdownOptions();
    expect(options).toEqual(['All', 'Pending', 'Completed', 'Rejected', 'Failed']);
  });

  // TC_26: Verify selecting specific status
  test('TC_26: Verify selecting Pending status', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    await bankTransferPage.selectStatus('Pending');
    
    // Verify status is selected and displayed
    const selectedStatus = await bankTransferPage.getSelectedStatus();
    expect(selectedStatus).toBe('Pending');
  });

  // TC_27: Query with status = All
  test('TC_27: Verify query executes correctly with status = All', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    await bankTransferPage.selectStatus('All');
    await bankTransferPage.selectFromDate('01/03/2025');
    await bankTransferPage.selectToDate('31/05/2025');
    await bankTransferPage.clickQuery();
    
    // Wait for results or empty state
    await page.waitForTimeout(2000);
    
    // Check if results are displayed or empty state is shown
    const isEmpty = await bankTransferPage.isEmptyStateVisible();
    
    if (!isEmpty) {
      // Verify results are displayed with various statuses
      const rowCount = await bankTransferPage.getTableRowCount();
      expect(rowCount).toBeGreaterThan(0);
    } else {
      // Verify empty state message
      await expect(page.locator('text="No cash transfers found"')).toBeVisible();
    }
  });

  // TC_28: Query with status = Pending
  test('TC_28: Verify query executes correctly with status = Pending', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    await bankTransferPage.selectStatus('Pending');
    await bankTransferPage.selectFromDate('01/03/2025');
    await bankTransferPage.selectToDate('31/05/2025');
    await bankTransferPage.clickQuery();
    
    await page.waitForTimeout(2000);
    
    const isEmpty = await bankTransferPage.isEmptyStateVisible();
    
    if (!isEmpty) {
      // Verify all results have Pending status
      const rowCount = await bankTransferPage.getTableRowCount();
      for (let i = 0; i < rowCount; i++) {
        const status = await bankTransferPage.getTableRowStatusText(i);
        expect(status).toBe('Pending');
      }
    } else {
      await expect(page.locator('text="No cash transfers found"')).toBeVisible();
    }
  });

  // TC_29: Query with status = Completed
  test('TC_29: Verify query executes correctly with status = Completed', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    await bankTransferPage.selectStatus('Completed');
    await bankTransferPage.selectFromDate('01/03/2025');
    await bankTransferPage.selectToDate('31/05/2025');
    await bankTransferPage.clickQuery();
    
    await page.waitForTimeout(2000);
    
    const isEmpty = await bankTransferPage.isEmptyStateVisible();
    
    if (!isEmpty) {
      // Verify all results have Completed status
      const rowCount = await bankTransferPage.getTableRowCount();
      for (let i = 0; i < rowCount; i++) {
        const status = await bankTransferPage.getTableRowStatusText(i);
        expect(status).toBe('Completed');
      }
    } else {
      await expect(page.locator('text="No cash transfers found"')).toBeVisible();
    }
  });

  // TC_30: Query with status = Rejected
  test('TC_30: Verify query executes correctly with status = Rejected', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    await bankTransferPage.selectStatus('Rejected');
    await bankTransferPage.selectFromDate('01/03/2025');
    await bankTransferPage.selectToDate('31/05/2025');
    await bankTransferPage.clickQuery();
    
    await page.waitForTimeout(2000);
    
    const isEmpty = await bankTransferPage.isEmptyStateVisible();
    
    if (!isEmpty) {
      // Verify all results have Rejected status
      const rowCount = await bankTransferPage.getTableRowCount();
      for (let i = 0; i < rowCount; i++) {
        const status = await bankTransferPage.getTableRowStatusText(i);
        expect(status).toBe('Rejected');
      }
    } else {
      await expect(page.locator('text="No cash transfers found"')).toBeVisible();
    }
  });

  // TC_31: Query with status = Failed
  test('TC_31: Verify query executes correctly with status = Failed', async ({ page }) => {
    const bankTransferPage = new BankTransferHistoryPage(page);
    
    await bankTransferPage.selectStatus('Failed');
    await bankTransferPage.selectFromDate('01/03/2025');
    await bankTransferPage.selectToDate('31/05/2025');
    await bankTransferPage.clickQuery();
    
    await page.waitForTimeout(2000);
    
    const isEmpty = await bankTransferPage.isEmptyStateVisible();
    
    if (!isEmpty) {
      // Verify all results have Failed status
      const rowCount = await bankTransferPage.getTableRowCount();
      for (let i = 0; i < rowCount; i++) {
        const status = await bankTransferPage.getTableRowStatusText(i);
        expect(status).toBe('Failed');
      }
    } else {
      await expect(page.locator('text="No cash transfers found"')).toBeVisible();
    }
  });
});