// Câu lệnh chạy: npx playwright test api-market-event --grep "05.*API"

// 1. IMPORTS
import { test, expect, Page, BrowserContext } from '@playwright/test';

// 2. CONFIG
const CONFIG = {
  vietStockBaseURL: 'https://finance.vietstock.vn',
  
  web: {
    loginURL: 'https://your-web-domain.com/login',
    eventsURL: 'https://your-web-domain.com/events',
    credentials: {
      username: 'linhdtt01',
      password: 'Y)7m0Fy!'
    }
  }
};

// 3. INTERFACES
interface EventData {
  EventID: number;
  EventTypeID: number;
  ChannelID: number;
  Code: string;
  CompanyName: string;
  CatID: number;
  GDKHQDate: string;
  NDKCCDate: string;
  Time: string | null;
  Note: string;
  Name: string;
  Exchange: string;
  Title: string;
  Content: string;
  FileUrl: string;
  DateOrder: string;
  Row: number;
}

interface EventsAPIParams {
  eventTypeID: string;
  channelID: string;
  code: string;
  catID: string;
  fDate: string;
  tDate: string;
  page: string;
  pageSize: string;
  orderBy: string;
  orderDir: string;
}

// 4. UTILS CLASS
class EventsUtils {
  static formatDate(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    
    const match = dateStr.match(/\/Date\((\d+)\)\//);
    if (!match) return 'N/A';
    
    const timestamp = parseInt(match[1]);
    const date = new Date(timestamp);
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  }

  static extractDividendRate(note: string): string {
    if (!note) return 'N/A';
    
    const moneyMatch = note.match(/(\d[\d,]*)\s*đồng\/CP/i);
    if (moneyMatch) {
      return moneyMatch[1];
    }
    
    const ratioMatch = note.match(/tỷ\s*lệ\s*100:(\d+)/i);
    if (ratioMatch) {
      return `${ratioMatch[1]}%`;
    }
    
    return 'N/A';
  }

  static formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static getThisWeekRange(): { from: string; to: string } {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      from: this.formatDateForAPI(monday),
      to: this.formatDateForAPI(sunday)
    };
  }

  static logComparison(fieldName: string, uiValue: string | null, apiValue: string): void {
    const match = uiValue?.includes(apiValue) ? 'MATCH' : 'MISMATCH';
    console.log(`[${match}] ${fieldName} - UI: "${uiValue}", API: "${apiValue}"`);
  }
}

// 5. API SERVICE CLASS (Sử dụng Browser Context)
class EventsAPIService {
  private context: BrowserContext;
  private apiPage?: Page;

  constructor(context: BrowserContext) {
    this.context = context;
  }

  async initializePage(): Promise<Page> {
    if (this.apiPage) {
      return this.apiPage;
    }

    console.log('Khởi tạo browser page cho API...');
    this.apiPage = await this.context.newPage();
    
    // Navigate to main page để lấy cookies và token
    await this.apiPage.goto(`${CONFIG.vietStockBaseURL}/lich-su-kien.htm`, {
      waitUntil: 'domcontentloaded'
    });
    
    console.log('Page initialized successfully');
    return this.apiPage;
  }

  async getEventsData(params: Partial<EventsAPIParams>): Promise<EventData[]> {
    const page = await this.initializePage();

    const defaultParams: EventsAPIParams = {
      eventTypeID: '1',
      channelID: '0',
      code: '',
      catID: '-1',
      fDate: '2025-04-01',
      tDate: '2025-06-28',
      page: '1',
      pageSize: '20',
      orderBy: 'Date1',
      orderDir: 'DESC'
    };

    const finalParams = { ...defaultParams, ...params };

    try {
      // Execute fetch from browser context để tránh compression issue
      const responseData = await page.evaluate(async (params) => {
        const formData = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          formData.append(key, value as string);
        });

        // Get verification token from page
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement;
        if (tokenInput && tokenInput.value) {
          formData.append('__RequestVerificationToken', tokenInput.value);
        }

        const response = await fetch('/data/eventstypedata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: formData.toString()
        });

        if (!response.ok) {
          throw new Error(`API failed: ${response.status}`);
        }

        return response.json();
      }, finalParams);

      // API returns nested array [[{...}]]
      if (Array.isArray(responseData) && responseData.length > 0 && Array.isArray(responseData[0])) {
        return responseData[0];
      }

      return [];
    } catch (error: any) {
      console.error(`Error fetching events data: ${error.message}`);
      throw error;
    }
  }

  async testConnection(): Promise<void> {
    console.log('=== KIỂM TRA KẾT NỐI API EVENTS ===');
    
    const data = await this.getEventsData({
      fDate: '2025-04-01',
      tDate: '2025-06-28',
      page: '1',
      pageSize: '5'
    });
    
    console.log('=== DỮ LIỆU EVENTS ===');
    console.log(JSON.stringify(data, null, 2));
    console.log(`Tổng số sự kiện: ${data.length}`);
    console.log('=== KẾT NỐI THÀNH CÔNG ===');
  }

  async close(): Promise<void> {
    if (this.apiPage) {
      await this.apiPage.close();
    }
  }
}

