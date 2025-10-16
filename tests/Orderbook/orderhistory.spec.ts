import { test, expect, Page, Locator } from '@playwright/test';

// ==================== TEST DATA ====================
const testData = {
  credentials: {
    username: 'test2',
    password: '123456'
  },

  dates: {
    validRange: {
      from: '01/03/2025',
      to: '31/05/2025'
    },
    sameDate: {
      from: '01/03/2025',
      to: '01/03/2025'
    },
    invalidRange: {
      from: '15/06/2025',
      to: '10/06/2025'
    },
    exceeds3Months: {
      from: '01/01/2025',
      to: '05/05/2025'
    }
  },

  symbols: {
    valid: 'VNM',
    invalid: 'BBB',
    delisted: 'XYZ',
    empty: ''
  },

  sides: ['All', 'Buy', 'Sell'] as const,
  statuses: ['All', 'Pending', 'Completed', 'Rejected', 'Failed'] as const,

  errorMessages: {
    toDateLessThanFromDate: 'To date must be >= from date',
    dateRangeExceeds3Months: 'Date range must be within 3 months',
    noMatchingRecords: 'No matching records found'
  },

  columns: [
    'Symbol', 'Order No.', 'B/S Order', 'Vol.', 'Order Prc',
    'Matched Vol', 'Matched Prc', 'Unmatched Vol', 'Matched Value',
    'Order type', 'Order status', 'Order time', 'Validity'
  ]
};

// ==================== DATE HELPERS ====================
class DateHelpers {
  static formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  static parseDate(dateString: string): Date {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
  }

  static monthsDifference(fromDate: string, toDate: string): number {
    const from = this.parseDate(fromDate);
    const to = this.parseDate(toDate);
    
    const yearsDiff = to.getFullYear() - from.getFullYear();
    const monthsDiff = to.getMonth() - from.getMonth();
    const daysDiff = to.getDate() - from.getDate();
    
    let totalMonths = yearsDiff * 12 + monthsDiff;
    if (daysDiff < 0) {
      totalMonths -= 1;
    }
    
    return totalMonths;
  }

  static exceeds3Months(fromDate: string, toDate: string): boolean {
    return this.monthsDifference(fromDate, toDate) > 3;
  }

  static compareDates(date1: string, date2: string): number {
    const d1 = this.parseDate(date1);
    const d2 = this.parseDate(date2);
    
    if (d1 < d2) return -1;
    if (d1 > d2) return 1;
    return 0;
  }
}

// ==================== PAGE OBJECT MODEL ====================
class OrderHistoryPage {
  readonly page: Page;
  
  // Header Filter Fields
  readonly symbolField: Locator;
  readonly sideDropdown: Locator;
  readonly statusDropdown: Locator;
  readonly fromDateField: Locator;
  readonly toDateField: Locator;
  readonly queryButton: Locator;

  // Footer Metrics
  readonly totalVolume: Locator;
  readonly totalBuyVolume: Locator;
  readonly totalSellVolume: Locator;
  readonly totalMatchedVolume: Locator;
  readonly totalUnmatchedVolume: Locator;
  readonly totalMatchedValue: Locator;

  // Messages
  readonly errorMessage: Locator;
  readonly toastMessage: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    this.symbolField = page.getByTestId('orderhistory-field-symbol');
    this.sideDropdown = page.getByTestId('orderhistory-field-side');
    this.statusDropdown = page.getByTestId('orderhistory-field-status');
    this.fromDateField = page.getByTestId('orderhistory-field-fromdate');
    this.toDateField = page.getByTestId('orderhistory-field-todate');
    this.queryButton = page.getByTestId('orderhistory-action-query');

    this.totalVolume = page.getByTestId('orderhistory-metric-totalvol');
    this.totalBuyVolume = page.getByTestId('orderhistory-metric-totalbuy');
    this.totalSellVolume = page.getByTestId('orderhistory-metric-totalsell');
    this.totalMatchedVolume = page.getByTestId('orderhistory-metric-totalmatchedvol');
    this.totalUnmatchedVolume = page.getByTestId('orderhistory-metric-totalunmatchedvol');
    this.totalMatchedValue = page.getByTestId('orderhistory-metric-totalmatchedvalue');

