// Câu lệnh chạy: npx playwright test api-user-info --grep "05.*API"

import { test, expect, Page, APIRequestContext } from '@playwright/test';

// ============================================
// CONFIG
// ============================================
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
    userInfoURL: 'https://your-web-domain.com/user-info',
    credentials: {
      username: 'linhdtt01',
      password: 'Y)7m0Fy!'
    }
  }
};

// ============================================
// INTERFACES
// ============================================
interface UserInfoData {
  userId: string;
  name: string;
  nameOther: string;
  idNumber: string;
  idIssueDate: string;
  idIssuePlace: string;
  address: string;
  phone: string;
  mobile: string | null;
  email: string;
  registrationType: string;
  brokerName: string;
  branchName: string;
  statusText: string;
}

interface UserInfoResponse {
  code: string;
  message: string;
  data: UserInfoData;
}

interface LoginResponse {
  token?: string;
  data?: { token?: string };
  accessToken?: string;
}

// ============================================
// UTILS CLASS
// ============================================
class UserInfoUtils {
  static formatDate(dateStr: string): string {
    // API trả về: "06/05/2025" -> UI hiển thị: "20160201"
    const [day, month, year] = dateStr.split('/');
    return `${year}${month}${day}`;
  }

  static formatStatus(status: string): string {
    // Map status text sang color badge
    const statusMap: Record<string, string> = {
      'Hoạt động': 'Active',
      'Không hoạt động': 'Inactive'
    };
    return statusMap[status] || status;
  }

  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.trim() === apiValue.trim() ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }
}

// ============================================
// API SERVICE CLASS
// ============================================
class UserInfoAPIService {
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

  async getUserInfo(): Promise<UserInfoData> {
    const token = await this.login();

    const response = await this.request.get(
      `${CONFIG.apiBaseURL}/fos/v1/User/user-info`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/plain'
        },
        params: {
          accountId: CONFIG.accountId
        }
      }
    );

    if (response.status() !== 200) {
      const errorText = await response.text();
      throw new Error(`API failed: ${response.status()} - ${errorText}`);
    }

    const responseData: UserInfoResponse = await response.json();

    if (responseData.code !== "0") {
      throw new Error(`API error: ${responseData.code} - ${responseData.message}`);
    }

    return responseData.data;
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API USER INFO ===');
    const token = await this.login();
    console.log(`Token: ${token.substring(0, 50)}...`);
    
    const data = await this.getUserInfo();
    console.log('=== DỮ LIỆU USER INFO ===');
    console.log(JSON.stringify(data, null, 2));
    console.log('=== KẾT NỐI THÀNH CÔNG ===');
  }
}

// ============================================
// WEB SERVICE CLASS
// ============================================
class UserInfoWebService {
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

  async navigateToUserInfo(): Promise<void> {
    await this.page.goto(CONFIG.web.userInfoURL);
    await this.page.waitForSelector('[data-testid="account-info-field-phone"]', { timeout: 10000 });
  }

  async getUIValue(selector: string): Promise<string | null> {
    try {
      return await this.page.locator(selector).textContent();
    } catch (error) {
      return null;
    }
  }

  async getUIAttribute(selector: string, attribute: string): Promise<string | null> {
    try {
      return await this.page.locator(selector).getAttribute(attribute);
    } catch (error) {
      return null;
    }
  }
}

// ============================================
// COMPARATOR CLASS
// ============================================
class UserInfoComparator {
  private webService: UserInfoWebService;
  private apiData: UserInfoData;

  constructor(webService: UserInfoWebService, apiData: UserInfoData) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareContactInfo(): Promise<void> {
    console.log('\n=== SO SÁNH CONTACT INFO ===');

    // Phone
    const phoneUI = await this.webService.getUIValue('[data-testid="account-info-field-phone"]');
    UserInfoUtils.logComparison('Phone', phoneUI, this.apiData.phone);
    expect(phoneUI?.trim()).toBe(this.apiData.phone);

    // Email
    const emailUI = await this.webService.getUIValue('[data-testid="account-info-field-email"]');
    UserInfoUtils.logComparison('Email', emailUI, this.apiData.email);
    expect(emailUI?.trim()).toBe(this.apiData.email);

    // Address
    const addressUI = await this.webService.getUIValue('[data-testid="account-info-field-address"]');
    UserInfoUtils.logComparison('Address', addressUI, this.apiData.address);
    expect(addressUI?.trim()).toBe(this.apiData.address);
  }

