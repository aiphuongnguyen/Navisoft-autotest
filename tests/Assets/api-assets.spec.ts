// Câu lệnh chạy: npx playwright test api-assets --grep "05.*API"
import { test, expect, Page, APIRequestContext } from '@playwright/test';

// Cấu hình hệ thống
const CONFIG = {
  // API Configuration
  ssoBaseURL: 'https://derivativeapisso.navisoft.com.vn',
  apiBaseURL: 'https://derivativeapi.navisoft.com.vn', 
  apiCredentials: {
    userName: 'test2',
    password: '123456',
    loginType: 'ALL',
    grantType: 'password'
  },
  accountId: 'TEST028',
  
  // Web UI Configuration
  web: {
    loginURL: 'https://your-web-domain.com/login',
    assetURL: 'https://your-web-domain.com/asset',
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
  [key: string]: any;
}

interface AssetData {
  cash: number;
  unsettledCash: number;
  totalTransactionFee: number;
  exchangeTransactionFee: number;
  brokerageTransactionFee: number;
  tax: number;
  positionManagementFee: number;
  marginCash: number;
  marginStockValue: number;
  validAssets: number;
  withdrawableCash: number;
  requiredSupplement: number;
  netAssets: number;
  marginManagementFee: number;
  initialMargin: number;
  transferMargin: number;
  profitLossValue: number;
  withdrawableMargin: number;
  partnershipAmount: number;
  totalAssets: number;
  vsdAccountRatio: number;
  accountStatus: string;
  requiredMargin: number;
  pendingVSDProcessing: number;
  dailyPendingDepositIM: number;
  dailyPendingWithdrawIM: number;
  assetUtilizationRatio: number;
  unrealizedProfitLoss: number;
  dailypendingwithdrawalssi: number;
  realizedProfitLoss: number;
  cashBuyingPower: number;
}

interface APIResponse {
  code: string;
  message: string;
  data: AssetData;
}

// Utility Functions
class APIUtils {
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  static formatPercentage(value: number): string {
    return `${value}%`;
  }

  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.includes(apiValue) ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }
}

// API Service Class
class KISAPIService {
  private request: APIRequestContext;
  private cachedToken?: string;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  async login(): Promise<string> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    const loginConfigs = [
      { url: `${CONFIG.ssoBaseURL}/api/v1/Auth`, name: 'SSO Auth' },
      { url: `${CONFIG.apiBaseURL}/api/v1/Auth`, name: 'API Auth' },
      { url: `${CONFIG.apiBaseURL}/fos/v1/Auth/login`, name: 'FOS Login' }
    ];

    for (const config of loginConfigs) {
      try {
        console.log(`Thử đăng nhập: ${config.name} - ${config.url}`);
        
        const response = await this.request.post(config.url, {
          headers: { 'Content-Type': 'application/json' },
          data: CONFIG.apiCredentials
        });

        if (response.status() === 200) {
          const data: LoginResponse = await response.json();
          const token = data.token || data.data?.token || data.accessToken;
          
          if (token) {
            console.log(`Đăng nhập thành công với ${config.name}`);
            console.log(`Token length: ${token.length}`);
            this.cachedToken = token;
            return token;
          }
        } else {
          const errorText = await response.text();
          console.log(`${config.name} failed: ${response.status()} - ${errorText}`);
        }
      } catch (error: any) {
        console.log(`${config.name} error: ${error.message}`);
      }
    }

    throw new Error('Không thể đăng nhập với tất cả các endpoints');
  }

  async getAssetData(): Promise<AssetData> {
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
      throw new Error(`API Asset failed: ${response.status()} - ${errorText}`);
    }

    const responseData: APIResponse = await response.json();
    
    if (responseData.code !== "0") {
      throw new Error(`API returned error code: ${responseData.code} - ${responseData.message}`);
    }

    return responseData.data;
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API ===');
    
    try {
      const token = await this.login();
      console.log(`Token: ${token.substring(0, 50)}...`);
      
      const data = await this.getAssetData();
      console.log('=== DỮ LIỆU ASSET ===');
      console.log(`Tổng tài sản: ${APIUtils.formatCurrency(data.totalAssets)}`);
      console.log(`Tài sản ròng: ${APIUtils.formatCurrency(data.netAssets)}`);
      console.log(`Tiền có thể rút: ${APIUtils.formatCurrency(data.withdrawableCash)}`);
      console.log(`Tiền mặt: ${APIUtils.formatCurrency(data.cash)}`);
      console.log('=== KẾT NỐI API THÀNH CÔNG ===');
      
    } catch (error: any) {
      console.error('KẾT NỐI API THẤT BẠI:', error.message);
      throw error;
    }
  }
}

