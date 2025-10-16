// npx playwright test api-asset-summary --grep "03.*API" 
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
    homeURL: 'https://your-web-domain.com/home',
    credentials: {
      username: 'linhdtt01',
      password: 'Y)7m0Fy!'
    }
  }
};

interface AssetCardData {
  netAssets: number;
  profitLossValue: number;
  assetUtilizationRatio: number;
  requiredSupplement: number;
  totalAssets: number;
  withdrawableCash: number;
  marginCash: number;
  cash: number;
}

interface AssetCardResponse {
  code: string;
  message: string;
  data: AssetCardData;
}

interface LoginResponse {
  token?: string;
  data?: { token?: string };
  accessToken?: string;
}

class AssetCardUtils {
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  static formatPercentage(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  static calculateProfitPercent(profitLoss: number, totalAssets: number): number {
    if (totalAssets === 0) return 0;
    return (profitLoss / totalAssets) * 100;
  }

  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.includes(apiValue) ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }
}

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

  async getAssetCard(): Promise<AssetCardData> {
    const token = await this.login();

    const response = await this.request.get(`${CONFIG.apiBaseURL}/fos/v1/Asset/margin-summary`, {
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

    const responseData: AssetCardResponse = await response.json();

    if (responseData.code !== "0") {
      throw new Error(`API error: ${responseData.code} - ${responseData.message}`);
    }

    return responseData.data;
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API ASSET CARD ===');

    const token = await this.login();
    console.log(`Token: ${token.substring(0, 50)}...`);

    const data = await this.getAssetCard();

    console.log('=== DỮ LIỆU ASSET CARD ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== FORMATTED DATA ===');
    console.log(`Net Assets: ${AssetCardUtils.formatCurrency(data.netAssets)}`);
    console.log(`Profit/Loss: ${AssetCardUtils.formatCurrency(data.profitLossValue)}`);
    console.log(`Margin Call Ratio: ${AssetCardUtils.formatPercentage(data.assetUtilizationRatio)}`);
    console.log(`Required Supplement: ${AssetCardUtils.formatCurrency(data.requiredSupplement)}`);

    console.log('=== KẾT NỐI THÀNH CÔNG ===');
  }
}

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

  async navigateToHome(): Promise<void> {
    await this.page.goto(CONFIG.web.homeURL);
    await this.page.waitForSelector('[data-testid="asset-metric-netassets"]', { timeout: 10000 });
  }

  async getUIValue(selector: string): Promise<string | null> {
    try {
      return await this.page.locator(selector).textContent();
    } catch (error) {
      return null;
    }
  }
}

class AssetCardComparator {
  private webService: AssetCardWebService;
  private apiData: AssetCardData;

  constructor(webService: AssetCardWebService, apiData: AssetCardData) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareMetrics(): Promise<void> {
    console.log('=== SO SÁNH ASSET CARD METRICS ===');

    // Net Assets
    const netAssetsUI = await this.webService.getUIValue('[data-testid="asset-metric-netassets"]');
    const expectedNetAssets = AssetCardUtils.formatCurrency(this.apiData.netAssets);
    AssetCardUtils.logComparison('Net Assets', netAssetsUI, expectedNetAssets);
    if (netAssetsUI) expect(netAssetsUI).toContain(expectedNetAssets);

    // Profit/Loss
    const profitLossUI = await this.webService.getUIValue('[data-testid="asset-metric-profitloss"]');
    const expectedProfitLoss = AssetCardUtils.formatCurrency(this.apiData.profitLossValue);
    AssetCardUtils.logComparison('Profit/Loss', profitLossUI, expectedProfitLoss);
    if (profitLossUI) expect(profitLossUI).toContain(expectedProfitLoss);

    // Profit/Loss %
    const profitPercentUI = await this.webService.getUIValue('[data-testid="asset-badge-profitpercent"]');
    const profitPercent = AssetCardUtils.calculateProfitPercent(
      this.apiData.profitLossValue,
      this.apiData.totalAssets
    );
    const expectedProfitPercent = AssetCardUtils.formatPercentage(profitPercent);
    AssetCardUtils.logComparison('Profit/Loss %', profitPercentUI, expectedProfitPercent);
    if (profitPercentUI) expect(profitPercentUI).toContain(expectedProfitPercent);

    // Margin Call Ratio
    const marginRatioUI = await this.webService.getUIValue('[data-testid="asset-progress-margincallratio"]');
    const expectedMarginRatio = AssetCardUtils.formatPercentage(this.apiData.assetUtilizationRatio);
    AssetCardUtils.logComparison('Margin Call Ratio', marginRatioUI, expectedMarginRatio);
    if (marginRatioUI) expect(marginRatioUI).toContain(expectedMarginRatio);

    // Margin Call Value
    const marginCallUI = await this.webService.getUIValue('[data-testid="asset-metric-margincall"]');
    const expectedMarginCall = AssetCardUtils.formatCurrency(this.apiData.requiredSupplement);
    AssetCardUtils.logComparison('Margin Call Value', marginCallUI, expectedMarginCall);
    if (marginCallUI) expect(marginCallUI).toContain(expectedMarginCall);
  }

  async performFullComparison(): Promise<void> {
    await this.compareMetrics();
    console.log('=== HOÀN THÀNH SO SÁNH ===');
  }
}

test.describe('KIS Asset Card - API to UI Validation', () => {
  let apiService: AssetCardAPIService;
  let assetCardData: AssetCardData;

  test.beforeAll(async ({ request }) => {
    apiService = new AssetCardAPIService(request);
    console.log('Đang lấy dữ liệu Asset Card...');
    assetCardData = await apiService.getAssetCard();
    console.log('Dữ liệu API sẵn sàng');
  });

  test('01 - Kiểm tra kết nối API Asset Card', async ({ request }) => {
    const service = new AssetCardAPIService(request);
    await service.testConnection();
  });

  test('02 - So sánh API với UI', async ({ page }) => {
    const webService = new AssetCardWebService(page);
    await webService.login();
    await webService.navigateToHome();

    const comparator = new AssetCardComparator(webService, assetCardData);
    await comparator.performFullComparison();
  });

  test('03 - Chỉ test API', async ({ request }) => {
    const service = new AssetCardAPIService(request);
    const data = await service.getAssetCard();

    console.log('=== FULL API RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== ASSET CARD METRICS ===');
    console.log(`netAssets: ${AssetCardUtils.formatCurrency(data.netAssets)}`);
    console.log(`profitLossValue: ${AssetCardUtils.formatCurrency(data.profitLossValue)}`);
    const profitPercent = AssetCardUtils.calculateProfitPercent(data.profitLossValue, data.totalAssets);
    console.log(`profitLossPercent: ${AssetCardUtils.formatPercentage(profitPercent)}`);
    console.log(`assetUtilizationRatio: ${AssetCardUtils.formatPercentage(data.assetUtilizationRatio)}`);
    console.log(`requiredSupplement: ${AssetCardUtils.formatCurrency(data.requiredSupplement)}`);

    expect(data.netAssets).toBeGreaterThanOrEqual(0);
    expect(data.assetUtilizationRatio).toBeGreaterThanOrEqual(0);
    expect(data.assetUtilizationRatio).toBeLessThanOrEqual(100);
  });
});