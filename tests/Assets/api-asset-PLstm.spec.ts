//npx playwright test api-asset-PLstm.spec.ts --grep "05.*API"
import { test, expect, Page, APIRequestContext } from '@playwright/test';

// Cấu hình
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
    plStatementURL: 'https://your-web-domain.com/pl-statement',
    credentials: {
      username: 'linhdtt01',
      password: 'Y)7m0Fy!'
    }
  }
};

// API Response Interfaces
interface LoginResponse {
  token?: string;
  data?: { token?: string };
  accessToken?: string;
}

interface DailyPLInfo {
  cashSettledate: string;
  transactionType: string;
  increaseAmount: number;
  decreaseAmount: number;
  descriptionVN: string;
  descriptionEN: string;
}

interface PLStatementData {
  increaseAmount: number;
  decreaseAmount: number;
  profitLossDifference: number;
  totalFeeTax: number;
  netProfitLossAfterTax: number;
  profitLossStmtDailyInfos: DailyPLInfo[];
}

interface PLStatementResponse {
  code: string;
  message: string;
  data: PLStatementData;
  meta: {
    total: number;
    page: number;
    perPage: number;
  };
}

// Utility Functions
class PLUtils {
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  static formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  static formatDateForAPI(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}${month}${day}`;
  }

  static parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.includes(apiValue) ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }
}

// API Service
class PLStatementAPIService {
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
      throw new Error('Không lấy được token từ API');
    }

    this.cachedToken = token;
    return token;
  }

  async getPLStatement(fromDate: string, toDate: string): Promise<PLStatementData> {
    const token = await this.login();

    const response = await this.request.get(`${CONFIG.apiBaseURL}/fos/v1/Asset/profit-loss-stmt`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/plain'
      },
      params: {
        accountId: CONFIG.accountId,
        fromDate: fromDate,  // Format: YYYYMMDD
        toDate: toDate       // Format: YYYYMMDD
      }
    });

    if (response.status() !== 200) {
      const errorText = await response.text();
      throw new Error(`API failed: ${response.status()} - ${errorText}`);
    }

    const responseData: PLStatementResponse = await response.json();

    if (responseData.code !== "0") {
      throw new Error(`API error: ${responseData.code} - ${responseData.message}`);
    }

    return responseData.data;
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API P/L STATEMENT ===');

    const token = await this.login();
    console.log(`Token: ${token.substring(0, 50)}...`);

    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);

    const fromDate = PLUtils.formatDate(lastMonth);
    const toDate = PLUtils.formatDate(today);

    const data = await this.getPLStatement(fromDate, toDate);

    console.log('=== DỮ LIỆU P/L STATEMENT ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== FORMATTED DATA ===');
    console.log(`Tổng lãi: ${PLUtils.formatCurrency(data.increaseAmount)}`);
    console.log(`Tổng lỗ: ${PLUtils.formatCurrency(data.decreaseAmount)}`);
    console.log(`Chênh lệch: ${PLUtils.formatCurrency(data.profitLossDifference)}`);
    console.log(`Phí & thuế: ${PLUtils.formatCurrency(data.totalFeeTax)}`);
    console.log(`Lãi/lỗ ròng: ${PLUtils.formatCurrency(data.netProfitLossAfterTax)}`);
    console.log(`Số bản ghi: ${data.profitLossStmtDailyInfos.length}`);

    console.log('=== KẾT NỐI API THÀNH CÔNG ===');
  }
}

// Web Service
class PLStatementWebService {
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

  async navigateToPLStatement(): Promise<void> {
    await this.page.goto(CONFIG.web.plStatementURL);
    await this.page.waitForSelector('[data-testid="pl-statement-field-fromdate"]', { timeout: 10000 });
  }

  async queryPLStatement(fromDate: string, toDate: string): Promise<void> {
    // Nhập from date
    await this.page.locator('[data-testid="pl-statement-field-fromdate"]').fill(fromDate);

    // Nhập to date
    await this.page.locator('[data-testid="pl-statement-field-todate"]').fill(toDate);

    // Click query button
    await this.page.locator('[data-testid="pl-statement-action-query"]').click();

    // Đợi loading
    await this.page.waitForLoadState('networkidle');
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
      const rows = await this.page.locator('[data-testid^="pl-statement-col-settlementdate-"]').count();
      return rows;
    } catch (error) {
      return 0;
    }
  }
}

// Comparator Class
class PLStatementComparator {
  private webService: PLStatementWebService;
  private apiData: PLStatementData;

  constructor(webService: PLStatementWebService, apiData: PLStatementData) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareKPIs(): Promise<void> {
    console.log('=== SO SÁNH KPIs ===');

    // Profit
    const profitUI = await this.webService.getUIValue('[data-testid="pl-statement-kpi-profit"]');
    const expectedProfit = PLUtils.formatCurrency(this.apiData.increaseAmount);
    PLUtils.logComparison('Tổng lãi', profitUI, expectedProfit);
    if (profitUI) expect(profitUI).toContain(expectedProfit);

    // Loss
    const lossUI = await this.webService.getUIValue('[data-testid="pl-statement-kpi-loss"]');
    const expectedLoss = PLUtils.formatCurrency(this.apiData.decreaseAmount);
    PLUtils.logComparison('Tổng lỗ', lossUI, expectedLoss);
    if (lossUI) expect(lossUI).toContain(expectedLoss);

    // Difference
    const diffUI = await this.webService.getUIValue('[data-testid="pl-statement-kpi-diff"]');
    const expectedDiff = PLUtils.formatCurrency(this.apiData.profitLossDifference);
    PLUtils.logComparison('Chênh lệch', diffUI, expectedDiff);
    if (diffUI) expect(diffUI).toContain(expectedDiff);

    // Fee & Tax
    const feeTaxUI = await this.webService.getUIValue('[data-testid="pl-statement-kpi-feetax"]');
    const expectedFeeTax = PLUtils.formatCurrency(this.apiData.totalFeeTax);
    PLUtils.logComparison('Phí & thuế', feeTaxUI, expectedFeeTax);
    if (feeTaxUI) expect(feeTaxUI).toContain(expectedFeeTax);

    // Net After Tax
    const netAfterTaxUI = await this.webService.getUIValue('[data-testid="pl-statement-kpi-netaftertax"]');
    const expectedNetAfterTax = PLUtils.formatCurrency(this.apiData.netProfitLossAfterTax);
    PLUtils.logComparison('Lãi/lỗ ròng', netAfterTaxUI, expectedNetAfterTax);
    if (netAfterTaxUI) expect(netAfterTaxUI).toContain(expectedNetAfterTax);
  }

  async compareTable(): Promise<void> {
    console.log('=== SO SÁNH BẢNG DỮ LIỆU ===');

    const uiRowCount = await this.webService.getTableRowCount();
    const apiRowCount = this.apiData.profitLossStmtDailyInfos.length;

    console.log(`Số dòng - UI: ${uiRowCount}, API: ${apiRowCount}`);
    expect(uiRowCount).toBe(apiRowCount);

    // So sánh từng dòng
    for (let i = 0; i < Math.min(uiRowCount, apiRowCount); i++) {
      const apiRow = this.apiData.profitLossStmtDailyInfos[i];

      console.log(`\n--- Dòng ${i + 1} ---`);

      // Settlement date
      const dateUI = await this.webService.getUIValue(`[data-testid="pl-statement-col-settlementdate-${i}"]`);
      PLUtils.logComparison('Ngày thanh toán', dateUI, apiRow.cashSettledate);

      // Transaction type
      const typeUI = await this.webService.getUIValue(`[data-testid="pl-statement-col-transtype-${i}"]`);
      PLUtils.logComparison('Loại giao dịch', typeUI, apiRow.transactionType);

      // Daily increase
      const increaseUI = await this.webService.getUIValue(`[data-testid="pl-statement-col-dailyincrease-${i}"]`);
      const expectedIncrease = PLUtils.formatCurrency(apiRow.increaseAmount);
      PLUtils.logComparison('Tăng', increaseUI, expectedIncrease);

      // Daily decrease
      const decreaseUI = await this.webService.getUIValue(`[data-testid="pl-statement-col-dailydecrease-${i}"]`);
      const expectedDecrease = PLUtils.formatCurrency(apiRow.decreaseAmount);
      PLUtils.logComparison('Giảm', decreaseUI, expectedDecrease);
    }
  }

  async performFullComparison(): Promise<void> {
    await this.compareKPIs();
    await this.compareTable();
    console.log('=== HOÀN THÀNH SO SÁNH ===');
  }
}

// Test Suite
test.describe('KIS P/L Statement - API to UI Validation', () => {
  let apiService: PLStatementAPIService;
  let fromDate: string;
  let toDate: string;
  let plData: PLStatementData;

  test.beforeAll(async ({ request }) => {
    apiService = new PLStatementAPIService(request);

    // Tạo date range: 1 tháng gần nhất
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);

    fromDate = PLUtils.formatDateForAPI(lastMonth);  // Format YYYYMMDD cho API
    toDate = PLUtils.formatDateForAPI(today);        // Format YYYYMMDD cho API

    console.log(`Date range (API format): ${fromDate} - ${toDate}`);
    console.log('Đang lấy dữ liệu từ API...');

    plData = await apiService.getPLStatement(fromDate, toDate);
    console.log('Dữ liệu API đã sẵn sàng');
  });

  test('01 - Kiểm tra kết nối API P/L Statement', async ({ request }) => {
    const service = new PLStatementAPIService(request);
    
    console.log('=== KIỂM TRA KẾT NỐI API P/L STATEMENT ===');

    const token = await service.login();
    console.log(`Token: ${token.substring(0, 50)}...`);

    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);

    const fromDate = PLUtils.formatDateForAPI(lastMonth);
    const toDate = PLUtils.formatDateForAPI(today);

    console.log(`Date range: ${fromDate} - ${toDate}`);

    const data = await service.getPLStatement(fromDate, toDate);

    console.log('=== DỮ LIỆU P/L STATEMENT ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== FORMATTED DATA ===');
    console.log(`Tổng lãi: ${PLUtils.formatCurrency(data.increaseAmount)}`);
    console.log(`Tổng lỗ: ${PLUtils.formatCurrency(data.decreaseAmount)}`);
    console.log(`Chênh lệch: ${PLUtils.formatCurrency(data.profitLossDifference)}`);
    console.log(`Phí & thuế: ${PLUtils.formatCurrency(data.totalFeeTax)}`);
    console.log(`Lãi/lỗ ròng: ${PLUtils.formatCurrency(data.netProfitLossAfterTax)}`);
    console.log(`Số bản ghi: ${data.profitLossStmtDailyInfos.length}`);

    console.log('=== KẾT NỐI API THÀNH CÔNG ===');
  });

  test('02 - So sánh đầy đủ API với UI', async ({ page }) => {
    const webService = new PLStatementWebService(page);

    // Đăng nhập và điều hướng
    await webService.login();
    await webService.navigateToPLStatement();

    // Query với date range
    await webService.queryPLStatement(fromDate, toDate);

    // So sánh dữ liệu
    const comparator = new PLStatementComparator(webService, plData);
    await comparator.performFullComparison();
  });

  test('03 - So sánh chỉ KPIs', async ({ page }) => {
    const webService = new PLStatementWebService(page);
    await webService.login();
    await webService.navigateToPLStatement();
    await webService.queryPLStatement(fromDate, toDate);

    const comparator = new PLStatementComparator(webService, plData);
    await comparator.compareKPIs();
  });

  test('04 - So sánh chỉ bảng dữ liệu', async ({ page }) => {
    const webService = new PLStatementWebService(page);
    await webService.login();
    await webService.navigateToPLStatement();
    await webService.queryPLStatement(fromDate, toDate);

    const comparator = new PLStatementComparator(webService, plData);
    await comparator.compareTable();
  });

  test('05 - Chỉ test API', async ({ request }) => {
    const service = new PLStatementAPIService(request);
    const data = await service.getPLStatement(fromDate, toDate);

    console.log('=== FULL API RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== FORMATTED DATA ===');
    console.log(`increaseAmount: ${PLUtils.formatCurrency(data.increaseAmount)}`);
    console.log(`decreaseAmount: ${PLUtils.formatCurrency(data.decreaseAmount)}`);
    console.log(`profitLossDifference: ${PLUtils.formatCurrency(data.profitLossDifference)}`);
    console.log(`totalFeeTax: ${PLUtils.formatCurrency(data.totalFeeTax)}`);
    console.log(`netProfitLossAfterTax: ${PLUtils.formatCurrency(data.netProfitLossAfterTax)}`);
    console.log(`Daily records: ${data.profitLossStmtDailyInfos.length}`);

    // Validate
    expect(data.profitLossDifference).toBe(data.increaseAmount + data.decreaseAmount);
  });
}); 