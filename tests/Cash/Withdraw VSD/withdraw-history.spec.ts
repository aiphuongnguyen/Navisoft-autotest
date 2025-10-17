import { test, expect, Page } from '@playwright/test';

// Page Object Model for Cash Transfer History
class CashTransferHistoryPage {
  readonly page: Page;

  // Selectors
  readonly fromDatePicker = '[data-testid="cash-vsd-withdraw-historydatepicker-fromdate"]';
  readonly toDatePicker = '[data-testid="cash-vsd-withdraw-historydatepicker-todate"]';
  readonly statusDropdown = '[data-testid="cash-vsd-withdraw-historydropdown-status"]';
  readonly queryButton = '[data-testid="cash-vsd-withdraw-history-btnquery"]';
  
  // Table selectors
  readonly tableDateColumn = '[data-testid*="cash-vsd-withdraw-history-row"][data-testid*="-date"]';
  readonly tableBeneficiaryColumn = '[data-testid*="cash-vsd-withdraw-history-row"][data-testid*="-beneficiary"]';
  readonly tableAmountColumn = '[data-testid*="cash-vsd-withdraw-history-row"][data-testid*="-amount"]';
  readonly tableFeeColumn = '[data-testid*="cash-vsd-withdraw-history-row"][data-testid*="-fee"]';
  readonly tableStatusColumn = '[data-testid*="cash-vsd-withdraw-history-row"][data-testid*="-status"]';
  readonly tableRemarkColumn = '[data-testid*="cash-vsd-withdraw-history-row"][data-testid*="-remark"]';

  constructor(page: Page) {
    this.page = page;
  }

  async navigateToCashTransferHistory() {
    // Navigate to Cash Transfer History screen
    await this.page.goto('/cash-transfer-history'); // Adjust URL as needed
    await this.page.waitForLoadState('networkidle');
  }

  async login() {
    // Login with test credentials
    await this.page.goto('/login'); // Adjust login URL as needed
    await this.page.fill('[data-testid="username"]', 'test2');
    await this.page.fill('[data-testid="password"]', '123456');
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForLoadState('networkidle');
  }

  async setFromDate(date: string) {
    await this.page.fill(this.fromDatePicker, date);
  }

  async setToDate(date: string) {
    await this.page.fill(this.toDatePicker, date);
  }

  async selectStatus(status: string) {
    await this.page.click(this.statusDropdown);
    await this.page.click(`[data-testid="dropdown-option-${status}"]`); // Adjust selector as needed
  }

  async clickQuery() {
    await this.page.click(this.queryButton);
  }

  async getStatusDropdownOptions() {
    await this.page.click(this.statusDropdown);
    const options = await this.page.locator('[data-testid*="dropdown-option"]').allTextContents();
    return options;
  }

  async getDefaultStatusValue() {
    return await this.page.inputValue(this.statusDropdown);
  }

  async getTableRowByIndex(index: number) {
    return {
      date: `[data-testid="cash-vsd-withdraw-history-row${index}-date"]`,
      beneficiary: `[data-testid="cash-vsd-withdraw-history-row${index}-beneficiary"]`,
      amount: `[data-testid="cash-vsd-withdraw-history-row${index}-amount"]`,
      fee: `[data-testid="cash-vsd-withdraw-history-row${index}-fee"]`,
      status: `[data-testid="cash-vsd-withdraw-history-row${index}-status"]`,
      remark: `[data-testid="cash-vsd-withdraw-history-row${index}-remark"]`
    };
  }

  async getErrorMessage() {
    return await this.page.locator('[data-testid="error-message"]').textContent();
  }

  async isNoDataMessageVisible() {
    return await this.page.locator('text=No cash transfers found').isVisible();
  }
}