// Web Service Class
class KISWebService {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async login(): Promise<void> {
    console.log('Đang đăng nhập web...');
    
    await this.page.goto(CONFIG.web.loginURL);
    
    // Chờ form login hiển thị
    await this.page.waitForSelector('[data-testid="login-input-username"]', { timeout: 10000 });
    
    // Nhập thông tin đăng nhập
    await this.page.locator('[data-testid="login-input-username"]').fill(CONFIG.web.credentials.username);
    await this.page.locator('[data-testid="login-input-password"]').fill(CONFIG.web.credentials.password);
    
    // Nhấn nút đăng nhập
    await this.page.locator('[data-testid="login-action-submit"]').click();
    
    // Chờ điều hướng sau khi đăng nhập
    await this.page.waitForLoadState('networkidle');
    
    console.log('Đăng nhập web thành công');
  }

  async navigateToAsset(): Promise<void> {
    await this.page.goto(CONFIG.web.assetURL);
    await this.page.waitForSelector('[data-testid="asset-kpi-totalasset"]', { timeout: 10000 });
    console.log('Đã điều hướng đến trang Asset');
  }

  async getUIValue(selector: string): Promise<string | null> {
    try {
      return await this.page.locator(selector).textContent();
    } catch (error) {
      console.log(`Không tìm thấy element: ${selector}`);
      return null;
    }
  }

  async verifyLoginElements(): Promise<void> {
    await this.page.goto(CONFIG.web.loginURL);
    
    const elements = [
      '[data-testid="login-input-username"]',
      '[data-testid="login-input-password"]', 
      '[data-testid="login-action-submit"]'
    ];

    for (const selector of elements) {
      await expect(this.page.locator(selector)).toBeVisible();
    }
    
    console.log('Tất cả elements trên trang login đã hiển thị');
  }
}

// Asset UI-API Comparison Class  
class AssetComparator {
  private webService: KISWebService;
  private apiData: AssetData;

  constructor(webService: KISWebService, apiData: AssetData) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareKPIs(): Promise<void> {
    console.log('=== SO SÁNH KPIs ===');
    
    // Tổng tài sản
    const totalAssetUI = await this.webService.getUIValue('[data-testid="asset-kpi-totalasset"]');
    const expectedTotalAsset = APIUtils.formatCurrency(this.apiData.totalAssets);
    APIUtils.logComparison('Tổng tài sản', totalAssetUI, expectedTotalAsset);
    if (totalAssetUI) expect(totalAssetUI).toContain(expectedTotalAsset);

    // Tài sản ròng  
    const netAssetUI = await this.webService.getUIValue('[data-testid="asset-kpi-netasset"]');
    const expectedNetAsset = APIUtils.formatCurrency(this.apiData.netAssets);
    APIUtils.logComparison('Tài sản ròng', netAssetUI, expectedNetAsset);
    if (netAssetUI) expect(netAssetUI).toContain(expectedNetAsset);

    // Tiền có thể rút
    const withdrawableUI = await this.webService.getUIValue('[data-testid="asset-kpi-withdrawable"]');
    const expectedWithdrawable = APIUtils.formatCurrency(this.apiData.withdrawableCash);
    APIUtils.logComparison('Tiền có thể rút', withdrawableUI, expectedWithdrawable);
    if (withdrawableUI) expect(withdrawableUI).toContain(expectedWithdrawable);

    // Tỷ lệ sử dụng tài sản
    const utilizationUI = await this.webService.getUIValue('[data-testid="asset-kpi-assetutilization"]');
    const expectedUtilization = APIUtils.formatPercentage(this.apiData.assetUtilizationRatio);
    APIUtils.logComparison('Tỷ lệ sử dụng', utilizationUI, expectedUtilization);
    if (utilizationUI) expect(utilizationUI).toContain(expectedUtilization);
  }