// 6. WEB SERVICE CLASS
class EventsWebService {
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

  async navigateToEvents(): Promise<void> {
    await this.page.goto(CONFIG.web.eventsURL);
    await this.page.waitForSelector('[data-testid="events-input-fromdate"]', { timeout: 10000 });
  }

  async setDateRange(fromDate: string, toDate: string): Promise<void> {
    await this.page.locator('[data-testid="events-input-fromdate"]').fill(fromDate);
    await this.page.locator('[data-testid="events-input-todate"]').fill(toDate);
  }

  async clickQuery(): Promise<void> {
    await this.page.locator('[data-testid="events-action-query"]').click();
    await this.page.waitForTimeout(1000);
  }

  async getUIValue(selector: string): Promise<string | null> {
    try {
      return await this.page.locator(selector).textContent();
    } catch (error) {
      return null;
    }
  }

  async getDividendEventsCount(): Promise<number> {
    const text = await this.getUIValue('[data-testid="events-label-dividend"]');
    return text ? parseInt(text) || 0 : 0;
  }

  async getThisWeekCount(): Promise<number> {
    const text = await this.getUIValue('[data-testid="events-label-thisweek"]');
    return text ? parseInt(text) || 0 : 0;
  }

  async getTableRowCount(): Promise<number> {
    try {
      return await this.page.locator('[data-testid="events-label-title"]').count();
    } catch (error) {
      return 0;
    }
  }

  async getTableRowData(index: number): Promise<{
    title: string | null;
    exDate: string | null;
    recordDate: string | null;
    exerciseDate: string | null;
    dividendRate: string | null;
  }> {
    const base = `[data-testid="events-label-title"]:nth-of-type(${index + 1})`;
    
    return {
      title: await this.getUIValue(`${base} ~ [data-testid="events-label-title"]`),
      exDate: await this.getUIValue(`${base} ~ [data-testid="events-label-exdate"]`),
      recordDate: await this.getUIValue(`${base} ~ [data-testid="events-label-recorddate"]`),
      exerciseDate: await this.getUIValue(`${base} ~ [data-testid="events-label-exercisedate"]`),
      dividendRate: await this.getUIValue(`${base} ~ [data-testid="events-label-dividendrate"]`)
    };
  }
}

// 7. COMPARATOR CLASS
class EventsComparator {
  private webService: EventsWebService;
  private apiData: EventData[];

  constructor(webService: EventsWebService, apiData: EventData[]) {
    this.webService = webService;
    this.apiData = apiData;
  }

  async compareSummary(): Promise<void> {
    console.log('=== SO SÁNH SUMMARY ===');
    
    const dividendCount = this.apiData.filter(e => e.EventTypeID === 1).length;
    const uiDividendCount = await this.webService.getDividendEventsCount();
    console.log(`[${dividendCount === uiDividendCount ? 'MATCH' : 'MISMATCH'}] Dividend Events - UI: ${uiDividendCount}, API: ${dividendCount}`);
  }

  async compareTable(): Promise<void> {
    console.log('=== SO SÁNH BẢNG ===');
    
    const uiRowCount = await this.webService.getTableRowCount();
    console.log(`Số dòng UI: ${uiRowCount}, API: ${this.apiData.length}`);
    
    const compareCount = Math.min(uiRowCount, this.apiData.length, 5);
    
    for (let i = 0; i < compareCount; i++) {
      console.log(`\n--- Dòng ${i + 1} ---`);
      const apiEvent = this.apiData[i];
      const uiRow = await this.webService.getTableRowData(i);
      
      EventsUtils.logComparison('Title', uiRow.title, apiEvent.Title);
      
      const apiExDate = EventsUtils.formatDate(apiEvent.GDKHQDate);
      EventsUtils.logComparison('Ex-right Date', uiRow.exDate, apiExDate);
      
      const apiRecordDate = EventsUtils.formatDate(apiEvent.NDKCCDate);
      EventsUtils.logComparison('Record Date', uiRow.recordDate, apiRecordDate);
      
      const apiExerciseDate = EventsUtils.formatDate(apiEvent.Time);
      EventsUtils.logComparison('Exercise Date', uiRow.exerciseDate, apiExerciseDate);
      
      const apiDividendRate = EventsUtils.extractDividendRate(apiEvent.Note);
      EventsUtils.logComparison('Dividend Rate', uiRow.dividendRate, apiDividendRate);
    }
  }