// Test Suite
test.describe('Cash Transfer History Tests', () => {
  let page: Page;
  let cashTransferPage: CashTransferHistoryPage;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    cashTransferPage = new CashTransferHistoryPage(page);
    
    // Login before each test
    await cashTransferPage.login();
    await cashTransferPage.navigateToCashTransferHistory();
  });

  // TC_00: Verify display with correct columns
  test('TC_00 - Verify display header with correct fields', async () => {
    await expect(page.locator(cashTransferPage.fromDatePicker)).toBeVisible();
    await expect(page.locator(cashTransferPage.toDatePicker)).toBeVisible();
    await expect(page.locator(cashTransferPage.statusDropdown)).toBeVisible();
    await expect(page.locator(cashTransferPage.queryButton)).toBeVisible();
  });

  test('TC_00 - Verify display table with correct columns', async () => {
    // Set date range and query to ensure table is populated
    await cashTransferPage.setFromDate('01/03/2025');
    await cashTransferPage.setToDate('31/05/2025');
    await cashTransferPage.clickQuery();
    
    // Check if columns exist (even if table is empty)
    await expect(page.locator('text=Date')).toBeVisible();
    await expect(page.locator('text=Beneficiary')).toBeVisible();
    await expect(page.locator('text=Transfer amount')).toBeVisible();
    await expect(page.locator('text=Fee')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
    await expect(page.locator('text=Remark')).toBeVisible();
  });

  // TC_18: Test Date Picker Function - 3 months exactly
  test('TC_18 - Verify system allows a date range exactly equal to 3 months', async () => {
    await cashTransferPage.setFromDate('01/03/2025');
    await cashTransferPage.setToDate('31/05/2025');
    await cashTransferPage.clickQuery();
    
    // Should not show error message
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });

  // TC_19: Verify same date acceptance
  test('TC_19 - Verify system accepts from date = to date', async () => {
    await cashTransferPage.setFromDate('01/03/2025');
    await cashTransferPage.setToDate('01/03/2025');
    await cashTransferPage.clickQuery();
    
    // Should not show error message
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });

  // TC_20: Verify error when to date < from date
  test('TC_20 - Verify error message when to date < from date', async () => {
    await cashTransferPage.setFromDate('15/06/2025');
    await cashTransferPage.setToDate('10/06/2025');
    await cashTransferPage.clickQuery();
    
    const errorMessage = await cashTransferPage.getErrorMessage();
    expect(errorMessage).toContain('To date must be >= from date');
  });

  // TC_21: Verify error when date range exceeds 3 months
  test('TC_21 - Verify error when date range exceeds 3 months', async () => {
    await cashTransferPage.setFromDate('01/01/2025');
    await cashTransferPage.setToDate('05/05/2025');
    await cashTransferPage.clickQuery();
    
    const errorMessage = await cashTransferPage.getErrorMessage();
    expect(errorMessage).toContain('Date range must be within 3 months');
  });

  // TC_24: Verify default status selection
  test('TC_24 - Verify default selection of status dropdown', async () => {
    const defaultValue = await cashTransferPage.getDefaultStatusValue();
    expect(defaultValue).toBe('All');
  });

  // TC_25: Verify all status options
  test('TC_25 - Verify all available status options in dropdown', async () => {
    const options = await cashTransferPage.getStatusDropdownOptions();
    expect(options).toEqual(['All', 'Pending', 'Completed', 'Rejected', 'Failed']);
  });

  // TC_26: Verify specific status selection
  test('TC_26 - Verify correct behavior when selecting specific status', async () => {
    await cashTransferPage.selectStatus('Pending');
    const selectedValue = await cashTransferPage.getDefaultStatusValue();
    expect(selectedValue).toBe('Pending');
  });

  // TC_27: Query with status = All
  test('TC_27 - Verify query executes correctly with status = All', async () => {
    await cashTransferPage.selectStatus('All');
    await cashTransferPage.setFromDate('01/03/2025');
    await cashTransferPage.setToDate('31/05/2025');
    await cashTransferPage.clickQuery();
    
    // Wait for results or no data message
    await page.waitForTimeout(2000);
    
    // Check if results are filtered correctly or no data message is shown
    const hasResults = await page.locator(cashTransferPage.tableStatusColumn).first().isVisible();
    if (!hasResults) {
      expect(await cashTransferPage.isNoDataMessageVisible()).toBeTruthy();
    }
  });

  // TC_28: Query with status = Pending
  test('TC_28 - Verify query executes correctly with status = Pending', async () => {
    await cashTransferPage.selectStatus('Pending');
    await cashTransferPage.setFromDate('01/03/2025');
    await cashTransferPage.setToDate('31/05/2025');
    await cashTransferPage.clickQuery();
    
    await page.waitForTimeout(2000);
    
    const hasResults = await page.locator(cashTransferPage.tableStatusColumn).first().isVisible();
    if (hasResults) {
      // Verify all results have Pending status
      const statusCells = await page.locator(cashTransferPage.tableStatusColumn).allTextContents();
      statusCells.forEach(status => {
        expect(status).toBe('Pending');
      });
    } else {
      expect(await cashTransferPage.isNoDataMessageVisible()).toBeTruthy();
    }
  });

  // TC_29: Query with status = Completed
  test('TC_29 - Verify query executes correctly with status = Completed', async () => {
    await cashTransferPage.selectStatus('Completed');
    await cashTransferPage.setFromDate('01/03/2025');
    await cashTransferPage.setToDate('31/05/2025');
    await cashTransferPage.clickQuery();
    
    await page.waitForTimeout(2000);
    
    const hasResults = await page.locator(cashTransferPage.tableStatusColumn).first().isVisible();
    if (hasResults) {
      const statusCells = await page.locator(cashTransferPage.tableStatusColumn).allTextContents();
      statusCells.forEach(status => {
        expect(status).toBe('Completed');
      });
    } else {
      expect(await cashTransferPage.isNoDataMessageVisible()).toBeTruthy();
    }
  });

  // TC_30: Query with status = Rejected
  test('TC_30 - Verify query executes correctly with status = Rejected', async () => {
    await cashTransferPage.selectStatus('Rejected');
    await cashTransferPage.setFromDate('01/03/2025');
    await cashTransferPage.setToDate('31/05/2025');
    await cashTransferPage.clickQuery();
    
    await page.waitForTimeout(2000);
    
    const hasResults = await page.locator(cashTransferPage.tableStatusColumn).first().isVisible();
    if (hasResults) {
      const statusCells = await page.locator(cashTransferPage.tableStatusColumn).allTextContents();
      statusCells.forEach(status => {
        expect(status).toBe('Rejected');
      });
    } else {
      expect(await cashTransferPage.isNoDataMessageVisible()).toBeTruthy();
    }
  });

  // TC_31: Query with status = Failed
  test('TC_31 - Verify query executes correctly with status = Failed', async () => {
    await cashTransferPage.selectStatus('Failed');
    await cashTransferPage.setFromDate('01/03/2025');
    await cashTransferPage.setToDate('31/05/2025');
    await cashTransferPage.clickQuery();
    
    await page.waitForTimeout(2000);
    
    const hasResults = await page.locator(cashTransferPage.tableStatusColumn).first().isVisible();
    if (hasResults) {
      const statusCells = await page.locator(cashTransferPage.tableStatusColumn).allTextContents();
      statusCells.forEach(status => {
        expect(status).toBe('Failed');
      });
    } else {
      expect(await cashTransferPage.isNoDataMessageVisible()).toBeTruthy();
    }
  });
});

// Helper class for test data
class TestDataHelper {
  static getValidDateRange() {
    return {
      fromDate: '01/03/2025',
      toDate: '31/05/2025'
    };
  }

  static getSameDateRange() {
    return {
      fromDate: '01/03/2025',
      toDate: '01/03/2025'
    };
  }

  static getInvalidDateRange() {
    return {
      fromDate: '15/06/2025',
      toDate: '10/06/2025'
    };
  }

  static getExceededDateRange() {
    return {
      fromDate: '01/01/2025',
      toDate: '05/05/2025'
    };
  }

  static getStatusOptions() {
    return ['All', 'Pending', 'Completed', 'Rejected', 'Failed'];
  }
}

export { CashTransferHistoryPage, TestDataHelper };