    this.errorMessage = page.locator('[role="alert"], .error-message');
    this.toastMessage = page.locator('.toast, [role="status"]');
    this.emptyState = page.locator('text=/No matching records found/i');
  }

  async goto() {
    await this.page.goto('/order-history');
    await this.page.waitForLoadState('networkidle');
  }

  async fillSymbol(symbol: string) {
    await this.symbolField.clear();
    await this.symbolField.fill(symbol);
  }

  async selectSide(side: 'All' | 'Buy' | 'Sell') {
    await this.sideDropdown.click();
    await this.page.locator(`text="${side}"`).click();
  }

  async selectStatus(status: 'All' | 'Pending' | 'Completed' | 'Rejected' | 'Failed') {
    await this.statusDropdown.click();
    await this.page.locator(`text="${status}"`).click();
  }

  async fillDateRange(fromDate: string, toDate: string) {
    await this.fromDateField.fill(fromDate);
    await this.toDateField.fill(toDate);
  }

  async clickQuery() {
    await this.queryButton.click();
    await this.page.waitForTimeout(500);
  }

  getRowSymbol(rowIndex: number): Locator {
    return this.page.getByTestId(`orderhistory-col-symbol-${rowIndex}`);
  }

  getRowSideBadge(rowIndex: number): Locator {
    return this.page.getByTestId(`orderhistory-badge-side-${rowIndex}`);
  }

  getRowVolume(rowIndex: number): Locator {
    return this.page.getByTestId(`orderhistory-col-vol-${rowIndex}`);
  }

  getRowMatchedVol(rowIndex: number): Locator {
    return this.page.getByTestId(`orderhistory-col-matchedvol-${rowIndex}`);
  }

  getRowUnmatchedVol(rowIndex: number): Locator {
    return this.page.getByTestId(`orderhistory-col-unmatchedvol-${rowIndex}`);
  }

  getRowMatchedValue(rowIndex: number): Locator {
    return this.page.getByTestId(`orderhistory-col-matchedvalue-${rowIndex}`);
  }

  async verifyHeaderFields() {
    await expect(this.symbolField).toBeVisible();
    await expect(this.sideDropdown).toBeVisible();
    await expect(this.statusDropdown).toBeVisible();
    await expect(this.fromDateField).toBeVisible();
    await expect(this.toDateField).toBeVisible();
    await expect(this.queryButton).toBeVisible();
  }

  async verifyTableColumns() {
    for (const column of testData.columns) {
      await expect(this.page.locator(`th:has-text("${column}")`)).toBeVisible();
    }
  }

  async verifyFooterFields() {
    await expect(this.totalVolume).toBeVisible();
    await expect(this.totalBuyVolume).toBeVisible();
    await expect(this.totalSellVolume).toBeVisible();
    await expect(this.totalMatchedVolume).toBeVisible();
    await expect(this.totalUnmatchedVolume).toBeVisible();
    await expect(this.totalMatchedValue).toBeVisible();
  }

  async verifyErrorMessage(expectedMessage: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(expectedMessage);
  }

  async verifyToastMessage(expectedMessage: string) {
    await expect(this.toastMessage).toBeVisible();
    await expect(this.toastMessage).toContainText(expectedMessage);
  }

  async verifyEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  async verifyQueryButtonDisabled() {
    await expect(this.queryButton).toBeDisabled();
  }

  async getAllRowsSide(): Promise<string[]> {
    return await this.page.locator('[data-testid^="orderhistory-badge-side-"]').allTextContents();
  }

  async getAllRowsStatus(): Promise<string[]> {
    return await this.page.locator('[data-testid^="orderhistory-badge-status-"]').allTextContents();
  }

  async getAllRowsSymbol(): Promise<string[]> {
    return await this.page.locator('[data-testid^="orderhistory-col-symbol-"]').allTextContents();
  }

  async calculateExpectedFooterTotals() {
    const allRows = await this.page.locator('[data-testid^="orderhistory-col-vol-"]').count();
    
    let totalVol = 0, totalBuy = 0, totalSell = 0;
    let totalMatched = 0, totalUnmatched = 0, totalMatchedValue = 0;

    for (let i = 0; i < allRows; i++) {
      const vol = parseFloat(await this.getRowVolume(i).textContent() || '0');
      const matchedVol = parseFloat(await this.getRowMatchedVol(i).textContent() || '0');
      const unmatchedVol = parseFloat(await this.getRowUnmatchedVol(i).textContent() || '0');
      const matchedValue = parseFloat(await this.getRowMatchedValue(i).textContent() || '0');
      const side = await this.getRowSideBadge(i).textContent();

      totalVol += vol;
      totalMatched += matchedVol;
      totalUnmatched += unmatchedVol;
      totalMatchedValue += matchedValue;

      if (side?.toLowerCase().includes('buy')) {
        totalBuy += vol;
      } else if (side?.toLowerCase().includes('sell')) {
        totalSell += vol;
      }
    }

    return { totalVol, totalBuy, totalSell, totalMatched, totalUnmatched, totalMatchedValue };
  }

  async getFooterCalculations() {
    return {
      totalVol: await this.totalVolume.textContent(),
      totalBuy: await this.totalBuyVolume.textContent(),
      totalSell: await this.totalSellVolume.textContent(),
      totalMatched: await this.totalMatchedVolume.textContent(),
      totalUnmatched: await this.totalUnmatchedVolume.textContent(),
      totalMatchedValue: await this.totalMatchedValue.textContent()
    };
  }
}

