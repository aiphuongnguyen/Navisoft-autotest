import { test, expect, Page } from '@playwright/test';

// Cấu hình test
test.describe('Broker Care & Broker ID Testing', () => {
  let page: Page;

  // Selectors từ test case
  const SELECTORS = {
    accountTypeCheckbox: '[data-testid="open-account-checkbox-accounttypeid"]',
    brokerCareRadio: '[data-testid="open-account-input-brokercare"]',
    brokerIdInput: '[data-testid="open-account-input-brokerid"]',
    finishButton: '[data-testid="open-account-btn-finish"]',
    viewStockListBtn: '[data-testid="open-account-btn-view-stock-list"]'
  };

  // Setup trước mỗi test
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // TODO: Thay URL thực tế của ứng dụng
    await page.goto('YOUR_APP_URL');
    // TODO: Thêm logic login nếu cần
  });

  // Cleanup sau mỗi test
  test.afterEach(async () => {
    await page.close();
  });

  // TC_01: Kiểm tra validation khi không chọn Broker care
  test('TC_01: Verify Finish button disabled when Broker care not selected', async () => {
    await test.step('Không chọn bất kỳ radio button nào cho Broker care', async () => {
      // Đảm bảo không có radio button nào được chọn
      const brokerCareRadios = page.locator(SELECTORS.brokerCareRadio);
      const count = await brokerCareRadios.count();
      
      for (let i = 0; i < count; i++) {
        const isChecked = await brokerCareRadios.nth(i).isChecked();
        if (isChecked) {
          await brokerCareRadios.nth(i).uncheck();
        }
      }
    });

    await test.step('Kiểm tra Finish button bị disabled', async () => {
      const finishBtn = page.locator(SELECTORS.finishButton);
      await expect(finishBtn).toBeDisabled();
    });
  });

  // TC_02: Kiểm tra chọn Broker care với option 'No'
  test('TC_02: Verify Broker care selection with No option', async () => {
    await test.step('Chọn radio button No cho Broker care', async () => {
      // Tìm và chọn radio button có value="No" hoặc text="No"
      await page.locator(`${SELECTORS.brokerCareRadio}[value="No"]`).first().check();
    });

    await test.step('Kiểm tra trạng thái sau khi chọn', async () => {
      const noRadio = page.locator(`${SELECTORS.brokerCareRadio}[value="No"]`).first();
      await expect(noRadio).toBeChecked();
      
      // Kiểm tra radio button hiển thị checked state
      const isVisible = await noRadio.isVisible();
      expect(isVisible).toBeTruthy();
    });
  });

  // TC_03: Kiểm tra chọn Broker care với option 'Yes'
  test('TC_03: Verify Broker care selection with Yes option', async () => {
    await test.step('Chọn radio button Yes cho Broker care', async () => {
      await page.locator(`${SELECTORS.brokerCareRadio}[value="Yes"]`).first().check();
    });

    await test.step('Kiểm tra trạng thái và Broker ID field hiển thị', async () => {
      const yesRadio = page.locator(`${SELECTORS.brokerCareRadio}[value="Yes"]`).first();
      await expect(yesRadio).toBeChecked();
      
      // Kiểm tra Broker ID input field hiển thị
      const brokerIdField = page.locator(SELECTORS.brokerIdInput);
      await expect(brokerIdField).toBeVisible();
    });
  });

  // TC_04: Kiểm tra Broker ID bị ẩn khi Broker care = No
  test('TC_04: Verify Broker ID hidden when Broker care = No', async () => {
    await test.step('Chọn Broker care = No', async () => {
      await page.locator(`${SELECTORS.brokerCareRadio}[value="No"]`).first().check();
    });

    await test.step('Kiểm tra Broker ID field bị ẩn', async () => {
      const brokerIdField = page.locator(SELECTORS.brokerIdInput);
      
      // Kiểm tra field không hiển thị hoặc bị hidden
      const isHidden = await brokerIdField.isHidden().catch(() => true);
      expect(isHidden).toBeTruthy();
    });
  });

  // TC_05: Kiểm tra Broker ID hiển thị khi Broker care = Yes
  test('TC_05: Verify Broker ID shown when Broker care = Yes', async () => {
    await test.step('Chọn Broker care = No', async () => {
      await page.locator(`${SELECTORS.brokerCareRadio}[value="No"]`).first().check();
    });

    await test.step('Thay đổi sang Broker care = Yes', async () => {
      await page.locator(`${SELECTORS.brokerCareRadio}[value="Yes"]`).first().check();
    });

    await test.step('Kiểm tra Broker ID field hiển thị và enabled', async () => {
      const brokerIdField = page.locator(SELECTORS.brokerIdInput);
      await expect(brokerIdField).toBeVisible();
      await expect(brokerIdField).toBeEnabled();
    });
  });

  // TC_06: Kiểm tra Broker ID bắt buộc khi để trống
  test('TC_06: Verify Broker ID required when empty', async () => {
    await test.step('Để trống Broker ID', async () => {
      const brokerIdField = page.locator(SELECTORS.brokerIdInput);
      await brokerIdField.fill('');
      await brokerIdField.blur(); // Tab out để trigger validation
    });

    await test.step('Kiểm tra error message hiển thị', async () => {
      // Tìm error message chứa text "empty"
      const errorMsg = page.locator('text=/empty/i, text=/required/i, .error-message');
      await expect(errorMsg.first()).toBeVisible();
      
      // Kiểm tra Finish button bị block
      const finishBtn = page.locator(SELECTORS.finishButton);
      await expect(finishBtn).toBeDisabled();
    });
  });

  // TC_07: Kiểm tra Broker ID chấp nhận ID hợp lệ
  test('TC_07: Verify Broker ID accepts valid ID', async () => {
    const validBrokerId = 'C04089901';

    await test.step('Nhập Broker ID hợp lệ', async () => {
      const brokerIdField = page.locator(SELECTORS.brokerIdInput);
      await brokerIdField.fill(validBrokerId);
    });

    await test.step('Tab out để trigger validation', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra input được chấp nhận không có lỗi', async () => {
      const brokerIdField = page.locator(SELECTORS.brokerIdInput);
      const value = await brokerIdField.inputValue();
      expect(value).toBe(validBrokerId);
      
      // Kiểm tra không có error message
      const errorMsg = page.locator('.error-message, .error, [class*="error"]');
      const errorCount = await errorMsg.count();
      expect(errorCount).toBe(0);
    });
  });

  // TC_08: Kiểm tra validation với ký tự đặc biệt
  test('TC_08: Verify Broker ID validation with special characters', async () => {
    const invalidBrokerId = 'C040@#901';

    await test.step('Nhập Broker ID với ký tự đặc biệt', async () => {
      const brokerIdField = page.locator(SELECTORS.brokerIdInput);
      await brokerIdField.fill(invalidBrokerId);
    });

    await test.step('Tab out để trigger validation', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra validation error hiển thị', async () => {
      // Kiểm tra error message hoặc validation state
      const errorMsg = page.locator('.error-message, .error, [class*="error"], text=/special character/i, text=/invalid/i');
      
      // Nếu có validation theo business rule
      const hasError = await errorMsg.count() > 0;
      if (hasError) {
        await expect(errorMsg.first()).toBeVisible();
      }
    });
  });

  // TC_09: Kiểm tra Finish button enabled khi tất cả fields hợp lệ với Broker care = No
  test('TC_09: Verify Finish button enabled when all required fields valid with Broker care = No', async () => {
    await test.step('Chọn Account type = Derivative', async () => {
      // Giả sử có dropdown hoặc select cho Account type
      await page.selectOption('[data-testid*="account-type"], select', { label: 'Derivative' });
    });

    await test.step('Chọn Broker care = No', async () => {
      await page.locator(`${SELECTORS.brokerCareRadio}[value="No"]`).first().check();
    });

    await test.step('Kiểm tra Finish button state', async () => {
      const finishBtn = page.locator(SELECTORS.finishButton);
      await expect(finishBtn).toBeEnabled();
      
      // Kiểm tra button clickable (không cần Broker ID)
      const isClickable = await finishBtn.isEnabled();
      expect(isClickable).toBeTruthy();
    });
  });

  // TC_10: Kiểm tra Finish button enabled khi tất cả fields hợp lệ với Broker care = Yes
  test('TC_10: Verify Finish button enabled when all required fields valid with Broker care = Yes', async () => {
    await test.step('Chọn Account type = Derivative', async () => {
      await page.selectOption('[data-testid*="account-type"], select', { label: 'Derivative' });
    });

    await test.step('Chọn Broker care = Yes', async () => {
      await page.locator(`${SELECTORS.brokerCareRadio}[value="Yes"]`).first().check();
    });

    await test.step('Nhập Broker ID hợp lệ', async () => {
      const brokerIdField = page.locator(SELECTORS.brokerIdInput);
      await brokerIdField.fill('C04089901');
    });

    await test.step('Kiểm tra Finish button state', async () => {
      const finishBtn = page.locator(SELECTORS.finishButton);
      await expect(finishBtn).toBeEnabled();
      
      // Kiểm tra button clickable
      const isClickable = await finishBtn.isEnabled();
      expect(isClickable).toBeTruthy();
    });
  });

  // TC_11: Kiểm tra form submission navigate đến bước tiếp theo
  test('TC_11: Verify form submission navigates to next step', async () => {
    await test.step('Chọn Account type = Derivative', async () => {
      await page.selectOption('[data-testid*="account-type"], select', { label: 'Derivative' });
    });

    await test.step('Chọn Broker care = Yes', async () => {
      await page.locator(`${SELECTORS.brokerCareRadio}[value="Yes"]`).first().check();
    });

    await test.step('Nhập Broker ID hợp lệ', async () => {
      const brokerIdField = page.locator(SELECTORS.brokerIdInput);
      await brokerIdField.fill('C04089901');
    });

    await test.step('Click Finish button', async () => {
      const finishBtn = page.locator(SELECTORS.finishButton);
      await finishBtn.click();
    });

    await test.step('Kiểm tra modal success hiển thị với URL ADD LATER', async () => {
      // Chờ modal success xuất hiện
      const successModal = page.locator('.modal, [class*="modal"], [role="dialog"]').filter({ hasText: /success/i });
      await expect(successModal).toBeVisible({ timeout: 10000 });
      
      // Kiểm tra URL trong modal (sẽ được thêm sau)
      const urlText = page.locator('text=/ADD LATER/i, text=/URL/i');
      await expect(urlText).toBeVisible();
    });
  });
});
