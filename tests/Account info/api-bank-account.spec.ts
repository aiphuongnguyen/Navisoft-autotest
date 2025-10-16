// Câu lệnh chạy: npx playwright test api-bank-account --grep "05.*API"

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
    bankAccountURL: 'https://your-web-domain.com/bank-account',
    credentials: {
      username: 'linhdtt01',
      password: 'Y)7m0Fy!'
    }
  }
};

// ============================================
// INTERFACES
// ============================================
interface BankAccountData {
  bankAccNo: string;
  bankAccName: string;
  isDefault: string;
  description: string | null;
  bankName: string;
  bankNameOther: string | null;
  bankId: string;
  bankBranchId: string;
}

interface BankAccountResponse {
  code: string;
  message: string;
  data: BankAccountData[];
}

interface LoginResponse {
  token?: string;
  data?: { token?: string };
  accessToken?: string;
}

// ============================================
// UTILS CLASS
// ============================================
class BankAccountUtils {
  static maskAccountNumber(accNo: string): string {
    // Mask account number: "35523543" -> "***3543" (ẩn 4 số đầu)
    if (accNo.length <= 4) return accNo;
    return '***' + accNo.slice(-4);
  }

  static formatDefault(isDefault: string): string {
    // Map "Y"/"N" to display text
    return isDefault === 'Y' ? 'Yes' : 'No';
  }

  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.trim() === apiValue.trim() ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }

  static logTableRow(index: number, data: BankAccountData): void {
    console.log(`\n--- Row ${index} ---`);
    console.log(`Bank Name: ${data.bankName}`);
    console.log(`Account Number: ${data.bankAccNo}`);
    console.log(`Account Name: ${data.bankAccName}`);
    console.log(`Is Default: ${data.isDefault}`);
  }
}

// ============================================
// API SERVICE CLASS
// ============================================
class BankAccountAPIService {
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

  async getBankAccounts(): Promise<BankAccountData[]> {
    const token = await this.login();

    const response = await this.request.get(
      `${CONFIG.apiBaseURL}/fos/v1/AccountQuery/get-account-bank`,
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

    const responseData: BankAccountResponse = await response.json();

    if (responseData.code !== "0") {
      throw new Error(`API error: ${responseData.code} - ${responseData.message}`);
    }

    return responseData.data;
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API BANK ACCOUNT ===');
    const token = await this.login();
    console.log(`Token: ${token.substring(0, 50)}...`);
    
    const data = await this.getBankAccounts();
    console.log('=== DỮ LIỆU BANK ACCOUNTS ===');
    console.log(JSON.stringify(data, null, 2));
    console.log(`Total accounts: ${data.length}`);
    console.log('=== KẾT NỐI THÀNH CÔNG ===');
  }
}

// ============================================
// WEB SERVICE CLASS
// ============================================
class BankAccountWebService {
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

  async navigateToBankAccount(): Promise<void> {
    await this.page.goto(CONFIG.web.bankAccountURL);
    await this.page.waitForSelector('[data-testid="account-info-col-bankname[0]"]', { timeout: 10000 });
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
      // Đếm số row dựa trên bankName column
      const count = await this.page.locator('[data-testid^="account-info-col-bankname"]').count();
      return count;
    } catch (error) {
      return 0;
    }
  }

  async getTableCellValue(column: string, rowIndex: number): Promise<string | null> {
    const selector = `[data-testid="account-info-col-${column}[${rowIndex}]"]`;
    return await this.getUIValue(selector);
  }
}

// ============================================
// COMPARATOR CLASS
// ============================================
class BankAccountComparator {
  private webService: BankAccountWebService;
  private apiData: BankAccountData[];

  constructor(webService: BankAccountWebService, apiData: BankAccountData[]) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareTableRowCount(): Promise<void> {
    console.log('\n=== SO SÁNH SỐ LƯỢNG ROWS ===');
    
    const uiRowCount = await this.webService.getTableRowCount();
    const apiRowCount = this.apiData.length;

    BankAccountUtils.logComparison('Row Count', String(uiRowCount), String(apiRowCount));
    expect(uiRowCount).toBe(apiRowCount);
  }

