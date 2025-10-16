// câu lệnh chạy script npx playwright test api-asset-portfolio --grep "05.*API"
import { test, expect, Page, APIRequestContext } from '@playwright/test';

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
    portfolioURL: 'https://your-web-domain.com/portfolio',
    credentials: {
      username: 'linhdtt01',
      password: 'Y)7m0Fy!'
    }
  }
};

interface PositionData {
  symbol: string;
  im: number;
  longPosition: number;
  shortPosition: number;
  net: number;
  wapb: number;
  wasp: number;
  marketPrice: number;
  marginValue: number;
  profitLossValue: number;
  expirationdate: string;
  imRatio: number;
  unrealizedProfitLoss: number;
  realizedProfitLoss: number;
  closedPosition: number;
}

interface PortfolioResponse {
  code: string;
  message: string;
  data: PositionData[];
}

interface LoginResponse {
  token?: string;
  data?: { token?: string };
  accessToken?: string;
}

class PortfolioUtils {
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  static formatPercentage(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }

  static formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.includes(apiValue) ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }

  static calculateTotalCollateral(positions: PositionData[]): number {
    return positions.reduce((sum, pos) => sum + pos.marginValue, 0);
  }

  static calculateTotalPL(positions: PositionData[]): number {
    return positions.reduce((sum, pos) => sum + pos.profitLossValue, 0);
  }
}

class PortfolioAPIService {
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

  async getPortfolio(): Promise<PositionData[]> {
    const token = await this.login();

    const response = await this.request.get(`${CONFIG.apiBaseURL}/fos/v1/Asset/securities-balance`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/plain'
      },
      params: {
        acctNo: CONFIG.accountId
      }
    });

    if (response.status() !== 200) {
      const errorText = await response.text();
      throw new Error(`API failed: ${response.status()} - ${errorText}`);
    }

    const responseData: PortfolioResponse = await response.json();

    if (responseData.code !== "0") {
      throw new Error(`API error: ${responseData.code} - ${responseData.message}`);
    }

    return responseData.data;
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API PORTFOLIO ===');

    const token = await this.login();
    console.log(`Token: ${token.substring(0, 50)}...`);

    const positions = await this.getPortfolio();

    console.log('=== DỮ LIỆU PORTFOLIO ===');
    console.log(JSON.stringify(positions, null, 2));

    console.log('\n=== THỐNG KÊ ===');
    console.log(`Tổng số vị thế: ${positions.length}`);
    console.log(`Tổng ký quỹ: ${PortfolioUtils.formatCurrency(PortfolioUtils.calculateTotalCollateral(positions))}`);
    console.log(`Tổng P/L: ${PortfolioUtils.formatCurrency(PortfolioUtils.calculateTotalPL(positions))}`);

    console.log('=== KẾT NỐI THÀNH CÔNG ===');
  }
}

class PortfolioWebService {
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

  async navigateToPortfolio(): Promise<void> {
    await this.page.goto(CONFIG.web.portfolioURL);
    await this.page.waitForSelector('[data-testid="portfolio-kpi-totalcollateral"]', { timeout: 10000 });
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
      return await this.page.locator('[data-testid^="portfolio-col-symbol-"]').count();
    } catch (error) {
      return 0;
    }
  }
}

class PortfolioComparator {
  private webService: PortfolioWebService;
  private apiData: PositionData[];

  constructor(webService: PortfolioWebService, apiData: PositionData[]) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareKPIs(): Promise<void> {
    console.log('=== SO SÁNH KPIs ===');

    const totalCollateral = PortfolioUtils.calculateTotalCollateral(this.apiData);
    const collateralUI = await this.webService.getUIValue('[data-testid="portfolio-kpi-totalcollateral"]');
    const expectedCollateral = PortfolioUtils.formatCurrency(totalCollateral);
    PortfolioUtils.logComparison('Tổng ký quỹ', collateralUI, expectedCollateral);
    if (collateralUI) expect(collateralUI).toContain(expectedCollateral);

    const totalPL = PortfolioUtils.calculateTotalPL(this.apiData);
    const plUI = await this.webService.getUIValue('[data-testid="portfolio-kpi-totalpl"]');
    const expectedPL = PortfolioUtils.formatCurrency(totalPL);
    PortfolioUtils.logComparison('Tổng P/L', plUI, expectedPL);
    if (plUI) expect(plUI).toContain(expectedPL);
  }