  async performFullComparison(): Promise<void> {
    await this.compareSummary();
    await this.compareTable();
    console.log('=== HOÀN THÀNH SO SÁNH ===');
  }
}

// 8. TEST SUITE
test.describe('Events Screen - API to UI Validation', () => {
  let apiService: EventsAPIService;
  let eventsData: EventData[];

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    apiService = new EventsAPIService(context);
    
    console.log('Đang lấy dữ liệu events...');
    eventsData = await apiService.getEventsData({
      fDate: '2025-04-01',
      tDate: '2025-06-28',
      page: '1',
      pageSize: '20'
    });
    console.log(`Dữ liệu API sẵn sàng: ${eventsData.length} events`);
  });

  test.afterAll(async () => {
    if (apiService) {
      await apiService.close();
    }
  });

  test('01 - Kiểm tra kết nối API Events', async ({ browser }) => {
    const context = await browser.newContext();
    const service = new EventsAPIService(context);
    
    await service.testConnection();
    await service.close();
  });

  test('05 - Chỉ test API', async ({ browser }) => {
    const context = await browser.newContext();
    const service = new EventsAPIService(context);
    
    const data = await service.getEventsData({
      fDate: '2025-04-01',
      tDate: '2025-06-28',
      page: '1',
      pageSize: '10'
    });

    console.log('=== FULL API RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== CHI TIẾT FORMATTED ===');
    console.log(`Tổng số events: ${data.length}`);
    
    data.slice(0, 3).forEach((event, index) => {
      console.log(`\n--- Event ${index + 1} ---`);
      console.log(`EventID: ${event.EventID}`);
      console.log(`Code: ${event.Code}`);
      console.log(`Company: ${event.CompanyName}`);
      console.log(`Title: ${event.Title}`);
      console.log(`Ex-right Date: ${EventsUtils.formatDate(event.GDKHQDate)}`);
      console.log(`Record Date: ${EventsUtils.formatDate(event.NDKCCDate)}`);
      console.log(`Exercise Date: ${EventsUtils.formatDate(event.Time)}`);
      console.log(`Dividend Rate: ${EventsUtils.extractDividendRate(event.Note)}`);
      console.log(`Note: ${event.Note}`);
      console.log(`Exchange: ${event.Exchange}`);
      console.log(`FileUrl: ${event.FileUrl || 'N/A'}`);
    });

    expect(data).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
    
    await service.close();
  });

  test('06 - Test filter This Week', async ({ browser }) => {
    const context = await browser.newContext();
    const service = new EventsAPIService(context);
    const weekRange = EventsUtils.getThisWeekRange();
    
    console.log(`=== THIS WEEK FILTER: ${weekRange.from} to ${weekRange.to} ===`);
    
    const data = await service.getEventsData({
      fDate: weekRange.from,
      tDate: weekRange.to,
      page: '1',
      pageSize: '50'
    });

    console.log(`Số events tuần này: ${data.length}`);
    
    data.forEach((event, index) => {
      console.log(`${index + 1}. ${event.Code} - ${event.Title}`);
    });

    expect(data).toBeTruthy();
    await service.close();
  });

  test('07 - Test pagination', async ({ browser }) => {
    const context = await browser.newContext();
    const service = new EventsAPIService(context);
    
    console.log('=== TEST PAGINATION ===');
    
    const page1 = await service.getEventsData({
      fDate: '2025-04-01',
      tDate: '2025-06-28',
      page: '1',
      pageSize: '5'
    });
    console.log(`Page 1: ${page1.length} events`);
    console.log(`First event: ${page1[0]?.Code} - ${page1[0]?.Title}`);
    
    const page2 = await service.getEventsData({
      fDate: '2025-04-01',
      tDate: '2025-06-28',
      page: '2',
      pageSize: '5'
    });
    console.log(`Page 2: ${page2.length} events`);
    console.log(`First event: ${page2[0]?.Code} - ${page2[0]?.Title}`);
    
    const isDifferent = page1[0]?.EventID !== page2[0]?.EventID;
    console.log(`Pages have different data: ${isDifferent ? 'YES' : 'NO'}`);
    
    expect(page1.length).toBeGreaterThan(0);
    expect(page2.length).toBeGreaterThan(0);
    
    await service.close();
  });
});