  async comparePersonalInfo(): Promise<void> {
    console.log('\n=== SO SÁNH PERSONAL INFO ===');

    // Full name
    const fullnameUI = await this.webService.getUIValue('[data-testid="account-info-field-fullname"]');
    UserInfoUtils.logComparison('Full Name', fullnameUI, this.apiData.name);
    expect(fullnameUI?.trim()).toBe(this.apiData.name);

    // User ID
    const useridUI = await this.webService.getUIValue('[data-testid="account-info-field-userid"]');
    UserInfoUtils.logComparison('User ID', useridUI, this.apiData.userId);
    expect(useridUI?.trim()).toBe(this.apiData.userId);

    // Status (badge)
    const statusBadge = await this.webService.getUIValue('[data-testid="account-info-badge-status"]');
    const expectedStatus = UserInfoUtils.formatStatus(this.apiData.statusText);
    UserInfoUtils.logComparison('Status', statusBadge, expectedStatus);
    expect(statusBadge?.trim()).toBe(expectedStatus);

    // ID Number
    const idNumberUI = await this.webService.getUIValue('[data-testid="account-info-field-idnumber"]');
    UserInfoUtils.logComparison('ID Number', idNumberUI, this.apiData.idNumber);
    expect(idNumberUI?.trim()).toBe(this.apiData.idNumber);

    // Issue Date
    const issueDateUI = await this.webService.getUIValue('[data-testid="account-info-field-issuedate"]');
    const expectedDate = UserInfoUtils.formatDate(this.apiData.idIssueDate);
    UserInfoUtils.logComparison('Issue Date', issueDateUI, expectedDate);
    expect(issueDateUI?.trim()).toBe(expectedDate);

    // Issue Place
    const issuePlaceUI = await this.webService.getUIValue('[data-testid="account-info-field-issueplace"]');
    UserInfoUtils.logComparison('Issue Place', issuePlaceUI, this.apiData.idIssuePlace);
    expect(issuePlaceUI?.trim()).toBe(this.apiData.idIssuePlace);

    // Other Name
    const otherNameUI = await this.webService.getUIValue('[data-testid="account-info-field-othername"]');
    UserInfoUtils.logComparison('Other Name', otherNameUI, this.apiData.nameOther);
    expect(otherNameUI?.trim()).toBe(this.apiData.nameOther);
  }

  async compareBrokerInfo(): Promise<void> {
    console.log('\n=== SO SÁNH BROKER INFO ===');

    // Broker Name
    const brokerNameUI = await this.webService.getUIValue('[data-testid="account-info-field-brokerna me"]');
    UserInfoUtils.logComparison('Broker Name', brokerNameUI, this.apiData.brokerName);
    expect(brokerNameUI?.trim()).toBe(this.apiData.brokerName);

    // Branch Name
    const branchNameUI = await this.webService.getUIValue('[data-testid="account-info-field-branchname"]');
    UserInfoUtils.logComparison('Branch Name', branchNameUI, this.apiData.branchName);
    expect(branchNameUI?.trim()).toBe(this.apiData.branchName);
  }

  async performFullComparison(): Promise<void> {
    await this.compareContactInfo();
    await this.comparePersonalInfo();
    await this.compareBrokerInfo();
    console.log('\n=== HOÀN THÀNH SO SÁNH ===');
  }
}

// ============================================
// TEST SUITE
// ============================================
test.describe('User Info - API to UI Validation', () => {
  let apiService: UserInfoAPIService;
  let userInfoData: UserInfoData;

  test.beforeAll(async ({ request }) => {
    apiService = new UserInfoAPIService(request);
    console.log('Đang lấy dữ liệu User Info...');
    userInfoData = await apiService.getUserInfo();
    console.log('Dữ liệu API sẵn sàng');
  });

  test('01 - Kiểm tra kết nối API User Info', async ({ request }) => {
    const service = new UserInfoAPIService(request);
    await service.testConnection();
  });

  test('02 - So sánh đầy đủ API với UI', async ({ page }) => {
    const webService = new UserInfoWebService(page);
    await webService.login();
    await webService.navigateToUserInfo();

    const comparator = new UserInfoComparator(webService, userInfoData);
    await comparator.performFullComparison();
  });

  test('03 - So sánh Contact Info', async ({ page }) => {
    const webService = new UserInfoWebService(page);
    await webService.login();
    await webService.navigateToUserInfo();

    const comparator = new UserInfoComparator(webService, userInfoData);
    await comparator.compareContactInfo();
  });

  test('04 - So sánh Personal Info', async ({ page }) => {
    const webService = new UserInfoWebService(page);
    await webService.login();
    await webService.navigateToUserInfo();

    const comparator = new UserInfoComparator(webService, userInfoData);
    await comparator.comparePersonalInfo();
  });

  test('05 - Chỉ test API', async ({ request }) => {
    const service = new UserInfoAPIService(request);
    const data = await service.getUserInfo();

    console.log('\n=== FULL API RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== CHI TIẾT FORMATTED ===');
    console.log(`User ID: ${data.userId}`);
    console.log(`Name: ${data.name}`);
    console.log(`Name Other: ${data.nameOther}`);
    console.log(`ID Number: ${data.idNumber}`);
    console.log(`ID Issue Date: ${data.idIssueDate}`);
    console.log(`ID Issue Place: ${data.idIssuePlace}`);
    console.log(`Address: ${data.address}`);
    console.log(`Phone: ${data.phone}`);
    console.log(`Mobile: ${data.mobile || 'null'}`);
    console.log(`Email: ${data.email}`);
    console.log(`Registration Type: ${data.registrationType}`);
    console.log(`Broker Name: ${data.brokerName}`);
    console.log(`Branch Name: ${data.branchName}`);
    console.log(`Status: ${data.statusText}`);

    expect(data).toBeTruthy();
    expect(data.userId).toBeTruthy();
  });
});