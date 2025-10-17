import { test, expect, Page } from '@playwright/test';

// Page Object Model for Cash Transfer History
class CashTransferHistoryPage {
  constructor(public page: Page) {}

  // Selectors
  private selectors = {
    transferTypeDropdown: '[data-testid="cash-transfer-historydropdown-type"]',
    fromDatePicker: '[data-testid="cash-transfer-historydatepicker-fromdate"]',
    toDatePicker: '[data-testid="cash-transfer-historydatepicker-todate"]',
    statusDropdown: '[data-testid="cash-transfer-historydropdown-status"]',
    queryButton: '[data-testid="cash-transfer-history-btnquery"]',
    noDataMessage: 'text="No cash transfers found"'
  };

  // Table row selectors
  getTableRowSelector(rowIndex: number, column: string) {
    return `[data-testid="cash-transfer-history-row${rowIndex}-${column}"]`;
  }

  // Helper methods
  async selectTransferType(type: string) {
    await this.page.click(this.selectors.transferTypeDropdown);
    await this.page.click(`text="${type}"`);
  }

  async selectStatus(status: string) {
    await this.page.click(this.selectors.statusDropdown);
    await this.page.click(`text="${status}"`);
  }

  async selectFromDate(date: string) {
    await this.page.fill(this.selectors.fromDatePicker, date);
  }

  async selectToDate(date: string) {
    await this.page.fill(this.selectors.toDatePicker, date);
  }

  async clickQuery() {
    await this.page.click(this.selectors.queryButton);
  }

  async getDropdownValue(selector: string): Promise<string> {
    return await this.page.inputValue(selector);
  }

  async getDropdownOptions(selector: string): Promise<string[]> {
    await this.page.click(selector);
    const options = await this.page.locator(`${selector} option`).allTextContents();
    return options;
  }

  async verifyTableColumns() {
    const expectedColumns = ['date', 'beneficiary', 'amount', 'fee', 'transtype', 'status', 'remark'];
    for (const column of expectedColumns) {
      await expect(this.page.locator(this.getTableRowSelector(1, column))).toBeVisible();
    }
  }

  async verifyFilterResults(transferType?: string, status?: string) {
    // Wait for results to load
    await this.page.waitForTimeout(2000);
    
    // Check if no data message appears or results are displayed
    const noDataVisible = await this.page.locator(this.selectors.noDataMessage).isVisible();
    
    if (!noDataVisible) {
      // Verify transfer type in results if specified
      if (transferType && transferType !== 'All') {
        const firstRowTransType = await this.page.locator(this.getTableRowSelector(1, 'transtype')).textContent();
        expect(firstRowTransType).toContain(transferType);
      }

      // Verify status in results if specified
      if (status && status !== 'All') {
        const firstRowStatus = await this.page.locator(this.getTableRowSelector(1, 'status')).textContent();
        expect(firstRowStatus).toContain(status);
      }
    }
  }

  async verifyErrorMessage(expectedMessage: string) {
    await expect(this.page.locator(`text="${expectedMessage}"`)).toBeVisible();
  }
}

// Test data constants
const TEST_CREDENTIALS = {
  username: 'test2',
  password: '123456'
};

const TEST_DATES = {
  validFromDate: '01/03/2025',
  validToDate: '31/05/2025',
  sameDate: '01/03/2025',
  invalidFromDate: '15/06/2025',
  invalidToDate: '10/06/2025',
  exceedFromDate: '01/01/2025',
  exceedToDate: '05/05/2025'
};