// ==================== TEST HOOKS ====================
test.beforeEach(async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="username"]', testData.credentials.username);
  await page.fill('[name="password"]', testData.credentials.password);
  await page.click('[type="submit"]');
  await page.waitForLoadState('networkidle');
});

// ==================== TC_00: DISPLAY VERIFICATION ====================
test.describe('TC_00: Verify Display with Correct Columns', () => {
  test('TC_00_01: Verify display header with correct fields', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.verifyHeaderFields();
    await expect(orderHistoryPage.queryButton).toBeEnabled();
  });

  test('TC_00_02: Verify display table with correct columns', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.verifyTableColumns();
  });

  test('TC_00_03: Verify display footer with correct fields', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.verifyFooterFields();
  });
});

// ==================== TC_36-38: DATE PICKER TESTS ====================
test.describe('Date Picker Function Tests', () => {
  test('TC_36: Verify system allows a date range exactly equal to 3 months', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.fillDateRange(
      testData.dates.validRange.from,
      testData.dates.validRange.to
    );

    const monthsDiff = DateHelpers.monthsDifference(
      testData.dates.validRange.from,
      testData.dates.validRange.to
    );
    expect(monthsDiff).toBeLessThanOrEqual(3);

    await orderHistoryPage.clickQuery();

    await expect(orderHistoryPage.errorMessage).not.toBeVisible();
    await expect(orderHistoryPage.queryButton).toBeEnabled();
  });

  test('TC_37: Verify system accepts and processes from date = to date', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.fillDateRange(
      testData.dates.sameDate.from,
      testData.dates.sameDate.to
    );

    expect(testData.dates.sameDate.from).toBe(testData.dates.sameDate.to);

    await orderHistoryPage.clickQuery();

    await expect(orderHistoryPage.errorMessage).not.toBeVisible();
    await expect(orderHistoryPage.queryButton).toBeEnabled();
  });

  test('TC_38: Verify error message is shown when to date < from date', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.fillDateRange(
      testData.dates.invalidRange.from,
      testData.dates.invalidRange.to
    );

    const comparison = DateHelpers.compareDates(
      testData.dates.invalidRange.to,
      testData.dates.invalidRange.from
    );
    expect(comparison).toBeLessThan(0);

    await orderHistoryPage.clickQuery();

    await orderHistoryPage.verifyErrorMessage(testData.errorMessages.toDateLessThanFromDate);
    await orderHistoryPage.verifyQueryButtonDisabled();
  });

  test('TC_38_01: Verify system shows an error when selected date range exceeds 3 months', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.fillDateRange(
      testData.dates.exceeds3Months.from,
      testData.dates.exceeds3Months.to
    );

    const exceeds = DateHelpers.exceeds3Months(
      testData.dates.exceeds3Months.from,
      testData.dates.exceeds3Months.to
    );
    expect(exceeds).toBeTruthy();

    await orderHistoryPage.clickQuery();

    await orderHistoryPage.verifyErrorMessage(testData.errorMessages.dateRangeExceeds3Months);
    await orderHistoryPage.verifyQueryButtonDisabled();
  });
});

