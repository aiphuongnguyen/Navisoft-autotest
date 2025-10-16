// Câu lệnh chạy: npx playwright test api-ctck-balance --grep "05.*API"

// 1. IMPORTS
import { test, expect, Page, APIRequestContext } from '@playwright/test';

// 2. CONFIG
const CONFIG = {
  ssoBaseURL: 'https://derivativeapisso.navisoft.com.vn',
  apiBaseURL: 'https://derivativeapi.navisoft.com.vn',
  apiCredentials: {
    userName: 'test2',
    password: '123456',
    loginType: 'ALL',
    grantType: 'password'
  },
  accountId: 'TEST028',
  
  web: {
    loginURL: 'https://your-web-domain.com/login',
    assetCashlimitURL: 'https://your-web-domain.com/asset-cashlimit',
    credentials: {
      username: 'linhdtt01',
      password: 'Y)7m0Fy!'
    }
  }
};

// 3. INTERFACES
interface CtckDailyBalanceInfo {
  cashSettledate: string;
  transactionType: string;
  increaseAmount: number;
  decreaseAmount: number;
  cumulativeBalance: number;
  description: string;
  descriptionEN?: string;
}

interface AssetCashlimitData {
  openingBalance: number;
  closingBalance: number;
  increaseAmount: number;
  decreaseAmount: number;
  ctckDailyBalanceInfos: CtckDailyBalanceInfo[];
}

interface AssetCashlimitResponse {
  code: string;
  message: string;
  data: AssetCashlimitData;
  meta?: {
    total: number;
    page: number;
    perPage: number;
  };
}

interface LoginResponse {
  token?: string;
  data?: { token?: string };
  accessToken?: string;
}

// 4. UTILS CLASS
class AssetCashlimitUtils {
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.abs(value));
  }
  
  static formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  static formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.includes(apiValue) ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }

  static getDefaultDateRange(): { fromDate: string; toDate: string } {
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    
    return {
      fromDate: this.formatDateForAPI(threeMonthsAgo),
      toDate: this.formatDateForAPI(today)
    };
  }
}

// 5. API SERVICE CLASS
class AssetCashlimitAPIService {
  private request: APIRequestContext;
  private cachedToken?: string;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  async login(): Promise<string> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    const response = await this.request.post(`${CONFIG.ssoBaseURL}/api/v1/Auth`, {
      headers: { 'Content-Type': 'application/json' },
      data: CONFIG.apiCredentials
    });

    if (response.status() !== 200) {
      throw new Error(`Login failed: ${response.status()}`);
    }

    const data: LoginResponse = await response.json();
    const token = data.token || data.data?.token || data.accessToken;

    if (!token) {
      throw new Error('Không lấy được token');
    }

    this.cachedToken = token;
    return token;
  }

  async getAssetCashlimitData(fromDate?: string, toDate?: string): Promise<AssetCashlimitData> {
    const token = await this.login();
    const dateRange = AssetCashlimitUtils.getDefaultDateRange();

    const response = await this.request.get(`${CONFIG.apiBaseURL}/fos/v1/Asset/ctck-balance`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/plain'
      },
      params: {
        accountId: CONFIG.accountId,
        fromDate: fromDate || dateRange.fromDate,
        toDate: toDate || dateRange.toDate
      }
    });

    if (response.status() !== 200) {
      const errorText = await response.text();
      throw new Error(`API failed: ${response.status()} - ${errorText}`);
    }

    const responseData: AssetCashlimitResponse = await response.json();

    if (responseData.code !== "0") {
      throw new Error(`API error: ${responseData.code} - ${responseData.message}`);
    }

    return responseData.data;
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API ASSET CASH LIMIT ===');
    const token = await this.login();
    console.log(`Token: ${token.substring(0, 50)}...`);
    
    const data = await this.getAssetCashlimitData();
    console.log('=== DỮ LIỆU ASSET CASH LIMIT ===');
    console.log(JSON.stringify(data, null, 2));
    console.log('=== KẾT NỐI THÀNH CÔNG ===');
  }
}

// 6. WEB SERVICE CLASS
class AssetCashlimitWebService {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async login(): Promise<void> {
    await this.page.goto(CONFIG.web.loginURL);
    await this.page.waitForSelector('[data-testid="login-input-username"]');
    await this.page.locator('[data-testid="login-input-username"]').fill(CONFIG.web.credentials.username);
    await this.page.locator('[data-testid="login-input-password"]').fill(CONFIG.web.credentials.password);
    await this.page.locator('[data-testid="login-action-submit"]').click();
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToAssetCashlimit(): Promise<void> {
    await this.page.goto(CONFIG.web.assetCashlimitURL);
    await this.page.waitForSelector('[data-testid="asset-cashlimit-card-beginningbalance"]', { timeout: 10000 });
  }

