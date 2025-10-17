// Câu lệnh chạy: npx playwright test api-bank-transfer-history --grep "05.*API"

import { test, expect, Page, APIRequestContext } from '@playwright/test';

// CONFIG
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
    bankTransferHistoryURL: 'https://your-web-domain.com/bank-transfer-history',
    credentials: {
      username: 'linhdtt01',
      password: 'Y)7m0Fy!'
    }
  }
};

// INTERFACES
interface BankTransferRecord {
  transId: string;
  transDate: string;
  valueDate: string;
  clientId: string;
  accountId: string;
  transactionCode: string;
  accountName: string;
  accountBranchId: string;
  accountAE: string;
  accountAEBranchId: string;
  toBankId: string;
  toBankBranch: string;
  toBankAccNo: string;
  toBankAccName: string;
  bankId: string;
  bankName: string;
  bankAccId: string;
  cwType: string;
  amount: number;
  state: string;
  remark: string;
  createBy: string;
  createTime: string;
  approveBy: string;
  approveTime: string;
  fromDate: string;
  toDate: string;
  toBankName: string;
  fee: number;
}

interface BankTransferHistoryResponse {
  code: string;
  message: string;
  data: BankTransferRecord[];
}

interface LoginResponse {
  token?: string;
  data?: { token?: string };
  accessToken?: string;
}

// UTILS CLASS
class BankTransferHistoryUtils {
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  static formatDateFromYYYYMMDD(dateStr: string): string {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}/${month}/${year}`;
  }

  static formatDateFromISO(dateStr: string): string {
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

  static mapStateToDisplay(state: string): string {
    const stateMap: { [key: string]: string } = {
      'A': 'Thành công',
      'PI': 'Chờ duyệt thêm mới',
      'PR': 'Chờ duyệt từ chối',
      'PC': 'Chờ duyệt hủy',
      'R': 'Đã từ chối',
      'D': 'Đã xóa'
    };
    return stateMap[state] || state;
  }

  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.includes(apiValue) ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }
}

// API SERVICE CLASS
// API SERVICE CLASS - FIXED VERSION
class BankTransferHistoryAPIService {
  private page?: Page;
  private cachedToken?: string;
  private context?: any; // BrowserContext

  constructor(pageOrRequest: Page | APIRequestContext) {
    if ('goto' in pageOrRequest) {
      this.page = pageOrRequest as Page;
    }
  }

  async login(): Promise<string> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    if (!this.page) {
      throw new Error('Page context required for API calls');
    }

    // Gọi login API qua browser
    const loginResponse = await this.page.evaluate(async (config) => {
      const response = await fetch(`${config.ssoBaseURL}/api/v1/Auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.apiCredentials)
      });
      return response.json();
    }, CONFIG);

    const token = loginResponse.token || loginResponse.data?.token || loginResponse.accessToken;

    if (!token) {
      throw new Error('Không lấy được token');
    }

    this.cachedToken = token;
    return token;
  }

  async getBankTransferHistoryData(
    valueFromDate: string = '',
    valueToDate: string = '',
    recordState: string = '',
    dataType: string = 'INDAY'
  ): Promise<BankTransferRecord[]> {
    const token = await this.login();

    if (!this.page) {
      throw new Error('Page context required for API calls');
    }

    // Gọi API qua browser với fetch
    const apiResponse = await this.page.evaluate(async ({ config, token, params }) => {
      const url = new URL(`${config.apiBaseURL}/fos/v1/Cash/query-cash-movement-ssi`);
      url.searchParams.append('accountId', config.accountId);
      url.searchParams.append('valueFromDate', params.valueFromDate);
      url.searchParams.append('valueToDate', params.valueToDate);
      url.searchParams.append('recordState', params.recordState);
      url.searchParams.append('dataType', params.dataType);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/plain'
        }
      });

      if (!response.ok) {
        throw new Error(`API failed: ${response.status}`);
      }

      return response.json();
    }, {
      config: CONFIG,
      token,
      params: { valueFromDate, valueToDate, recordState, dataType }
    });

    if (apiResponse.code !== "0") {
      throw new Error(`API error: ${apiResponse.code} - ${apiResponse.message}`);
    }

    return apiResponse.data || [];
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API BANK TRANSFER HISTORY ===');
    const token = await this.login();
    console.log(`Token: ${token.substring(0, 50)}...`);
    
    const data = await this.getBankTransferHistoryData();
    console.log('=== DỮ LIỆU BANK TRANSFER HISTORY ===');
    console.log(JSON.stringify(data, null, 2));
    console.log(`=== TÌM THẤY ${data.length} GIAO DỊCH ===`);
    console.log('=== KẾT NỐI THÀNH CÔNG ===');
  }
}

