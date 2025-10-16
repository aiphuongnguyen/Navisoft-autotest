
import { test, expect, Page } from '@playwright/test';

/**
 * OPEN ACCOUNT REGISTRATION - AUTOMATED TEST SUITE
 * Mô tả: Tự động hóa kiểm thử chức năng đăng ký mở tài khoản
 * Bao gồm: Email validation, Phone validation, Registration type selection
 */

// ==================== CONSTANTS - HẰNG SỐ ====================
const TEST_DATA = {
  validEmail: 'phuongta.it1@gmail.com',
  invalidEmailNoDomain: 'userdomain.com',
  validPhone: '0333129782',
  invalidPhoneWithLetters: '91234abcd',
  phoneWith8Digits: '12345678',
  registrationTypeLocal: 'Local retail'
};

const SELECTORS = {
  emailInput: '[data-testid="open-account-input-email"]',
  phoneInput: '[data-testid="open-account-input-phone"]',
  registrationTypeSelect: '[data-testid="open-account-select-registrationtype"]',
  continueButton: '[data-testid="open-account-btn-continue-step1"]'
};

const ERROR_MESSAGES = {
  invalidEmail: 'Please enter a valid email',
  invalidPhone: 'Please enter a valid phone number',
  phoneLength: 'only 9-12 digits accepted'
};

// ==================== HELPER FUNCTIONS - HÀM HỖ TRỢ ====================

/**
 * Điều hướng đến trang mở tài khoản
 */
async function navigateToOpenAccountPage(page: Page, baseURL: string) {
  await page.goto(`${baseURL}/open-account`); // Thay URL thực tế sau
  await page.waitForLoadState('networkidle');
}

/**
 * Nhập giá trị vào trường Email
 */
async function enterEmail(page: Page, email: string) {
  await page.fill(SELECTORS.emailInput, email);
}

/**
 * Nhập giá trị vào trường Phone
 */
async function enterPhone(page: Page, phone: string) {
  await page.fill(SELECTORS.phoneInput, phone);
}

/**
 * Chọn loại đăng ký (Registration Type)
 */
async function selectRegistrationType(page: Page, registrationType: string) {
  await page.selectOption(SELECTORS.registrationTypeSelect, { label: registrationType });
}

/**
 * Click nút Continue
 */
async function clickContinueButton(page: Page) {
  await page.click(SELECTORS.continueButton);
}

/**
 * Nhấn Tab để trigger validation
 */
async function pressTab(page: Page) {
  await page.keyboard.press('Tab');
}

/**
 * Kiểm tra trường input có hiển thị trạng thái valid không
 */
async function verifyFieldValidState(page: Page, selector: string) {
  const inputElement = page.locator(selector);
  await expect(inputElement).not.toHaveClass(/error|invalid/); // Kiểm tra không có class error
  await expect(inputElement).toBeVisible();
}

/**
 * Kiểm tra hiển thị inline error message
 */
async function verifyInlineErrorDisplayed(page: Page, errorMessage: string) {
  const errorElement = page.locator(`text=${errorMessage}`);
  await expect(errorElement).toBeVisible();
}

/**
 * Kiểm tra nút Continue bị disable
 */
async function verifyContinueButtonDisabled(page: Page) {
  const continueBtn = page.locator(SELECTORS.continueButton);
  await expect(continueBtn).toBeDisabled();
}

/**
 * Kiểm tra nút Continue được enable
 */
async function verifyContinueButtonEnabled(page: Page) {
  const continueBtn = page.locator(SELECTORS.continueButton);
  await expect(continueBtn).toBeEnabled();
}

/**
 * Kiểm tra điều hướng đến Step 2 (URL chứa "ADD LATER")
 */
async function verifyNavigationToStep2(page: Page) {
  await expect(page).toHaveURL(/add-later/i);
  // Hoặc kiểm tra URL cụ thể: await expect(page.url()).toContain('step2');
}

// ==================== TEST SUITE ====================