  async getUIValue(selector: string): Promise<string | null> {
    try {
      return await this.page.locator(selector).textContent();
    } catch (error) {
      return null;
    }
  }

  async getTableRowCount(): Promise<number> {
    try {
      return await this.page.locator('[data-testid^="asset-cashlimit-col-no-"]').count();
    } catch (error) {
      return 0;
    }
  }

  async getTableCellValue(column: string, rowIndex: number): Promise<string | null> {
    const selector = `[data-testid="asset-cashlimit-col-${column}-${rowIndex}"]`;
    return await this.getUIValue(selector);
  }
}

// 7. COMPARATOR CLASS
class AssetCashlimitComparator {
  private webService: AssetCashlimitWebService;
  private apiData: AssetCashlimitData;

  constructor(webService: AssetCashlimitWebService, apiData: AssetCashlimitData) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareKPIs(): Promise<void> {
    console.log('=== SO SÁNH KPIs (SUMMARY CARDS) ===');

    // Beginning Balance (Opening Balance)
    const uiBeginning = await this.webService.getUIValue('[data-testid="asset-cashlimit-card-beginningbalance"]');
    const apiBeginning = AssetCashlimitUtils.formatCurrency(this.apiData.openingBalance);
    AssetCashlimitUtils.logComparison('Beginning Balance', uiBeginning, apiBeginning);

    // Total Increase
    const uiIncrease = await this.webService.getUIValue('[data-testid="asset-cashlimit-card-totalincrease"]');
    const apiIncrease = AssetCashlimitUtils.formatCurrency(this.apiData.increaseAmount);
    AssetCashlimitUtils.logComparison('Total Increase', uiIncrease, apiIncrease);

    // Total Decrease
    const uiDecrease = await this.webService.getUIValue('[data-testid="asset-cashlimit-card-totaldecrease"]');
    const apiDecrease = AssetCashlimitUtils.formatCurrency(this.apiData.decreaseAmount);
    AssetCashlimitUtils.logComparison('Total Decrease', uiDecrease, apiDecrease);

    // Ending Balance (Closing Balance)
    const uiEnding = await this.webService.getUIValue('[data-testid="asset-cashlimit-card-endingbalance"]');
    const apiEnding = AssetCashlimitUtils.formatCurrency(this.apiData.closingBalance);
    AssetCashlimitUtils.logComparison('Ending Balance', uiEnding, apiEnding);
  }

  async compareTable(): Promise<void> {
    console.log('=== SO SÁNH BẢNG GIAO DỊCH ===');

    const uiRowCount = await this.webService.getTableRowCount();
    const apiRowCount = this.apiData.ctckDailyBalanceInfos.length;

    console.log(`Số dòng - UI: ${uiRowCount}, API: ${apiRowCount}`);

    const compareCount = Math.min(uiRowCount, apiRowCount, 5); // So sánh tối đa 5 dòng đầu
    console.log(`Đang so sánh ${compareCount} dòng đầu tiên...\n`);

    for (let i = 0; i < compareCount; i++) {
      const apiRow = this.apiData.ctckDailyBalanceInfos[i];
      console.log(`--- Dòng ${i + 1} ---`);

      // Date
      const uiDate = await this.webService.getTableCellValue('date', i);
      const apiDate = AssetCashlimitUtils.formatDate(apiRow.cashSettledate);
      AssetCashlimitUtils.logComparison(`  Date`, uiDate, apiDate);

      // Transaction Type
      const uiType = await this.webService.getTableCellValue('type', i);
      AssetCashlimitUtils.logComparison(`  Type`, uiType, apiRow.transactionType);

      // Description
      const uiDesc = await this.webService.getTableCellValue('desc', i);
      AssetCashlimitUtils.logComparison(`  Description`, uiDesc, apiRow.description);

      // Debit (Decrease Amount)
      if (apiRow.decreaseAmount !== 0) {
        const uiDebit = await this.webService.getTableCellValue('debit', i);
        const apiDebit = AssetCashlimitUtils.formatCurrency(apiRow.decreaseAmount);
        AssetCashlimitUtils.logComparison(`  Debit`, uiDebit, apiDebit);
      }

      // Credit (Increase Amount)
      if (apiRow.increaseAmount !== 0) {
        const uiCredit = await this.webService.getTableCellValue('credit', i);
        const apiCredit = AssetCashlimitUtils.formatCurrency(apiRow.increaseAmount);
        AssetCashlimitUtils.logComparison(`  Credit`, uiCredit, apiCredit);
      }

      // Total Balance (Cumulative Balance)
      const uiBalance = await this.webService.getTableCellValue('totalbalance', i);
      const apiBalance = AssetCashlimitUtils.formatCurrency(apiRow.cumulativeBalance);
      AssetCashlimitUtils.logComparison(`  Total Balance`, uiBalance, apiBalance);

      console.log('');
    }
  }