// WEB SERVICE CLASS
class BankTransferHistoryWebService {
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

  async navigateToBankTransferHistory(): Promise<void> {
    await this.page.goto(CONFIG.web.bankTransferHistoryURL);
    await this.page.waitForSelector('[data-testid="bank-transfer-history-datepickerfromdate"]', { timeout: 10000 });
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
      return await this.page.locator('[data-testid^="bank-transfer-history-col-date-"]').count();
    } catch (error) {
      return 0;
    }
  }

  async setDateFilter(fromDate: string, toDate: string): Promise<void> {
    await this.page.locator('[data-testid="bank-transfer-history-datepickerfromdate"]').fill(fromDate);
    await this.page.locator('[data-testid="bank-transfer-history-datepickertodate"]').fill(toDate);
  }

  async setStatusFilter(status: string): Promise<void> {
    await this.page.locator('[data-testid="bank-transfer-history-dropdownstatus"]').selectOption(status);
  }
}

// COMPARATOR CLASS
class BankTransferHistoryComparator {
  private webService: BankTransferHistoryWebService;
  private apiData: BankTransferRecord[];

  constructor(webService: BankTransferHistoryWebService, apiData: BankTransferRecord[]) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareTable(): Promise<void> {
    console.log('=== SO SÁNH BẢNG LỊCH SỬ CHUYỂN KHOẢN ===');
    
    const rowCount = await this.webService.getTableRowCount();
    console.log(`Số dòng UI: ${rowCount}`);
    console.log(`Số dòng API: ${this.apiData.length}`);

    if (rowCount !== this.apiData.length) {
      console.log(`[MISMATCH] Số lượng giao dịch - UI: ${rowCount}, API: ${this.apiData.length}`);
    } else {
      console.log(`[MATCH] Số lượng giao dịch khớp: ${rowCount}`);
    }

    const compareCount = Math.min(rowCount, this.apiData.length);

    for (let i = 0; i < compareCount; i++) {
      console.log(`\n--- Giao dịch ${i + 1} ---`);
      const record = this.apiData[i];

      // Date
      const uiDate = await this.webService.getUIValue(`[data-testid="bank-transfer-history-col-date-${i}"]`);
      const apiDate = BankTransferHistoryUtils.formatDateFromYYYYMMDD(record.transDate);
      BankTransferHistoryUtils.logComparison(`Date [${i}]`, uiDate, apiDate);

      // Beneficiary
      const uiBeneficiary = await this.webService.getUIValue(`[data-testid="bank-transfer-history-col-beneficiary-${i}"]`);
      const apiBeneficiary = `${record.accountName} - ${record.toBankAccNo} - ${record.toBankAccName}`;
      BankTransferHistoryUtils.logComparison(`Beneficiary [${i}]`, uiBeneficiary, record.toBankAccNo);

      // Amount
      const uiAmount = await this.webService.getUIValue(`[data-testid="bank-transfer-history-col-amount-${i}"]`);
      const apiAmount = BankTransferHistoryUtils.formatCurrency(record.amount);
      BankTransferHistoryUtils.logComparison(`Amount [${i}]`, uiAmount, apiAmount);

      // Fee
      const uiFee = await this.webService.getUIValue(`[data-testid="bank-transfer-history-colfee-${i}"]`);
      const apiFee = record.fee > 0 ? BankTransferHistoryUtils.formatCurrency(record.fee) : '—';
      BankTransferHistoryUtils.logComparison(`Fee [${i}]`, uiFee, apiFee);

      // Status
      const uiStatus = await this.webService.getUIValue(`[data-testid="bank-transfer-history-badgestatus-${i}"]`);
      const apiStatus = record.state;
      BankTransferHistoryUtils.logComparison(`Status [${i}]`, uiStatus, apiStatus);

      // Remark
      const uiRemark = await this.webService.getUIValue(`[data-testid="bank-transfer-history-colremark-${i}"]`);
      const apiRemark = record.remark || '—';
      BankTransferHistoryUtils.logComparison(`Remark [${i}]`, uiRemark, apiRemark);
    }

    console.log('\n=== HOÀN THÀNH SO SÁNH BẢNG ===');
  }