// ==================== TC_27-31: SYMBOL FILTER TESTS ====================
test.describe('Test the Functions of Symbol Field', () => {
  test('TC_27: Verify Symbol filter works with valid input', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.fillSymbol(testData.symbols.valid);
    await expect(orderHistoryPage.symbolField).toHaveValue(testData.symbols.valid);
    await expect(orderHistoryPage.errorMessage).not.toBeVisible();

    await orderHistoryPage.clickQuery();

    const rowCount = await page.locator('[data-testid^="orderhistory-col-symbol-"]').count();
    
    if (rowCount > 0) {
      const symbols = await orderHistoryPage.getAllRowsSymbol();
      for (const symbol of symbols) {
        expect(symbol.trim()).toBe(testData.symbols.valid);
      }
    } else {
      await orderHistoryPage.verifyEmptyState();
    }
  });

  test('TC_29: Verify toast message display when enter invalid input', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.fillSymbol(testData.symbols.invalid);
    await orderHistoryPage.clickQuery();

    await orderHistoryPage.verifyToastMessage(testData.errorMessages.noMatchingRecords);
    await orderHistoryPage.verifyEmptyState();

    const rowCount = await page.locator('[data-testid^="orderhistory-col-symbol-"]').count();
    expect(rowCount).toBe(0);
  });

  test('TC_30: Verify delisted stock shows no matching records', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.fillSymbol(testData.symbols.delisted);
    await orderHistoryPage.clickQuery();

    await orderHistoryPage.verifyToastMessage(testData.errorMessages.noMatchingRecords);
    await orderHistoryPage.verifyEmptyState();

    const rowCount = await page.locator('[data-testid^="orderhistory-col-symbol-"]').count();
    expect(rowCount).toBe(0);
  });

  test('TC_31: View orderbook successfully when empty symbol field', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.fillSymbol(testData.symbols.empty);
    await expect(orderHistoryPage.symbolField).toHaveValue('');

    await orderHistoryPage.clickQuery();

    const rowCount = await page.locator('[data-testid^="orderhistory-col-symbol-"]').count();
    
    if (rowCount > 0) {
      const symbols = await orderHistoryPage.getAllRowsSymbol();
      const uniqueSymbols = new Set(symbols.map(s => s.trim()));
      console.log(`Found ${uniqueSymbols.size} unique symbols in results`);
    } else {
      await orderHistoryPage.verifyEmptyState();
    }
  });
});