  async compareTableData(): Promise<void> {
    console.log('\n=== SO SÁNH DỮ LIỆU BẢNG ===');

    for (let i = 0; i < this.apiData.length; i++) {
      const apiRow = this.apiData[i];
      BankAccountUtils.logTableRow(i, apiRow);

      // Bank Name
      const bankNameUI = await this.webService.getTableCellValue('bankname', i);
      BankAccountUtils.logComparison(`Row ${i} - Bank Name`, bankNameUI, apiRow.bankName);
      expect(bankNameUI?.trim()).toBe(apiRow.bankName);

      // Account Number (masked)
      const accNoUI = await this.webService.getTableCellValue('bankaccno', i);
      const expectedAccNo = BankAccountUtils.maskAccountNumber(apiRow.bankAccNo);
      BankAccountUtils.logComparison(`Row ${i} - Account Number`, accNoUI, expectedAccNo);
      expect(accNoUI?.trim()).toBe(expectedAccNo);
    }
  }

  async performFullComparison(): Promise<void> {
    await this.compareTableRowCount();
    await this.compareTableData();
    console.log('\n=== HOÀN THÀNH SO SÁNH ===');
  }
}

// ============================================
// TEST SUITE
// ============================================
test.describe('Bank Account - API to UI Validation', () => {
  let apiService: BankAccountAPIService;
  let bankAccountData: BankAccountData[];

  test.beforeAll(async ({ request }) => {
    apiService = new BankAccountAPIService(request);
    console.log('Đang lấy dữ liệu Bank Accounts...');
    bankAccountData = await apiService.getBankAccounts();
    console.log(`Dữ liệu API sẵn sàng - Tổng ${bankAccountData.length} accounts`);
  });

  test('01 - Kiểm tra kết nối API Bank Account', async ({ request }) => {
    const service = new BankAccountAPIService(request);
    await service.testConnection();
  });

  test('02 - So sánh đầy đủ API với UI', async ({ page }) => {
    const webService = new BankAccountWebService(page);
    await webService.login();
    await webService.navigateToBankAccount();

    const comparator = new BankAccountComparator(webService, bankAccountData);
    await comparator.performFullComparison();
  });

  test('03 - So sánh số lượng rows', async ({ page }) => {
    const webService = new BankAccountWebService(page);
    await webService.login();
    await webService.navigateToBankAccount();

    const comparator = new BankAccountComparator(webService, bankAccountData);
    await comparator.compareTableRowCount();
  });

  test('04 - So sánh dữ liệu bảng', async ({ page }) => {
    const webService = new BankAccountWebService(page);
    await webService.login();
    await webService.navigateToBankAccount();

    const comparator = new BankAccountComparator(webService, bankAccountData);
    await comparator.compareTableData();
  });

  test('05 - Chỉ test API', async ({ request }) => {
    const service = new BankAccountAPIService(request);
    const data = await service.getBankAccounts();

    console.log('\n=== FULL API RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== CHI TIẾT FORMATTED ===');
    data.forEach((account, index) => {
      console.log(`\n--- Account ${index + 1} ---`);
      console.log(`Bank Account Number: ${account.bankAccNo}`);
      console.log(`Bank Account Name: ${account.bankAccName}`);
      console.log(`Is Default: ${account.isDefault}`);
      console.log(`Description: ${account.description || 'null'}`);
      console.log(`Bank Name: ${account.bankName}`);
      console.log(`Bank Name Other: ${account.bankNameOther || 'null'}`);
      console.log(`Bank ID: ${account.bankId}`);
      console.log(`Bank Branch ID: ${account.bankBranchId}`);
      console.log(`Masked Account Number: ${BankAccountUtils.maskAccountNumber(account.bankAccNo)}`);
    });

    expect(data).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
  });
});