test.describe('Open Account Registration - Function Testing', () => {
  
  // Base URL - Cấu hình URL gốc của ứng dụng
  const BASE_URL = 'https://your-app-url.com'; // TODO: Thay thế URL thực tế
  
  test.beforeEach(async ({ page }) => {
    // Điều hướng đến trang mở tài khoản trước mỗi test
    await navigateToOpenAccountPage(page, BASE_URL);
  });

  // ==================== EMAIL VALIDATION ====================
  
  /**
   * TC_01: Kiểm tra chấp nhận email hợp lệ
   * Expected: Email được chấp nhận, không có lỗi, trường hiển thị trạng thái valid
   */
  test('TC_01 - Verify valid email format acceptance', async ({ page }) => {
    await test.step('1. Nhập email hợp lệ "phuongta.it1@gmail.com"', async () => {
      await enterEmail(page, TEST_DATA.validEmail);
    });

    await test.step('2. Tab out (nhấn Tab)', async () => {
      await pressTab(page);
    });

    await test.step('Kiểm tra kết quả: Email được chấp nhận, trường valid', async () => {
      // Kiểm tra trường email không có lỗi
      await verifyFieldValidState(page, SELECTORS.emailInput);
      
      // Kiểm tra không có error message hiển thị
      const errorMessage = page.locator(`text=${ERROR_MESSAGES.invalidEmail}`);
      await expect(errorMessage).not.toBeVisible();
    });
  });

  /**
   * TC_02: Kiểm tra từ chối email không hợp lệ (thiếu @ domain)
   * Expected: Hiển thị inline error "Please enter a valid email", nút Continue bị disable
   */
  test('TC_02 - Verify invalid email format rejection', async ({ page }) => {
    await test.step('1. Nhập email không hợp lệ "userdomain.com"', async () => {
      await enterEmail(page, TEST_DATA.invalidEmailNoDomain);
    });

    await test.step('2. Tab out (nhấn Tab)', async () => {
      await pressTab(page);
    });

    await test.step('Kiểm tra kết quả: Hiển thị lỗi và disable nút Continue', async () => {
      // Kiểm tra hiển thị inline error message
      await verifyInlineErrorDisplayed(page, ERROR_MESSAGES.invalidEmail);
      
      // Kiểm tra nút Continue bị disable
      await verifyContinueButtonDisabled(page);
    });
  });

  /**
   * TC_03: Kiểm tra validation khi trường email bỏ trống
   * Expected: Nút Continue bị disable
   */
  test('TC_03 - Verify empty email field validation', async ({ page }) => {
    await test.step('1. Để trống trường Email', async () => {
      // Không nhập gì vào email (trường mặc định trống)
      await enterEmail(page, '');
    });

    await test.step('2. Tab out (nhấn Tab)', async () => {
      await pressTab(page);
    });

    await test.step('Kiểm tra kết quả: Nút Continue bị disable', async () => {
      await verifyContinueButtonDisabled(page);
    });
  });

  // ==================== PHONE VALIDATION ====================

  /**
   * TC_04: Kiểm tra chấp nhận số điện thoại hợp lệ (9-12 chữ số)
   * Expected: Số điện thoại được chấp nhận, trường hiển thị trạng thái valid
   */
  test('TC_04 - Verify valid phone acceptance within 9-12 digits', async ({ page }) => {
    await test.step('1. Nhập số điện thoại hợp lệ "0333129782"', async () => {
      await enterPhone(page, TEST_DATA.validPhone);
    });

    await test.step('2. Tab out (nhấn Tab)', async () => {
      await pressTab(page);
    });

    await test.step('Kiểm tra kết quả: Số điện thoại được chấp nhận', async () => {
      // Kiểm tra trường phone không có lỗi
      await verifyFieldValidState(page, SELECTORS.phoneInput);
      
      // Kiểm tra không có error message hiển thị
      const errorMessage = page.locator(`text=${ERROR_MESSAGES.invalidPhone}`);
      await expect(errorMessage).not.toBeVisible();
    });
  });

  /**
   * TC_05: Kiểm tra từ chối số điện thoại chứa chữ cái
   * Expected: Hiển thị inline error "Please enter a valid phone number", nút Continue bị disable
   */
  test('TC_05 - Verify invalid phone with letters rejection', async ({ page }) => {
    await test.step('1. Nhập số điện thoại không hợp lệ "91234abcd"', async () => {
      await enterPhone(page, TEST_DATA.invalidPhoneWithLetters);
    });

    await test.step('2. Tab out (nhấn Tab)', async () => {
      await pressTab(page);
    });

    await test.step('Kiểm tra kết quả: Hiển thị lỗi và disable nút Continue', async () => {
      // Kiểm tra hiển thị inline error message
      await verifyInlineErrorDisplayed(page, ERROR_MESSAGES.invalidPhone);
      
      // Kiểm tra nút Continue bị disable
      await verifyContinueButtonDisabled(page);
    });
  });

  /**
   * TC_06: Kiểm tra boundary validation cho độ dài số điện thoại (8 chữ số - không hợp lệ)
   * Expected: Hiển thị error "only 9-12 digits accepted", nút Continue bị disable
   */
  test('TC_06 - Verify phone length boundary validation', async ({ page }) => {
    await test.step('1. Nhập số điện thoại 8 chữ số "12345678"', async () => {
      await enterPhone(page, TEST_DATA.phoneWith8Digits);
    });

    await test.step('2. Tab out (nhấn Tab)', async () => {
      await pressTab(page);
    });

    await test.step('Kiểm tra kết quả: Hiển thị lỗi độ dài và disable nút Continue', async () => {
      // Kiểm tra hiển thị error message về độ dài
      await verifyInlineErrorDisplayed(page, ERROR_MESSAGES.phoneLength);
      
      // Kiểm tra nút Continue bị disable
      await verifyContinueButtonDisabled(page);
    });
  });

  // ==================== REGISTRATION TYPE ====================

  /**
   * TC_07: Kiểm tra chọn loại đăng ký Local retail và điều hướng đến Step 2
   * Expected: Điều hướng thành công đến màn hình Step 2 với URL chứa "ADD LATER"
   */
  test('TC_07 - Verify registration type selection for Local retail', async ({ page }) => {
    await test.step('1. Chọn Local retail type (registrationType >C)', async () => {
      await selectRegistrationType(page, TEST_DATA.registrationTypeLocal);
    });

    await test.step('2. Nhập email hợp lệ "phuongta.it1@gmail.com"', async () => {
      await enterEmail(page, TEST_DATA.validEmail);
    });

    await test.step('3. Nhập số điện thoại hợp lệ "0333129782"', async () => {
      await enterPhone(page, TEST_DATA.validPhone);
    });

    await test.step('3. Click nút Continue button (Step1)', async () => {
      await clickContinueButton(page);
    });

    await test.step('Kiểm tra kết quả: Điều hướng đến Step 2 (URL: ADD LATER)', async () => {
      // Đợi navigation hoàn tất
      await page.waitForLoadState('networkidle');
      
      // Kiểm tra URL có chứa "add-later" hoặc step 2
      await verifyNavigationToStep2(page);
    });
  });

});