// ==================== TC_33-35: BUY/SELL FILTER TESTS ====================
test.describe('Test the Functions of Buy/Sell Field', () => {
  test('TC_33: Verify Buy filter works correctly', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.selectSide('Buy');
    await expect(orderHistoryPage.sideDropdown).toContainText('Buy');

    await orderHistoryPage.clickQuery();

    const rowCount = await page.locator('[data-testid^="orderhistory-badge-side-"]').count();
    
    if (rowCount > 0) {
      const sides = await orderHistoryPage.getAllRowsSide();
      for (const side of sides) {
        expect(side.toLowerCase()).toContain('buy');
      }
    } else {
      await orderHistoryPage.verifyEmptyState();
    }
  });

  test('TC_34: Verify Sell filter works correctly', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.selectSide('Sell');
    await expect(orderHistoryPage.sideDropdown).toContainText('Sell');

    await orderHistoryPage.clickQuery();

    const rowCount = await page.locator('[data-testid^="orderhistory-badge-side-"]').count();
    
    if (rowCount > 0) {
      const sides = await orderHistoryPage.getAllRowsSide();
      for (const side of sides) {
        expect(side.toLowerCase()).toContain('sell');
      }
    } else {
      await orderHistoryPage.verifyEmptyState();
    }
  });

  test('TC_35: Verify All filter works correctly', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.selectSide('All');
    await expect(orderHistoryPage.sideDropdown).toContainText('All');

    await orderHistoryPage.clickQuery();

    const rowCount = await page.locator('[data-testid^="orderhistory-badge-side-"]').count();
    
    if (rowCount > 0) {
      const sides = await orderHistoryPage.getAllRowsSide();
      const uniqueSides = new Set(sides.map(s => s.toLowerCase().trim()));
      
      const hasBuy = Array.from(uniqueSides).some(s => s.includes('buy'));
      const hasSell = Array.from(uniqueSides).some(s => s.includes('sell'));
      
      expect(hasBuy || hasSell).toBeTruthy();
    } else {
      await orderHistoryPage.verifyEmptyState();
    }
  });
});

// ==================== TC_32-32_07: STATUS FILTER TESTS ====================
test.describe('Verify Query Executes Correctly with Status Selected', () => {
  test('TC_32: Verify default selection of status dropdown is set correctly', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await expect(orderHistoryPage.statusDropdown).toContainText('All');
  });

  test('TC_32_01: Verify all available status options are displayed in dropdown', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.statusDropdown.click();

    for (const status of testData.statuses) {
      await expect(page.locator(`text="${status}"`)).toBeVisible();
    }
  });

  test('TC_32_02: Verify correct behavior when selecting a specific status', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.statusDropdown.click();
    await page.locator('text="Pending"').click();

    await expect(orderHistoryPage.statusDropdown).toContainText('Pending');
  });

  test('TC_32_03: Verify query executes correctly with status = All', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.selectStatus('All');
    await orderHistoryPage.fillDateRange(
      testData.dates.validRange.from,
      testData.dates.validRange.to
    );
    await orderHistoryPage.clickQuery();

    const rowCount = await page.locator('[data-testid^="orderhistory-badge-status-"]').count();
    
    if (rowCount > 0) {
      const statuses = await orderHistoryPage.getAllRowsStatus();
      const validStatuses = ['pending', 'completed', 'rejected', 'failed'];
      for (const status of statuses) {
        const isValid = validStatuses.some(vs => status.toLowerCase().includes(vs));
        expect(isValid).toBeTruthy();
      }
    } else {
      await orderHistoryPage.verifyEmptyState();
    }
  });

  test('TC_32_04: Verify query executes correctly with status = Pending', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.selectStatus('Pending');
    await orderHistoryPage.fillDateRange(
      testData.dates.validRange.from,
      testData.dates.validRange.to
    );
    await orderHistoryPage.clickQuery();

    const rowCount = await page.locator('[data-testid^="orderhistory-badge-status-"]').count();
    
    if (rowCount > 0) {
      const statuses = await orderHistoryPage.getAllRowsStatus();
      for (const status of statuses) {
        expect(status.toLowerCase()).toContain('pending');
      }
    } else {
      await orderHistoryPage.verifyEmptyState();
    }
  });

  test('TC_32_05: Verify query executes correctly with status = Completed', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.selectStatus('Completed');
    await orderHistoryPage.fillDateRange(
      testData.dates.validRange.from,
      testData.dates.validRange.to
    );
    await orderHistoryPage.clickQuery();

    const rowCount = await page.locator('[data-testid^="orderhistory-badge-status-"]').count();
    
    if (rowCount > 0) {
      const statuses = await orderHistoryPage.getAllRowsStatus();
      for (const status of statuses) {
        expect(status.toLowerCase()).toContain('completed');
      }
    } else {
      await orderHistoryPage.verifyEmptyState();
    }
  });

  test('TC_32_06: Verify query executes correctly with status = Rejected', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.selectStatus('Rejected');
    await orderHistoryPage.fillDateRange(
      testData.dates.validRange.from,
      testData.dates.validRange.to
    );
    await orderHistoryPage.clickQuery();

    const rowCount = await page.locator('[data-testid^="orderhistory-badge-status-"]').count();
    
    if (rowCount > 0) {
      const statuses = await orderHistoryPage.getAllRowsStatus();
      for (const status of statuses) {
        expect(status.toLowerCase()).toContain('rejected');
      }
    } else {
      await orderHistoryPage.verifyEmptyState();
    }
  });

  test('TC_32_07: Verify query executes correctly with status = Failed', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.selectStatus('Failed');
    await orderHistoryPage.fillDateRange(
      testData.dates.validRange.from,
      testData.dates.validRange.to
    );
    await orderHistoryPage.clickQuery();

    const rowCount = await page.locator('[data-testid^="orderhistory-badge-status-"]').count();
    
    if (rowCount > 0) {
      const statuses = await orderHistoryPage.getAllRowsStatus();
      for (const status of statuses) {
        expect(status.toLowerCase()).toContain('failed');
      }
    } else {
      await orderHistoryPage.verifyEmptyState();
    }
  });
});