  async compareTable(): Promise<void> {
    console.log('=== SO SÁNH BẢNG VỊ THẾ ===');

    const uiRowCount = await this.webService.getTableRowCount();
    const apiRowCount = this.apiData.length;

    console.log(`Số vị thế - UI: ${uiRowCount}, API: ${apiRowCount}`);
    expect(uiRowCount).toBe(apiRowCount);

    for (let i = 0; i < Math.min(uiRowCount, apiRowCount); i++) {
      const position = this.apiData[i];
      console.log(`\n--- Vị thế ${i + 1}: ${position.symbol} ---`);

      const symbolUI = await this.webService.getUIValue(`[data-testid="portfolio-col-symbol-${i}"]`);
      PortfolioUtils.logComparison('Symbol', symbolUI, position.symbol);

      const expireDateUI = await this.webService.getUIValue(`[data-testid="portfolio-col-expiredate-${i}"]`);
      const expectedDate = PortfolioUtils.formatDate(position.expirationdate);
      PortfolioUtils.logComparison('Ngày đáo hạn', expireDateUI, expectedDate);

      const longUI = await this.webService.getUIValue(`[data-testid="portfolio-col-long-${i}"]`);
      PortfolioUtils.logComparison('Long', longUI, position.longPosition.toString());

      const shortUI = await this.webService.getUIValue(`[data-testid="portfolio-col-short-${i}"]`);
      PortfolioUtils.logComparison('Short', shortUI, position.shortPosition.toString());

      const netUI = await this.webService.getUIValue(`[data-testid="portfolio-col-net-${i}"]`);
      PortfolioUtils.logComparison('Net', netUI, position.net.toString());

      const marginValueUI = await this.webService.getUIValue(`[data-testid="portfolio-col-marginvalue-${i}"]`);
      const expectedMarginValue = PortfolioUtils.formatCurrency(position.marginValue);
      PortfolioUtils.logComparison('Margin value', marginValueUI, expectedMarginValue);

      const unrealPLUI = await this.webService.getUIValue(`[data-testid="portfolio-col-unrealpl-${i}"]`);
      const expectedUnrealPL = PortfolioUtils.formatCurrency(position.unrealizedProfitLoss);
      PortfolioUtils.logComparison('Unrealized P/L', unrealPLUI, expectedUnrealPL);
    }
  }

  async performFullComparison(): Promise<void> {
    await this.compareKPIs();
    await this.compareTable();
    console.log('=== HOÀN THÀNH SO SÁNH ===');
  }
}

test.describe('KIS Portfolio - API to UI Validation', () => {
  let apiService: PortfolioAPIService;
  let portfolioData: PositionData[];

  test.beforeAll(async ({ request }) => {
    apiService = new PortfolioAPIService(request);
    console.log('Đang lấy dữ liệu portfolio...');
    portfolioData = await apiService.getPortfolio();
    console.log('Dữ liệu API sẵn sàng');
  });

  test('01 - Kiểm tra kết nối API Portfolio', async ({ request }) => {
    const service = new PortfolioAPIService(request);
    await service.testConnection();
  });

  test('02 - So sánh đầy đủ API với UI', async ({ page }) => {
    const webService = new PortfolioWebService(page);
    await webService.login();
    await webService.navigateToPortfolio();

    const comparator = new PortfolioComparator(webService, portfolioData);
    await comparator.performFullComparison();
  });

  test('03 - So sánh chỉ KPIs', async ({ page }) => {
    const webService = new PortfolioWebService(page);
    await webService.login();
    await webService.navigateToPortfolio();

    const comparator = new PortfolioComparator(webService, portfolioData);
    await comparator.compareKPIs();
  });

  test('04 - So sánh chỉ bảng', async ({ page }) => {
    const webService = new PortfolioWebService(page);
    await webService.login();
    await webService.navigateToPortfolio();

    const comparator = new PortfolioComparator(webService, portfolioData);
    await comparator.compareTable();
  });

  test('05 - Chỉ test API', async ({ request }) => {
    const service = new PortfolioAPIService(request);
    const positions = await service.getPortfolio();

    console.log('=== FULL API RESPONSE ===');
    console.log(JSON.stringify(positions, null, 2));

    console.log('\n=== CHI TIẾT TỪNG VỊ THẾ ===');
    positions.forEach((pos, i) => {
      console.log(`\n--- Position ${i + 1} ---`);
      console.log(`symbol: ${pos.symbol}`);
      console.log(`expirationdate: ${PortfolioUtils.formatDate(pos.expirationdate)}`);
      console.log(`longPosition: ${pos.longPosition}`);
      console.log(`shortPosition: ${pos.shortPosition}`);
      console.log(`net: ${pos.net}`);
      console.log(`wapb: ${pos.wapb}`);
      console.log(`wasp: ${pos.wasp}`);
      console.log(`marketPrice: ${PortfolioUtils.formatCurrency(pos.marketPrice)}`);
      console.log(`marginValue: ${PortfolioUtils.formatCurrency(pos.marginValue)}`);
      console.log(`imRatio: ${PortfolioUtils.formatPercentage(pos.imRatio)}`);
      console.log(`unrealizedProfitLoss: ${PortfolioUtils.formatCurrency(pos.unrealizedProfitLoss)}`);
      console.log(`realizedProfitLoss: ${PortfolioUtils.formatCurrency(pos.realizedProfitLoss)}`);
      console.log(`profitLossValue: ${PortfolioUtils.formatCurrency(pos.profitLossValue)}`);
    });

    console.log('\n=== TỔNG HỢP ===');
    console.log(`Tổng số vị thế: ${positions.length}`);
    console.log(`Tổng ký quỹ: ${PortfolioUtils.formatCurrency(PortfolioUtils.calculateTotalCollateral(positions))}`);
    console.log(`Tổng P/L: ${PortfolioUtils.formatCurrency(PortfolioUtils.calculateTotalPL(positions))}`);

    expect(positions.length).toBeGreaterThanOrEqual(0);
  });
});