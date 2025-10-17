// Câu lệnh chạy: npx playwright test api-withdrawal-history --grep "05.*API"

import { test, expect, Page, APIRequestContext } from '@playwright/test';

// ===========================
// 1. CONFIGURATION
// ===========================
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
    withdrawalHistoryURL: 'https://your-web-domain.com/withdrawal-history',
    credentials: {
      username: 'linhdtt01',
      password: 'Y)7m0Fy!'
    }
  },
  
  // Date range cho testing (YYYYMMDD format)
  dateRange: {
    fromDate: '20250520',  // Có thể custom theo nhu cầu
    toDate: '20250820'     // Có thể custom theo nhu cầu
  }
};

// ===========================
// 2. INTERFACES
// ===========================
interface WithdrawalHistoryTransaction {
  transactionId: string;
  fullName: string;
  fee: number;
  feeType: string;
  accountId: string;
  custodyId: string;
  valueDate: string;
  state: string;
  settleStatus: string;
  amount: number;
  transType: string;
  remark: string;
  feeAmount: number;
  dw: string | null;
  createTime: string;
}

interface WithdrawalHistoryData {
  code: string;
  message: string;
  data: WithdrawalHistoryTransaction[];
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

// ===========================
// 3. UTILS CLASS
// ===========================
class WithdrawalHistoryUtils {
  // Format tiền tệ VN (12,840,000)
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  // Format date DD/MM/YYYY từ "6/26/2025 12:00:00 AM"
  static formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Format date YYYYMMDD cho API params
  static formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  // Format createTime từ "2025-09-04T12:01:07" sang "30/06/2025"
  static formatCreateTime(isoStr: string): string {
    const date = new Date(isoStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Map state code sang badge color
  static mapStateToBadge(state: string): string {
    const stateMap: { [key: string]: string } = {
      'PI': 'Active',      // Processing In
      'R': 'Completed',    // Received
      'PO': 'Pending',     // Processing Out
      'C': 'Rejected'      // Cancelled/Deleted
    };
    return stateMap[state] || state;
  }

  // Log so sánh
  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.includes(apiValue) ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }
}

// ===========================
// 4. API SERVICE CLASS
// ===========================
class WithdrawalHistoryAPIService {
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

  async getWithdrawalHistoryData(
    fromDate?: string,
    toDate?: string,
    status?: string
  ): Promise<WithdrawalHistoryData> {
    const token = await this.login();

    // Sử dụng date từ CONFIG hoặc mặc định 3 tháng gần nhất
    let finalFromDate: string;
    let finalToDate: string;

    if (fromDate && toDate) {
      // Nếu truyền vào cả 2 params
      finalFromDate = fromDate;
      finalToDate = toDate;
    } else if (CONFIG.dateRange.fromDate && CONFIG.dateRange.toDate) {
      // Nếu có config trong CONFIG
      finalFromDate = CONFIG.dateRange.fromDate;
      finalToDate = CONFIG.dateRange.toDate;
    } else {
      // Fallback: 3 tháng gần nhất
      const today = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      finalFromDate = WithdrawalHistoryUtils.formatDateForAPI(threeMonthsAgo);
      finalToDate = WithdrawalHistoryUtils.formatDateForAPI(today);
    }

    console.log(`[INFO] Date Range: ${finalFromDate} → ${finalToDate}`);

    const params: any = {
      acctNo: CONFIG.accountId,
      fromDate: finalFromDate,
      toDate: finalToDate,
      status: status || '',
      dataType: 'HIST'
    };

    const response = await this.request.get(
      `${CONFIG.apiBaseURL}/fos/v1/Cash/transactvsd`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/plain'
        },
        params
      }
    );

    if (response.status() !== 200) {
      const errorText = await response.text();
      throw new Error(`API failed: ${response.status()} - ${errorText}`);
    }

    const responseData: WithdrawalHistoryData = await response.json();

    if (responseData.code !== "0") {
      throw new Error(`API error: ${responseData.code} - ${responseData.message}`);
    }

    // FILTER: Chỉ lấy transactions có dw = "W" (Withdrawal)
    const filteredData = {
      ...responseData,
      data: responseData.data.filter(txn => txn.dw === 'W')
    };

    // Cập nhật lại meta.total sau khi filter
    filteredData.meta.total = filteredData.data.length;

    console.log(`[INFO] Filtered: ${responseData.data.length} → ${filteredData.data.length} transactions (dw="W" only)`);

    return filteredData;
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API WITHDRAWAL HISTORY ===');
    const token = await this.login();
    console.log(`Token: ${token.substring(0, 50)}...`);
    
