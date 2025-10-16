// Câu lệnh chạy: npx playwright test api-vsd-balance --grep "05.*API"

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
    assetCardURL: 'https://your-web-domain.com/asset-card',
    credentials: {
      username: 'linhdtt01',
      password: 'Y)7m0Fy!'
    }
  }
};

// 3. INTERFACES
interface VsdDailyBalanceInfo {
  cashSettledate: string;
  transactionType: string;
  increaseAmount: number;
  decreaseAmount: number;
  cumulativeBalance: number;
  description: string;
  descriptionEN: string;
}

interface AssetCardData {
  openingBalance: number;
  closingBalance: number;
  increaseAmount: number;
  decreaseAmount: number;
  vsdDailyBalanceInfos: VsdDailyBalanceInfo[];
}

interface AssetCardResponse {
  code: string;
  message: string;
  data: AssetCardData;
  meta: {
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
class AssetCardUtils {
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
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
  
  static getDefaultDateRange(): { fromDate: string; toDate: string } {
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    
    return {
      fromDate: this.formatDateForAPI(threeMonthsAgo),
      toDate: this.formatDateForAPI(today)
    };
  }
  
  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.includes(apiValue) ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }
}

// 5. API SERVICE CLASS
class AssetCardAPIService {
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

  async getAssetCardData(fromDate?: string, toDate?: string): Promise<AssetCardResponse> {
    const token = await this.login();
    const dateRange = fromDate && toDate 
      ? { fromDate, toDate }
      : AssetCardUtils.getDefaultDateRange();

    const response = await this.request.get(`${CONFIG.apiBaseURL}/fos/v1/Asset/vsd-balance`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/plain'
      },
      params: {
        accountId: CONFIG.accountId,
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate
      }
    });

    if (response.status() !== 200) {
      const errorText = await response.text();
      throw new Error(`API failed: ${response.status()} - ${errorText}`);
    }

    const responseData: AssetCardResponse = await response.json();

    if (responseData.code !== "0") {
      throw new Error(`API error: ${responseData.code} - ${responseData.message}`);
    }

    return responseData;
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API ASSET CARD ===');
    const token = await this.login();
    console.log(`Token: ${token.substring(0, 50)}...`);
    
    const response = await this.getAssetCardData();
    console.log('=== DỮ LIỆU ASSET CARD ===');
    console.log(JSON.stringify(response.data, null, 2));
    console.log(`=== Tổng giao dịch: ${response.meta.total} ===`);
    console.log('=== KẾT NỐI THÀNH CÔNG ===');
  }
}

// 6. WEB SERVICE CLASS
class AssetCardWebService {
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

  async navigateToAssetCard(): Promise<void> {
    await this.page.goto(CONFIG.web.assetCardURL);
    await this.page.waitForSelector('[data-testid="asset-cashstmt-card-beginningbalance"]', { timeout: 10000 });
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
      const rows = await this.page.locator('[data-testid^="asset-cashstmt-col-no"]').count();
      return rows;
    } catch (error) {
      return 0;
    }
  }

  async getTableRowData(rowIndex: number): Promise<{
    date: string | null;
    type: string | null;
    description: string | null;
    debit: string | null;
    credit: string | null;
    totalBalance: string | null;
  }> {
    return {
      date: await this.getUIValue(`[data-testid="asset-cashstmt-col-date[${rowIndex}]"]`),
      type: await this.getUIValue(`[data-testid="asset-cashstmt-col-type[${rowIndex}]"]`),
      description: await this.getUIValue(`[data-testid="asset-cashstmt-col-desc[${rowIndex}]"]`),
      debit: await this.getUIValue(`[data-testid="asset-cashstmt-col-debit[${rowIndex}]"]`),
      credit: await this.getUIValue(`[data-testid="asset-cashstmt-col-credit[${rowIndex}]"]`),
      totalBalance: await this.getUIValue(`[data-testid="asset-cashstmt-col-totalbalance[${rowIndex}]"]`)
    };
  }
}

// 7. COMPARATOR CLASS
class AssetCardComparator {
  private webService: AssetCardWebService;
  private apiData: AssetCardData;

  constructor(webService: AssetCardWebService, apiData: AssetCardData) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareKPIs(): Promise<void> {
    console.log('=== SO SÁNH KPIs ===');
    
    // Opening Balance
    const openingBalanceUI = await this.webService.getUIValue('[data-testid="asset-cashstmt-card-beginningbalance"]');
    const openingBalanceAPI = AssetCardUtils.formatCurrency(this.apiData.openingBalance);
    AssetCardUtils.logComparison('Opening Balance', openingBalanceUI, openingBalanceAPI);
    
    // Total Increase
    const totalIncreaseUI = await this.webService.getUIValue('[data-testid="asset-cashstmt-card-totalincrease"]');
    const totalIncreaseAPI = AssetCardUtils.formatCurrency(this.apiData.increaseAmount);
    AssetCardUtils.logComparison('Total Increase', totalIncreaseUI, totalIncreaseAPI);
    
    // Total Decrease
    const totalDecreaseUI = await this.webService.getUIValue('[data-testid="asset-cashstmt-card-totaldecrease"]');
    const totalDecreaseAPI = AssetCardUtils.formatCurrency(Math.abs(this.apiData.decreaseAmount));
    AssetCardUtils.logComparison('Total Decrease', totalDecreaseUI, totalDecreaseAPI);
    
    // Closing Balance
    const closingBalanceUI = await this.webService.getUIValue('[data-testid="asset-cashstmt-card-endingbalance"]');
    const closingBalanceAPI = AssetCardUtils.formatCurrency(this.apiData.closingBalance);
    AssetCardUtils.logComparison('Closing Balance', closingBalanceUI, closingBalanceAPI);
  }