  async performFullComparison(): Promise<void> {
    await this.compareTable();
  }
}

// TEST SUITE
test.describe('Bank Transfer History - API to UI Validation', () => {
  let apiService: BankTransferHistoryAPIService;
  let historyData: BankTransferRecord[];

  test('01 - Kiểm tra kết nối API Bank Transfer History', async ({ request }) => {
    const service = new BankTransferHistoryAPIService(request);
    await service.testConnection();
  });

  test('02 - So sánh đầy đủ API với UI', async ({ page }) => {
    // Init API service với page
    const apiService = new BankTransferHistoryAPIService(page);
    const historyData = await apiService.getBankTransferHistoryData();

    const webService = new BankTransferHistoryWebService(page);
    await webService.login();
    await webService.navigateToBankTransferHistory();

    const comparator = new BankTransferHistoryComparator(webService, historyData);
    await comparator.performFullComparison();
  });

  test('03 - So sánh chỉ bảng', async ({ page }) => {
    const apiService = new BankTransferHistoryAPIService(page);
    const historyData = await apiService.getBankTransferHistoryData();

    const webService = new BankTransferHistoryWebService(page);
    await webService.login();
    await webService.navigateToBankTransferHistory();

    const comparator = new BankTransferHistoryComparator(webService, historyData);
    await comparator.compareTable();
  });

  test('04 - Test filter theo date range', async ({ page }) => {
    const apiService = new BankTransferHistoryAPIService(page);
    
    const webService = new BankTransferHistoryWebService(page);
    await webService.login();
    await webService.navigateToBankTransferHistory();

    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    const fromDate = BankTransferHistoryUtils.formatDateForAPI(threeMonthsAgo);
    const toDate = BankTransferHistoryUtils.formatDateForAPI(today);

    console.log(`Testing filter: ${fromDate} to ${toDate}`);
    
    const filteredData = await apiService.getBankTransferHistoryData(fromDate, toDate);
    console.log(`Found ${filteredData.length} transactions in date range`);

    const comparator = new BankTransferHistoryComparator(webService, filteredData);
    await comparator.compareTable();
  });

  test('05 - Chỉ test API', async ({ page }) => {
    const service = new BankTransferHistoryAPIService(page);
    const data = await service.getBankTransferHistoryData();

    console.log('=== FULL API RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== CHI TIẾT FORMATTED ===');
    console.log(`Tổng số giao dịch: ${data.length}`);
    
    data.forEach((record, index) => {
      console.log(`\n--- Giao dịch ${index + 1} ---`);
      console.log(`transId: ${record.transId}`);
      console.log(`transDate: ${BankTransferHistoryUtils.formatDateFromYYYYMMDD(record.transDate)}`);
      console.log(`valueDate: ${BankTransferHistoryUtils.formatDateFromISO(record.valueDate)}`);
      console.log(`clientId: ${record.clientId}`);
      console.log(`accountId: ${record.accountId}`);
      console.log(`transactionCode: ${record.transactionCode}`);
      console.log(`accountName: ${record.accountName}`);
      console.log(`toBankAccNo: ${record.toBankAccNo}`);
      console.log(`toBankAccName: ${record.toBankAccName}`);
      console.log(`bankName: ${record.bankName}`);
      console.log(`amount: ${BankTransferHistoryUtils.formatCurrency(record.amount)}`);
      console.log(`fee: ${record.fee > 0 ? BankTransferHistoryUtils.formatCurrency(record.fee) : '0'}`);
      console.log(`state: ${record.state}`);
      console.log(`remark: ${record.remark || '—'}`);
      console.log(`createTime: ${record.createTime}`);
      console.log(`cwType: ${record.cwType}`);
      console.log(`toBankName: ${record.toBankName}`);
    });

    expect(data).toBeTruthy();
    expect(Array.isArray(data)).toBe(true);
  });
});