    const data = await this.getWithdrawalHistoryData();
    console.log('=== DỮ LIỆU WITHDRAWAL HISTORY (dw="W" only) ===');
    console.log(JSON.stringify(data, null, 2));
    console.log(`Tổng số giao dịch Withdrawal: ${data.meta.total}`);
    console.log('=== KẾT NỐI THÀNH CÔNG ===');
  }
}

// ===========================
// 5. WEB SERVICE CLASS
// ===========================
class WithdrawalHistoryWebService {
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

  async navigateToWithdrawalHistory(): Promise<void> {
    await this.page.goto(CONFIG.web.withdrawalHistoryURL);
    // Đợi filters hoặc table xuất hiện
    await this.page.waitForSelector('[data-testid="vsd-withdrawal-history-datepicker-fromdate"]', { timeout: 10000 });
  }

  // Lấy giá trị filter
  async getFilterValue(selector: string): Promise<string | null> {
    try {
      return await this.page.locator(selector).inputValue();
    } catch (error) {
      return null;
    }
  }

  async getDropdownValue(selector: string): Promise<string | null> {
    try {
      return await this.page.locator(selector).textContent();
    } catch (error) {
      return null;
    }
  }

  // Lấy số lượng rows trong table
  async getTableRowCount(): Promise<number> {
    try {
      // Đếm số row động
      return await this.page.locator('[data-testid^="vsd-withdrawal-history-col-date"]').count();
    } catch (error) {
      return 0;
    }
  }

  // Lấy giá trị cell trong table
  async getTableCellValue(rowIndex: number, columnTestId: string): Promise<string | null> {
    try {
      const selector = `[data-testid="${columnTestId}[${rowIndex}]"]`;
      return await this.page.locator(selector).textContent();
    } catch (error) {
      return null;
    }
  }

  // Lấy badge status
  async getStatusBadge(rowIndex: number): Promise<string | null> {
    try {
      const selector = `[data-testid="vsd-withdrawal-history-col-status[${rowIndex}]"]`;
      const badgeText = await this.page.locator(selector).textContent();
      return badgeText?.trim() || null;
    } catch (error) {
      return null;
    }
  }
}

// ===========================
// 6. COMPARATOR CLASS
// ===========================
class WithdrawalHistoryComparator {
  private webService: WithdrawalHistoryWebService;
  private apiData: WithdrawalHistoryData;

  constructor(webService: WithdrawalHistoryWebService, apiData: WithdrawalHistoryData) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareFilters(): Promise<void> {
    console.log('=== SO SÁNH FILTERS ===');

    // From date
    const uiFromDate = await this.webService.getFilterValue('[data-testid="vsd-withdrawal-history-datepicker-fromdate"]');
    console.log(`[INFO] From Date (UI): ${uiFromDate}`);

    // To date
    const uiToDate = await this.webService.getFilterValue('[data-testid="vsd-withdrawal-history-datepicker-todate"]');
    console.log(`[INFO] To Date (UI): ${uiToDate}`);

    // Status dropdown
    const uiStatus = await this.webService.getDropdownValue('[data-testid="vsd-withdrawal-history-dropdown-status"]');
    console.log(`[INFO] Status (UI): ${uiStatus}`);
  }

  async compareTable(): Promise<void> {
    console.log('\n=== SO SÁNH TABLE DATA ===');

    const uiRowCount = await this.webService.getTableRowCount();
    const apiRowCount = this.apiData.data.length;

    console.log(`[INFO] Row count - UI: ${uiRowCount}, API: ${apiRowCount}`);

    // So sánh từng row
    const rowsToCompare = Math.min(uiRowCount, apiRowCount);

    for (let i = 0; i < rowsToCompare; i++) {
      console.log(`\n--- ROW ${i + 1} ---`);
      const apiRow = this.apiData.data[i];

      // Date (createTime)
      const uiDate = await this.webService.getTableCellValue(i, 'vsd-withdrawal-history-col-date');
      const apiDate = WithdrawalHistoryUtils.formatCreateTime(apiRow.createTime);
      WithdrawalHistoryUtils.logComparison('Date', uiDate, apiDate);

      // Beneficiary (fullName - accountId)
      const uiBeneficiary = await this.webService.getTableCellValue(i, 'vsd-withdrawal-history-col-beneficiary');
      const apiBeneficiary = `${apiRow.fullName} - ${apiRow.accountId}`;
      WithdrawalHistoryUtils.logComparison('Beneficiary', uiBeneficiary, apiBeneficiary);

      // Amount
      const uiAmount = await this.webService.getTableCellValue(i, 'vsd-withdrawal-history-col-amount');
      const apiAmount = WithdrawalHistoryUtils.formatCurrency(apiRow.amount);
      WithdrawalHistoryUtils.logComparison('Amount', uiAmount, apiAmount);

      // Fee
      const uiFee = await this.webService.getTableCellValue(i, 'vsd-withdrawal-history-col-fee');
      const apiFee = WithdrawalHistoryUtils.formatCurrency(apiRow.fee);
      WithdrawalHistoryUtils.logComparison('Fee', uiFee, apiFee);

      // Status badge
      const uiStatus = await this.webService.getStatusBadge(i);
      const apiStatus = WithdrawalHistoryUtils.mapStateToBadge(apiRow.state);
      WithdrawalHistoryUtils.logComparison('Status', uiStatus, apiStatus);
    }
  }