  async compareCashSection(): Promise<void> {
    console.log('=== SO SÁNH TIỀN MẶT ===');
    
    // Tổng tiền mặt
    const cashTotalUI = await this.webService.getUIValue('[data-testid="asset-metric-cashtotal"]');
    const expectedCashTotal = APIUtils.formatCurrency(this.apiData.cash);
    APIUtils.logComparison('Tổng tiền mặt', cashTotalUI, expectedCashTotal);
    if (cashTotalUI) expect(cashTotalUI).toContain(expectedCashTotal);

    // Tiền chưa thanh toán
    const unsettledUI = await this.webService.getUIValue('[data-testid="asset-metric-unsettledcash"]');
    const expectedUnsettled = this.apiData.unsettledCash === 0 ? '—' : APIUtils.formatCurrency(this.apiData.unsettledCash);
    APIUtils.logComparison('Tiền chưa thanh toán', unsettledUI, expectedUnsettled);
    if (unsettledUI) expect(unsettledUI).toContain(expectedUnsettled);
  }

  async compareMarginSection(): Promise<void> {
    console.log('=== SO SÁNH KÝ QUỸ ===');
    
    // Ký quỹ tiền mặt
    const marginCashUI = await this.webService.getUIValue('[data-testid="asset-metric-cashmargin"]');
    const expectedMarginCash = APIUtils.formatCurrency(this.apiData.marginCash);
    APIUtils.logComparison('Ký quỹ tiền mặt', marginCashUI, expectedMarginCash);
    if (marginCashUI) expect(marginCashUI).toContain(expectedMarginCash);

    // Ký quỹ có thể rút
    const withdrawableMarginUI = await this.webService.getUIValue('[data-testid="asset-progress-withdrawablemargin"]');
    const expectedWithdrawableMargin = APIUtils.formatCurrency(this.apiData.withdrawableMargin);
    APIUtils.logComparison('Ký quỹ có thể rút', withdrawableMarginUI, expectedWithdrawableMargin);
    if (withdrawableMarginUI) expect(withdrawableMarginUI).toContain(expectedWithdrawableMargin);
  }

  async compareFeesSection(): Promise<void> {
    console.log('=== SO SÁNH PHÍ VÀ THUẾ ===');
    
    // Tổng phí
    const totalFeeUI = await this.webService.getUIValue('[data-testid="asset-kpi-totalfee"]');
    const expectedTotalFee = APIUtils.formatCurrency(this.apiData.totalTransactionFee);
    APIUtils.logComparison('Tổng phí', totalFeeUI, expectedTotalFee);
    if (totalFeeUI) expect(totalFeeUI).toContain(expectedTotalFee);

    // Phí quản lý ký quỹ
    const marginFeeUI = await this.webService.getUIValue('[data-testid="asset-metric-marginfees"]');
    const expectedMarginFee = APIUtils.formatCurrency(this.apiData.marginManagementFee);
    APIUtils.logComparison('Phí quản lý ký quỹ', marginFeeUI, expectedMarginFee);
    if (marginFeeUI) expect(marginFeeUI).toContain(expectedMarginFee);
  }

  async performFullComparison(): Promise<void> {
    await this.compareKPIs();
    await this.compareCashSection();
    await this.compareMarginSection();
    await this.compareFeesSection();
    console.log('=== HOÀN THÀNH SO SÁNH TẤT CẢ DỮ LIỆU ===');
  }
}