test.describe('Cash Transfer History Tests', () => {
  let cashTransferPage: CashTransferHistoryPage;

  test.beforeEach(async ({ page }) => {
    cashTransferPage = new CashTransferHistoryPage(page);
    
    // Login with test credentials
    await page.goto('/login');
    await page.fill('[data-testid="username"]', TEST_CREDENTIALS.username);
    await page.fill('[data-testid="password"]', TEST_CREDENTIALS.password);
    await page.click('[data-testid="login-button"]');
    
    // Navigate to Cash Transfer History screen
    await page.goto('/cash-transfer-history');
    await page.waitForLoadState('networkidle');
  });

  test('TC_00: Verify display with correct fields and columns', async () => {
    // Verify header fields are displayed
    await expect(cashTransferPage.page.locator('[data-testid="cash-transfer-historydropdown-type"]')).toBeVisible();
    await expect(cashTransferPage.page.locator('[data-testid="cash-transfer-historydatepicker-fromdate"]')).toBeVisible();
    await expect(cashTransferPage.page.locator('[data-testid="cash-transfer-historydatepicker-todate"]')).toBeVisible();
    await expect(cashTransferPage.page.locator('[data-testid="cash-transfer-historydropdown-status"]')).toBeVisible();
    await expect(cashTransferPage.page.locator('[data-testid="cash-transfer-history-btnquery"]')).toBeVisible();

    // Verify table columns
    await cashTransferPage.verifyTableColumns();
  });

  test('TC_20: Default transfer type selection', async () => {
    const defaultValue = await cashTransferPage.getDropdownValue('[data-testid="cash-transfer-historydropdown-type"]');
    expect(defaultValue).toBe('All');
  });

  test('TC_21: All transfer type options displayed', async () => {
    await cashTransferPage.page.click('[data-testid="cash-transfer-historydropdown-type"]');
    const options = ['All', 'To sub', 'To bank', 'VSD Withdraw', 'VSD Deposit'];
    
    for (const option of options) {
      await expect(cashTransferPage.page.locator(`text="${option}"`)).toBeVisible();
    }
  });

  test('TC_22: Specific transfer type selection', async () => {
    await cashTransferPage.selectTransferType('VSD Deposit');
    const selectedValue = await cashTransferPage.getDropdownValue('[data-testid="cash-transfer-historydropdown-type"]');
    expect(selectedValue).toBe('VSD Deposit');
  });

  test('TC_23: Query with transfer type "All"', async () => {
    await cashTransferPage.selectTransferType('All');
    await cashTransferPage.selectStatus('All');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults('All');
  });

  test('TC_24: Query with transfer type "To sub"', async () => {
    await cashTransferPage.selectTransferType('To sub');
    await cashTransferPage.selectStatus('All');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults('To sub');
  });

  test('TC_25: Query with transfer type "To bank"', async () => {
    await cashTransferPage.selectTransferType('To bank');
    await cashTransferPage.selectStatus('All');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults('To bank');
  });

  test('TC_26: Query with transfer type "VSD Withdraw"', async () => {
    await cashTransferPage.selectTransferType('VSD Withdraw');
    await cashTransferPage.selectStatus('All');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults('VSD Withdraw');
  });

  test('TC_27: Query with transfer type "VSD Deposit"', async () => {
    await cashTransferPage.selectTransferType('VSD Deposit');
    await cashTransferPage.selectStatus('All');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults('VSD Deposit');
  });

  test('TC_28: Date range exactly equal to 3 months', async () => {
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    // Should not show error message and query should execute
    await expect(cashTransferPage.page.locator('text="Date range must be within 3 months"')).not.toBeVisible();
  });

  test('TC_29: From date equals to date', async () => {
    await cashTransferPage.selectFromDate(TEST_DATES.sameDate);
    await cashTransferPage.selectToDate(TEST_DATES.sameDate);
    await cashTransferPage.clickQuery();
    
    // Should accept same date without error
    await expect(cashTransferPage.page.locator('text="To date must be >= from date"')).not.toBeVisible();
  });

  test('TC_30: Error when to date < from date', async () => {
    await cashTransferPage.selectFromDate(TEST_DATES.invalidFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.invalidToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyErrorMessage('To date must be >= from date');
  });

  test('TC_31: Error when date range exceeds 3 months', async () => {
    await cashTransferPage.selectFromDate(TEST_DATES.exceedFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.exceedToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyErrorMessage('Date range must be within 3 months');
  });

  test('TC_32: Default status selection', async () => {
    const defaultValue = await cashTransferPage.getDropdownValue('[data-testid="cash-transfer-historydropdown-status"]');
    expect(defaultValue).toBe('All');
  });

  test('TC_33: All status options displayed', async () => {
    await cashTransferPage.page.click('[data-testid="cash-transfer-historydropdown-status"]');
    const options = ['All', 'Pending', 'Completed', 'Rejected', 'Failed'];
    
    for (const option of options) {
      await expect(cashTransferPage.page.locator(`text="${option}"`)).toBeVisible();
    }
  });

  test('TC_34: Specific status selection', async () => {
    await cashTransferPage.selectStatus('Pending');
    const selectedValue = await cashTransferPage.getDropdownValue('[data-testid="cash-transfer-historydropdown-status"]');
    expect(selectedValue).toBe('Pending');
  });

  test('TC_35: Query with status "All"', async () => {
    await cashTransferPage.selectTransferType('All');
    await cashTransferPage.selectStatus('All');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults(undefined, 'All');
  });

  test('TC_36: Query with status "Pending"', async () => {
    await cashTransferPage.selectTransferType('All');
    await cashTransferPage.selectStatus('Pending');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults(undefined, 'Pending');
  });

  test('TC_37: Query with status "Completed"', async () => {
    await cashTransferPage.selectTransferType('All');
    await cashTransferPage.selectStatus('Completed');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults(undefined, 'Completed');
  });

  test('TC_38: Query with status "Rejected"', async () => {
    await cashTransferPage.selectTransferType('All');
    await cashTransferPage.selectStatus('Rejected');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults(undefined, 'Rejected');
  });

  test('TC_39: Query with status "Failed"', async () => {
    await cashTransferPage.selectTransferType('All');
    await cashTransferPage.selectStatus('Failed');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults(undefined, 'Failed');
  });

  test('TC_40: Query with combined filters', async () => {
    await cashTransferPage.selectTransferType('To sub');
    await cashTransferPage.selectStatus('Pending');
    await cashTransferPage.selectFromDate(TEST_DATES.validFromDate);
    await cashTransferPage.selectToDate(TEST_DATES.validToDate);
    await cashTransferPage.clickQuery();
    
    await cashTransferPage.verifyFilterResults('To sub', 'Pending');
  });
});