import { test, expect, Page } from '@playwright/test';

// Page Object Model for Cash Transfer History
class CashTransferHistoryPage {
  constructor(private page: Page) {}

  // Selectors
  private selectors = {
    fromDate: '[data-testid="cash-vsd-deposit-historydatepicker-fromdate"]',
    toDate: '[data-testid="cash-vsd-deposit-historydatepicker-todate"]',
    statusDropdown: '[data-testid="cash-vsd-deposit-historydropdown-status"]',
    queryButton: '[data-testid="cash-vsd-deposit-history-btnquery"]',
    tableDate: (row: number) => `[data-testid="cash-vsd-deposit-history-row${row}-date"]`,
    tableBeneficiary: (row: number) => `[data-testid="cash-vsd-deposit-history-row${row}-beneficiary"]`,
    tableAmount: (row: number) => `[data-testid="cash-vsd-deposit-history-row${row}-amount"]`,
    tableFee: (row: number) => `[data-testid="cash-vsd-deposit-history-row${row}-fee"]`,
    tableStatus: (row: number) => `[data-testid="cash-vsd-deposit-history-row${row}-status"]`,
    tableRemark: (row: number) => `[data-testid="cash-vsd-deposit-history-row${row}-remark"]`,
    errorMessage: '.error-message', // Assuming error message selector
    emptyState: '.empty-state' // Assuming empty state selector
  };