// Test Suite
test.describe('KIS Asset - API to UI Validation', () => {
  let apiService: KISAPIService;
  let assetData: AssetData;

  test.beforeAll(async ({ request }) => {
    apiService = new KISAPIService(request);
    console.log('Đang lấy dữ liệu từ API...');
    assetData = await apiService.getAssetData();
    console.log('Dữ liệu API đã sẵn sàng');
  });

  test('01 - Kiểm tra kết nối API', async ({ request }) => {
    const service = new KISAPIService(request);
    await service.testConnection();
  });

  test('02 - Kiểm tra trang đăng nhập web', async ({ page }) => {
    const webService = new KISWebService(page);
    await webService.verifyLoginElements();
  });

  test('03 - So sánh đầy đủ API với UI', async ({ page }) => {
    const webService = new KISWebService(page);
    
    // Đăng nhập và điều hướng
    await webService.login();
    await webService.navigateToAsset();
    
    // Thực hiện so sánh
    const comparator = new AssetComparator(webService, assetData);
    await comparator.performFullComparison();
  });

  test('04 - So sánh chỉ KPIs', async ({ page }) => {
    const webService = new KISWebService(page);
    await webService.login();
    await webService.navigateToAsset();
    
    const comparator = new AssetComparator(webService, assetData);
    await comparator.compareKPIs();
  });

  test('05 - Chỉ test API', async ({ request }) => {
    const service = new KISAPIService(request);
    const data = await service.getAssetData();
    
    console.log('=== FULL API RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n=== FORMATTED DATA ===');
    console.log(`cash: ${APIUtils.formatCurrency(data.cash)}`);
    console.log(`unsettledCash: ${APIUtils.formatCurrency(data.unsettledCash)}`);
    console.log(`totalTransactionFee: ${APIUtils.formatCurrency(data.totalTransactionFee)}`);
    console.log(`exchangeTransactionFee: ${APIUtils.formatCurrency(data.exchangeTransactionFee)}`);
    console.log(`brokerageTransactionFee: ${APIUtils.formatCurrency(data.brokerageTransactionFee)}`);
    console.log(`tax: ${APIUtils.formatCurrency(data.tax)}`);
    console.log(`positionManagementFee: ${APIUtils.formatCurrency(data.positionManagementFee)}`);
    console.log(`marginCash: ${APIUtils.formatCurrency(data.marginCash)}`);
    console.log(`marginStockValue: ${APIUtils.formatCurrency(data.marginStockValue)}`);
    console.log(`withdrawableCash: ${APIUtils.formatCurrency(data.withdrawableCash)}`);
    console.log(`requiredSupplement: ${APIUtils.formatCurrency(data.requiredSupplement)}`);
    console.log(`netAssets: ${APIUtils.formatCurrency(data.netAssets)}`);
    console.log(`marginManagementFee: ${APIUtils.formatCurrency(data.marginManagementFee)}`);
    console.log(`initialMargin: ${APIUtils.formatCurrency(data.initialMargin)}`);
    console.log(`transferMargin: ${APIUtils.formatCurrency(data.transferMargin)}`);
    console.log(`profitLossValue: ${APIUtils.formatCurrency(data.profitLossValue || 0)}`);
    console.log(`withdrawableMargin: ${APIUtils.formatCurrency(data.withdrawableMargin)}`);
    console.log(`partnershipAmount: ${APIUtils.formatCurrency(data.partnershipAmount)}`);
    console.log(`totalAssets: ${APIUtils.formatCurrency(data.totalAssets)}`);
    console.log(`assetUtilizationRatio: ${APIUtils.formatPercentage(data.assetUtilizationRatio)}`);
    console.log(`unrealizedProfitLoss: ${APIUtils.formatCurrency(data.unrealizedProfitLoss || 0)}`);
    console.log(`accountStatus: ${data.accountStatus}`);
    console.log(`pendingVSDProcessing: ${APIUtils.formatCurrency(data.pendingVSDProcessing || 0)}`);
    console.log(`dailyPendingDepositIM: ${APIUtils.formatCurrency(data.dailyPendingDepositIM)}`);
    console.log(`dailyPendingWithdrawIM: ${APIUtils.formatCurrency(data.dailyPendingWithdrawIM)}`);
    console.log(`assetUtilizationRatio: ${APIUtils.formatCurrency(data.assetUtilizationRatio)}`);

    
    // Validate dữ liệu cơ bản
    expect(data.totalAssets).toBeGreaterThanOrEqual(0);
    expect(data.netAssets).toBeGreaterThanOrEqual(0);
    expect(data.assetUtilizationRatio).toBeGreaterThanOrEqual(0);
    expect(data.assetUtilizationRatio).toBeLessThanOrEqual(100);
  });
});