  async compareTable(): Promise<void> {
    console.log('=== SO SÁNH BẢNG ===');
    
    const uiRowCount = await this.webService.getTableRowCount();
    const apiRowCount = this.apiData.vsdDailyBalanceInfos.length;
    
    console.log(`Số dòng - UI: ${uiRowCount}, API: ${apiRowCount}`);
    
    const compareCount = Math.min(uiRowCount, apiRowCount, 5);
    console.log(`So sánh ${compareCount} dòng đầu tiên:`);
    
    for (let i = 0; i < compareCount; i++) {
      console.log(`\n--- Dòng ${i + 1} ---`);
      const uiRow = await this.webService.getTableRowData(i);
      const apiRow = this.apiData.vsdDailyBalanceInfos[i];
      
      // Date
      const dateAPI = AssetCardUtils.formatDate(apiRow.cashSettledate);
      AssetCardUtils.logComparison('Date', uiRow.date, dateAPI);
      
      // Transaction Type
      AssetCardUtils.logComparison('Type', uiRow.type, apiRow.transactionType);
      
      // Description
      AssetCardUtils.logComparison('Description', uiRow.description, apiRow.description);
      
      // Debit (Decrease)
      if (apiRow.decreaseAmount !== 0) {
        const debitAPI = AssetCardUtils.formatCurrency(Math.abs(apiRow.decreaseAmount));
        AssetCardUtils.logComparison('Debit', uiRow.debit, debitAPI);
      }
      
      // Credit (Increase)
      if (apiRow.increaseAmount !== 0) {
        const creditAPI = AssetCardUtils.formatCurrency(apiRow.increaseAmount);
        AssetCardUtils.logComparison('Credit', uiRow.credit, creditAPI);
      }
      
      // Cumulative Balance
      const balanceAPI = AssetCardUtils.formatCurrency(apiRow.cumulativeBalance);
      AssetCardUtils.logComparison('Total Balance', uiRow.totalBalance, balanceAPI);
    }
  }

  async performFullComparison(): Promise<void> {
    await this.compareKPIs();
    await this.compareTable();
    console.log('=== HOÀN THÀNH SO SÁNH ===');
  }
}

// 8. TEST SUITE
test.describe('Asset Card - API to UI Validation', () => {
  let apiService: AssetCardAPIService;
  let assetCardResponse: AssetCardResponse;

  test.beforeAll(async ({ request }) => {
    apiService = new AssetCardAPIService(request);
    console.log('Đang lấy dữ liệu Asset Card...');
    assetCardResponse = await apiService.getAssetCardData();
    console.log('Dữ liệu API sẵn sàng');
  });

  test('01 - Kiểm tra kết nối API Asset Card', async ({ request }) => {
    const service = new AssetCardAPIService(request);
    await service.testConnection();
  });

  test('02 - So sánh đầy đủ API với UI', async ({ page }) => {
    const webService = new AssetCardWebService(page);
    await webService.login();
    await webService.navigateToAssetCard();

    const comparator = new AssetCardComparator(webService, assetCardResponse.data);
    await comparator.performFullComparison();
  });

  test('03 - So sánh chỉ KPIs', async ({ page }) => {
    const webService = new AssetCardWebService(page);
    await webService.login();
    await webService.navigateToAssetCard();

    const comparator = new AssetCardComparator(webService, assetCardResponse.data);
    await comparator.compareKPIs();
  });

  test('04 - So sánh chỉ bảng', async ({ page }) => {
    const webService = new AssetCardWebService(page);
    await webService.login();
    await webService.navigateToAssetCard();

    const comparator = new AssetCardComparator(webService, assetCardResponse.data);
    await comparator.compareTable();
  });

  test('05 - Chỉ test API', async ({ request }) => {
    const service = new AssetCardAPIService(request);
    const response = await service.getAssetCardData();

    console.log('=== FULL API RESPONSE ===');
    console.log(JSON.stringify(response, null, 2));

    console.log('\n=== CHI TIẾT FORMATTED ===');
    console.log(`Opening Balance: ${AssetCardUtils.formatCurrency(response.data.openingBalance)}`);
    console.log(`Closing Balance: ${AssetCardUtils.formatCurrency(response.data.closingBalance)}`);
    console.log(`Total Increase: ${AssetCardUtils.formatCurrency(response.data.increaseAmount)}`);
    console.log(`Total Decrease: ${AssetCardUtils.formatCurrency(Math.abs(response.data.decreaseAmount))}`);
    console.log(`\nTotal Transactions: ${response.meta.total}`);
    
    console.log('\n=== SAMPLE TRANSACTIONS ===');
    const sampleCount = Math.min(3, response.data.vsdDailyBalanceInfos.length);
    for (let i = 0; i < sampleCount; i++) {
      const tx = response.data.vsdDailyBalanceInfos[i];
      console.log(`\nTransaction ${i + 1}:`);
      console.log(`  Date: ${AssetCardUtils.formatDate(tx.cashSettledate)}`);
      console.log(`  Type: ${tx.transactionType}`);
      console.log(`  Description: ${tx.description}`);
      console.log(`  Increase: ${AssetCardUtils.formatCurrency(tx.increaseAmount)}`);
      console.log(`  Decrease: ${AssetCardUtils.formatCurrency(Math.abs(tx.decreaseAmount))}`);
      console.log(`  Balance: ${AssetCardUtils.formatCurrency(tx.cumulativeBalance)}`);
    }

    // Basic validation
    expect(response.code).toBe("0");
    expect(response.data).toBeTruthy();
    expect(response.data.vsdDailyBalanceInfos).toBeInstanceOf(Array);
  });
});