  async performFullComparison(): Promise<void> {
    await this.compareFilters();
    await this.compareTable();
    console.log('\n=== HOÀN THÀNH SO SÁNH ===');
  }
}

// ===========================
// 7. TEST SUITE
// ===========================
test.describe('Withdrawal History - API to UI Validation', () => {
  let apiService: WithdrawalHistoryAPIService;
  let withdrawalHistoryData: WithdrawalHistoryData;

  test.beforeAll(async ({ request }) => {
    apiService = new WithdrawalHistoryAPIService(request);
    console.log('Đang lấy dữ liệu Withdrawal History (dw="W" only)...');
    withdrawalHistoryData = await apiService.getWithdrawalHistoryData();
    console.log(`Dữ liệu API sẵn sàng - Tổng ${withdrawalHistoryData.meta.total} giao dịch Withdrawal`);
  });

  test('01 - Kiểm tra kết nối API Withdrawal History', async ({ request }) => {
    const service = new WithdrawalHistoryAPIService(request);
    await service.testConnection();
  });

  test('02 - So sánh đầy đủ API với UI', async ({ page }) => {
    const webService = new WithdrawalHistoryWebService(page);
    await webService.login();
    await webService.navigateToWithdrawalHistory();

    const comparator = new WithdrawalHistoryComparator(webService, withdrawalHistoryData);
    await comparator.performFullComparison();
  });

  test('03 - So sánh chỉ Filters', async ({ page }) => {
    const webService = new WithdrawalHistoryWebService(page);
    await webService.login();
    await webService.navigateToWithdrawalHistory();

    const comparator = new WithdrawalHistoryComparator(webService, withdrawalHistoryData);
    await comparator.compareFilters();
  });

  test('04 - So sánh chỉ Table', async ({ page }) => {
    const webService = new WithdrawalHistoryWebService(page);
    await webService.login();
    await webService.navigateToWithdrawalHistory();

    const comparator = new WithdrawalHistoryComparator(webService, withdrawalHistoryData);
    await comparator.compareTable();
  });

  test('05 - Chỉ test API', async ({ request }) => {
    const service = new WithdrawalHistoryAPIService(request);
    const data = await service.getWithdrawalHistoryData();

    console.log('=== FULL API RESPONSE (dw="W" only) ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== CHI TIẾT FORMATTED ===');
    console.log(`Total Withdrawal transactions: ${data.meta.total}`);
    console.log(`Page: ${data.meta.page}`);
    console.log(`Per page: ${data.meta.perPage}`);

    console.log('\n=== ALL WITHDRAWAL TRANSACTIONS ===');
    data.data.forEach((txn, index) => {
      console.log(`\n--- Transaction ${index + 1} ---`);
      console.log(`Transaction ID: ${txn.transactionId}`);
      console.log(`Full Name: ${txn.fullName}`);
      console.log(`Account ID: ${txn.accountId}`);
      console.log(`Custody ID: ${txn.custodyId}`);
      console.log(`Amount: ${WithdrawalHistoryUtils.formatCurrency(txn.amount)}`);
      console.log(`Fee: ${WithdrawalHistoryUtils.formatCurrency(txn.fee)}`);
      console.log(`Fee Type: ${txn.feeType}`);
      console.log(`Fee Amount: ${WithdrawalHistoryUtils.formatCurrency(txn.feeAmount)}`);
      console.log(`Value Date: ${WithdrawalHistoryUtils.formatDate(txn.valueDate)}`);
      console.log(`Create Time: ${WithdrawalHistoryUtils.formatCreateTime(txn.createTime)}`);
      console.log(`State: ${txn.state} (${WithdrawalHistoryUtils.mapStateToBadge(txn.state)})`);
      console.log(`Settle Status: ${txn.settleStatus}`);
      console.log(`Trans Type: ${txn.transType}`);
      console.log(`Remark: ${txn.remark}`);
      console.log(`DW: ${txn.dw || 'null'}`);
    });

    // Validation
    expect(data).toBeTruthy();
    expect(data.code).toBe('0');
    expect(data.data).toBeInstanceOf(Array);
    expect(data.meta.total).toBeGreaterThanOrEqual(0);
    
    // Validate tất cả transactions đều có dw="W"
    data.data.forEach(txn => {
      expect(txn.dw).toBe('W');
    });
  });
});