  // Helper methods
  async login(username: string = 'test2', password: string = '123456') {
    // Navigate to login page and perform login
    await this.page.goto('/login');
    await this.page.fill('[data-testid="username"]', username);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToCashTransferHistory() {
    // Navigate to Cash Transfer History screen
    await this.page.goto('/cash-transfer-history');
    await this.page.waitForLoadState('networkidle');
  }

  async setDateRange(fromDate: string, toDate: string) {
    await this.page.fill(this.selectors.fromDate, fromDate);
    await this.page.fill(this.selectors.toDate, toDate);
  }

  async selectStatus(status: string) {
    await this.page.click(this.selectors.statusDropdown);
    await this.page.selectOption(this.selectors.statusDropdown, status);
  }

  async clickQuery() {
    await this.page.click(this.selectors.queryButton);
    await this.page.waitForLoadState('networkidle');
  }

  async getStatusDropdownOptions() {
    await this.page.click(this.selectors.statusDropdown);
    return await this.page.$$eval(
      `${this.selectors.statusDropdown} option`,
      options => options.map(option => option.textContent?.trim())
    );
  }

  async getSelectedStatus() {
    return await this.page.inputValue(this.selectors.statusDropdown);
  }

  async getTableRowStatus(rowIndex: number) {
    return await this.page.textContent(this.selectors.tableStatus(rowIndex));
  }

  async isErrorMessageVisible() {
    return await this.page.isVisible(this.selectors.errorMessage);
  }

  async getErrorMessage() {
    return await this.page.textContent(this.selectors.errorMessage);
  }

  async isEmptyStateVisible() {
    return await this.page.isVisible(this.selectors.emptyState);
  }

  async getTableRowCount() {
    return await this.page.locator('[data-testid*="cash-vsd-deposit-history-row"]').count();
  }
}

// Test suite
test.describe('Cash Transfer History Tests', () => {
  let cashTransferPage: CashTransferHistoryPage;

  test.beforeEach(async ({ page }) => {
    cashTransferPage = new CashTransferHistoryPage(page);
    await cashTransferPage.login();
    await cashTransferPage.navigateToCashTransferHistory();
  });

  test('TC_00: Verify display with correct columns', async ({ page }) => {
    // Verify display header with correct fields
    await expect(page.locator(cashTransferPage['selectors'].fromDate)).toBeVisible();
    await expect(page.locator(cashTransferPage['selectors'].toDate)).toBeVisible();
    await expect(page.locator(cashTransferPage['selectors'].statusDropdown)).toBeVisible();
    await expect(page.locator(cashTransferPage['selectors'].queryButton)).toBeVisible();

    // Verify display table with correct columns
    const tableHeaders = [
      'Date', 'Beneficiary', 'Transfer amount', 
      'Transfer Fee', 'Status', 'Remark'
    ];
    
    for (const header of tableHeaders) {
      await expect(page.getByText(header)).toBeVisible();
    }
  });

  test('TC_18: Verify system allows a date range exactly equal to 3 months', async () => {
    await cashTransferPage.setDateRange('01/03/2025', '31/05/2025');
    await cashTransferPage.clickQuery();
    
    // Verify no error message is displayed
    const isErrorVisible = await cashTransferPage.isErrorMessageVisible();
    expect(isErrorVisible).toBeFalsy();
  });

  test('TC_19: Verify system accepts and processes from date = to date', async () => {
    await cashTransferPage.setDateRange('01/03/2025', '01/03/2025');
    await cashTransferPage.clickQuery();
    
    // Verify same date for both fields is accepted, no error display
    const isErrorVisible = await cashTransferPage.isErrorMessageVisible();
    expect(isErrorVisible).toBeFalsy();
  });

  test('TC_20: Verify error message is shown when to date < from date', async () => {
    await cashTransferPage.setDateRange('15/06/2025', '10/06/2025');
    await cashTransferPage.clickQuery();
    
    // Verify error message displays
    const isErrorVisible = await cashTransferPage.isErrorMessageVisible();
    expect(isErrorVisible).toBeTruthy();
    
    const errorMessage = await cashTransferPage.getErrorMessage();
    expect(errorMessage).toContain('To date must be >= from date');
  });

  test('TC_21: Verify system shows an error when selected date range exceeds 3 months', async () => {
    await cashTransferPage.setDateRange('01/01/2025', '05/05/2025');
    await cashTransferPage.clickQuery();
    
    // Verify error message displays
    const isErrorVisible = await cashTransferPage.isErrorMessageVisible();
    expect(isErrorVisible).toBeTruthy();
    
    const errorMessage = await cashTransferPage.getErrorMessage();
    expect(errorMessage).toContain('Date range must be within 3 months');
  });

  test('TC_24: Verify default selection of status dropdown is set correctly', async () => {
    const defaultStatus = await cashTransferPage.getSelectedStatus();
    expect(defaultStatus).toBe('All');
  });

  test('TC_25: Verify all available status options are displayed in dropdown', async () => {
    const options = await cashTransferPage.getStatusDropdownOptions();
    const expectedOptions = ['All', 'Pending', 'Completed', 'Rejected', 'Failed'];
    
    for (const expectedOption of expectedOptions) {
      expect(options).toContain(expectedOption);
    }
  });

  test('TC_26: Verify correct behavior when selecting a specific status', async () => {
    await cashTransferPage.selectStatus('Pending');
    
    const selectedStatus = await cashTransferPage.getSelectedStatus();
    expect(selectedStatus).toBe('Pending');
  });

  test('TC_27: Verify query executes correctly with status selected = All', async () => {
    await cashTransferPage.selectStatus('All');
    await cashTransferPage.setDateRange('01/03/2025', '31/05/2025');
    await cashTransferPage.clickQuery();
    
    // Check if results are displayed or empty state is shown
    const rowCount = await cashTransferPage.getTableRowCount();
    const isEmptyStateVisible = await cashTransferPage.isEmptyStateVisible();
    
    if (rowCount === 0) {
      expect(isEmptyStateVisible).toBeTruthy();
    } else {
      // Verify results can contain any status when "All" is selected
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test('TC_28: Verify query executes correctly with status selected = Pending', async () => {
    await cashTransferPage.selectStatus('Pending');
    await cashTransferPage.setDateRange('01/03/2025', '31/05/2025');
    await cashTransferPage.clickQuery();
    
    const rowCount = await cashTransferPage.getTableRowCount();
    const isEmptyStateVisible = await cashTransferPage.isEmptyStateVisible();
    
    if (rowCount === 0) {
      expect(isEmptyStateVisible).toBeTruthy();
    } else {
      // Verify all results have Pending status
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const status = await cashTransferPage.getTableRowStatus(i);
        expect(status).toBe('Pending');
      }
    }
  });

  test('TC_29: Verify query executes correctly with status selected = Completed', async () => {
    await cashTransferPage.selectStatus('Completed');
    await cashTransferPage.setDateRange('01/03/2025', '31/05/2025');
    await cashTransferPage.clickQuery();
    
    const rowCount = await cashTransferPage.getTableRowCount();
    const isEmptyStateVisible = await cashTransferPage.isEmptyStateVisible();
    
    if (rowCount === 0) {
      expect(isEmptyStateVisible).toBeTruthy();
    } else {
      // Verify all results have Completed status
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const status = await cashTransferPage.getTableRowStatus(i);
        expect(status).toBe('Completed');
      }
    }
  });

  test('TC_30: Verify query executes correctly with status selected = Rejected', async () => {
    await cashTransferPage.selectStatus('Rejected');
    await cashTransferPage.setDateRange('01/03/2025', '31/05/2025');
    await cashTransferPage.clickQuery();
    
    const rowCount = await cashTransferPage.getTableRowCount();
    const isEmptyStateVisible = await cashTransferPage.isEmptyStateVisible();
    
    if (rowCount === 0) {
      expect(isEmptyStateVisible).toBeTruthy();
    } else {
      // Verify all results have Rejected status
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const status = await cashTransferPage.getTableRowStatus(i);
        expect(status).toBe('Rejected');
      }
    }
  });

  test('TC_31: Verify query executes correctly with status selected = Failed', async () => {
    await cashTransferPage.selectStatus('Failed');
    await cashTransferPage.setDateRange('01/03/2025', '31/05/2025');
    await cashTransferPage.clickQuery();
    
    const rowCount = await cashTransferPage.getTableRowCount();
    const isEmptyStateVisible = await cashTransferPage.isEmptyStateVisible();
    
    if (rowCount === 0) {
      expect(isEmptyStateVisible).toBeTruthy();
    } else {
      // Verify all results have Failed status
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const status = await cashTransferPage.getTableRowStatus(i);
        expect(status).toBe('Failed');
      }
    }
  });
});

// Additional configuration for test execution
test.describe.configure({ mode: 'parallel' });

// Test data helper
export const TestData = {
  validDateRanges: {
    exactThreeMonths: { from: '01/03/2025', to: '31/05/2025' },
    sameDate: { from: '01/03/2025', to: '01/03/2025' },
  },
  invalidDateRanges: {
    toDateBeforeFromDate: { from: '15/06/2025', to: '10/06/2025' },
    exceedsThreeMonths: { from: '01/01/2025', to: '05/05/2025' },
  },
  statusOptions: ['All', 'Pending', 'Completed', 'Rejected', 'Failed'],
  credentials: {
    username: 'test2',
    password: '123456'
  }
};