  async performFullComparison(): Promise<void> {
    await this.compareKPIs();
    await this.compareTable();
    console.log('=== HOÀN THÀNH SO SÁNH ===');
  }
}

// 8. TEST SUITE
test.describe('Asset Cash Limit - API to UI Validation', () => {
  let apiService: AssetCashlimitAPIService;
  let assetCashlimitData: AssetCashlimitData;

  test.beforeAll(async ({ request }) => {
    apiService = new AssetCashlimitAPIService(request);
    console.log('Đang lấy dữ liệu Asset Cash Limit...');
    assetCashlimitData = await apiService.getAssetCashlimitData();
    console.log('Dữ liệu API sẵn sàng');
  });

  test('01 - Kiểm tra kết nối API Asset Cash Limit', async ({ request }) => {
    const service = new AssetCashlimitAPIService(request);
    await service.testConnection();
  });

  test('02 - So sánh đầy đủ API với UI', async ({ page }) => {
    const webService = new AssetCashlimitWebService(page);
    await webService.login();
    await webService.navigateToAssetCashlimit();

    const comparator = new AssetCashlimitComparator(webService, assetCashlimitData);
    await comparator.performFullComparison();
  });

  test('03 - So sánh chỉ KPIs', async ({ page }) => {
    const webService = new AssetCashlimitWebService(page);
    await webService.login();
    await webService.navigateToAssetCashlimit();

    const comparator = new AssetCashlimitComparator(webService, assetCashlimitData);
    await comparator.compareKPIs();
  });

  test('04 - So sánh chỉ bảng', async ({ page }) => {
    const webService = new AssetCashlimitWebService(page);
    await webService.login();
    await webService.navigateToAssetCashlimit();

    const comparator = new AssetCashlimitComparator(webService, assetCashlimitData);
    await comparator.compareTable();
  });

  test('05 - Chỉ test API', async ({ request }) => {
    const service = new AssetCashlimitAPIService(request);
    const data = await service.getAssetCashlimitData();

    console.log('=== FULL API RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== CHI TIẾT FORMATTED ===');
    console.log(`Opening Balance: ${AssetCashlimitUtils.formatCurrency(data.openingBalance)}`);
    console.log(`Closing Balance: ${AssetCashlimitUtils.formatCurrency(data.closingBalance)}`);
    console.log(`Total Increase: ${AssetCashlimitUtils.formatCurrency(data.increaseAmount)}`);
    console.log(`Total Decrease: ${AssetCashlimitUtils.formatCurrency(data.decreaseAmount)}`);
    console.log(`\nSố giao dịch: ${data.ctckDailyBalanceInfos.length}`);

    if (data.ctckDailyBalanceInfos.length > 0) {
      console.log('\n=== 3 GIAO DỊCH ĐẦU TIÊN ===');
      data.ctckDailyBalanceInfos.slice(0, 3).forEach((txn, index) => {
        console.log(`\nGiao dịch ${index + 1}:`);
        console.log(`  Date: ${AssetCashlimitUtils.formatDate(txn.cashSettledate)}`);
        console.log(`  Type: ${txn.transactionType}`);
        console.log(`  Description: ${txn.description}`);
        console.log(`  Increase: ${AssetCashlimitUtils.formatCurrency(txn.increaseAmount)}`);
        console.log(`  Decrease: ${AssetCashlimitUtils.formatCurrency(txn.decreaseAmount)}`);
        console.log(`  Balance: ${AssetCashlimitUtils.formatCurrency(txn.cumulativeBalance)}`);
      });
    }

    // Basic validation
    expect(data).toBeTruthy();
    expect(data.ctckDailyBalanceInfos).toBeDefined();
  });
});