// ==================== TC_43: FOOTER CALCULATION TESTS ====================
test.describe('TC_43: Test the Footer Value', () => {
  test('TC_43: Verify footer calculations are accurate', async ({ page }) => {
    const orderHistoryPage = new OrderHistoryPage(page);
    await orderHistoryPage.goto();

    await orderHistoryPage.fillDateRange(
      testData.dates.validRange.from,
      testData.dates.validRange.to
    );
    await orderHistoryPage.selectSide('All');
    await orderHistoryPage.selectStatus('All');
    
    await orderHistoryPage.clickQuery();
    await page.waitForTimeout(1000);

    const rowCount = await page.locator('[data-testid^="orderhistory-col-vol-"]').count();
    
    if (rowCount === 0) {
      console.log('No data available for footer calculation test');
      await orderHistoryPage.verifyEmptyState();
      return;
    }

    const displayedTotals = await orderHistoryPage.getFooterCalculations();
    const expectedTotals = await orderHistoryPage.calculateExpectedFooterTotals();

    const parseValue = (value: string | null): number => {
      if (!value) return 0;
      return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
    };

    const displayedTotalVol = parseValue(displayedTotals.totalVol);
    const displayedTotalBuy = parseValue(displayedTotals.totalBuy);
    const displayedTotalSell = parseValue(displayedTotals.totalSell);
    const displayedTotalMatched = parseValue(displayedTotals.totalMatched);
    const displayedTotalUnmatched = parseValue(displayedTotals.totalUnmatched);
    const displayedTotalMatchedValue = parseValue(displayedTotals.totalMatchedValue);

    const tolerance = 0.01;

    expect(Math.abs(displayedTotalVol - expectedTotals.totalVol)).toBeLessThan(tolerance);
    expect(Math.abs(displayedTotalBuy - expectedTotals.totalBuy)).toBeLessThan(tolerance);
    expect(Math.abs(displayedTotalSell - expectedTotals.totalSell)).toBeLessThan(tolerance);
    expect(Math.abs(displayedTotalMatched - expectedTotals.totalMatched)).toBeLessThan(tolerance);
    expect(Math.abs(displayedTotalUnmatched - expectedTotals.totalUnmatched)).toBeLessThan(tolerance);
    expect(Math.abs(displayedTotalMatchedValue - expectedTotals.totalMatchedValue)).toBeLessThan(tolerance);

    console.log('✅ All footer calculations are accurate!');
  });
});