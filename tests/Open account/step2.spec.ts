import { test, expect, Page } from '@playwright/test';

// ===================== PAGE OBJECT MODEL =====================
class OpenAccountStep2Page {
  constructor(private page: Page) {}

  // Selectors - Personal Section
  readonly fullNameInput = '[data-testid="open-account-inputfullname"]';
  readonly nationalityDropdown = '[data-testid="open-account-dropdownnationality"]';
  readonly genderFemale = '[data-testid="open-account-selectgender"][value="F"]';
  readonly genderMale = '[data-testid="open-account-selectgender"][value="M"]';
  readonly dateOfBirthPicker = '[data-testid="open-accountdatepicker-birthday"]';
  
  // Selectors - Identity Section
  readonly citizenIdInput = '[data-testid="open-account-inputidnumber"]';
  readonly placeOfIssueInput = '[data-testid="open-account-inputissueplace"]';
  readonly dateOfIssuePicker = '[data-testid="open-accountdatepicker-issuedate"]';
  readonly expiryDatePicker = '[data-testid="open-accountdatepicker-expirydate"]';
  
  // Selectors - Address Section
  readonly permanentAddressInput = '[data-testid="open-account-inputpermanentaddress"]';
  readonly contactAddressInput = '[data-testid="open-account-inputcontactaddress"]';
  
  // Selectors - FATCA Section
  readonly fatcaYes = '[data-testid="open-account-selectfatca"][value="Y"]';
  readonly fatcaNo = '[data-testid="open-account-selectfatca"][value="N"]';
  
  // Action buttons
  readonly continueButton = '[data-testid="open-account-btncontinue-step2"]';

  // Điền Full name
  async fillFullName(name: string) {
    await this.page.fill(this.fullNameInput, name);
  }

  // Chọn giới tính
  async selectGender(gender: 'M' | 'F') {
    const selector = gender === 'F' ? this.genderFemale : this.genderMale;
    await this.page.check(selector);
  }

  // Điền ngày sinh (format: DD/MM/YYYY)
  async fillDateOfBirth(date: string) {
    await this.page.fill(this.dateOfBirthPicker, date);
  }

  // Điền CMND/CCCD
  async fillCitizenId(id: string) {
    await this.page.fill(this.citizenIdInput, id);
  }

  // Điền nơi cấp
  async fillPlaceOfIssue(place: string) {
    await this.page.fill(this.placeOfIssueInput, place);
  }

  // Điền ngày cấp
  async fillDateOfIssue(date: string) {
    await this.page.fill(this.dateOfIssuePicker, date);
  }

  // Điền ngày hết hạn
  async fillExpiryDate(date: string) {
    await this.page.fill(this.expiryDatePicker, date);
  }

  // Điền địa chỉ thường trú
  async fillPermanentAddress(address: string) {
    await this.page.fill(this.permanentAddressInput, address);
  }

  // Điền địa chỉ liên hệ
  async fillContactAddress(address: string) {
    await this.page.fill(this.contactAddressInput, address);
  }

  // Chọn FATCA
  async selectFatca(value: 'Y' | 'N') {
    const selector = value === 'Y' ? this.fatcaYes : this.fatcaNo;
    await this.page.check(selector);
  }

  // Click nút Continue
  async clickContinue() {
    await this.page.click(this.continueButton);
  }

  // Kiểm tra nút Continue bị disable
  async isContinueButtonDisabled(): Promise<boolean> {
    return await this.page.isDisabled(this.continueButton);
  }

  // Click ra ngoài để trigger validation
  async clickOutside() {
    await this.page.click('body');
  }

  // Kiểm tra error message inline
  async getErrorMessage(fieldSelector: string): Promise<string | null> {
    const errorSelector = `${fieldSelector} ~ .error-message, ${fieldSelector} + .error-message`;
    const isVisible = await this.page.isVisible(errorSelector);
    return isVisible ? await this.page.textContent(errorSelector) : null;
  }

  // Điền form đầy đủ với data hợp lệ
  async fillCompleteValidForm() {
    await this.fillFullName('Linh Ha Mai Huong');
    await this.selectGender('F');
    await this.fillDateOfBirth('10/01/1996');
    await this.fillCitizenId('12345678901');
    await this.fillPlaceOfIssue('Ha Noi');
    await this.fillDateOfIssue('10/01/1996');
    await this.fillExpiryDate('10/01/2025');
    await this.fillPermanentAddress('12 Truong Dinh, HN');
    await this.fillContactAddress('99 Nguyen Trai, HN');
    await this.selectFatca('Y');
  }
}

// ===================== TEST SUITE =====================
test.describe('Open Account - Step 2: Personal Information', () => {
  let page: Page;
  let openAccountPage: OpenAccountStep2Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    openAccountPage = new OpenAccountStep2Page(page);
    
    // TODO: Thay URL thực tế của Step 2
    await page.goto('ADD_YOUR_URL_HERE');
  });

  test.afterEach(async () => {
    await page.close();
  });

  // ========== PERSONAL SECTION - FULL NAME ==========
  test('TC_01: Verify Full name accepts valid input', async () => {
    await test.step('Nhập họ tên hợp lệ', async () => {
      await openAccountPage.fillFullName('Linh Ha Mai Huong');
    });

    await test.step('Click ra ngoài', async () => {
      await openAccountPage.clickOutside();
    });

    await test.step('Kiểm tra không có lỗi', async () => {
      const value = await page.inputValue(openAccountPage.fullNameInput);
      expect(value).toBe('Linh Ha Mai Huong');
    });
  });

  test('TC_02: Verify validation when Full name field is left empty', async () => {
    await test.step('Để trống Full name', async () => {
      await openAccountPage.fillFullName('');
    });

    await test.step('Click ra ngoài', async () => {
      await openAccountPage.clickOutside();
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  // ========== PERSONAL SECTION - NATIONALITY ==========
  test('TC_03: Verify default Nationality value when Registration type is Local retail', async () => {
    await test.step('Kiểm tra giá trị mặc định Nationality', async () => {
      const nationality = await page.inputValue(openAccountPage.nationalityDropdown);
      expect(nationality).toBe('Vietnam');
    });

    await test.step('Kiểm tra Nationality bị disable', async () => {
      const isDisabled = await page.isDisabled(openAccountPage.nationalityDropdown);
      expect(isDisabled).toBeTruthy();
    });
  });

  // ========== PERSONAL SECTION - GENDER ==========
  test('TC_04: Verify Gender selection is required', async () => {
    await test.step('Không chọn Gender', async () => {
      // Giữ nguyên không chọn gì
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_05: Verify Gender selection with valid option', async () => {
    await test.step('Chọn giới tính Female', async () => {
      await openAccountPage.selectGender('F');
    });

    await test.step('Kiểm tra giới tính đã được chọn', async () => {
      const isChecked = await page.isChecked(openAccountPage.genderFemale);
      expect(isChecked).toBeTruthy();
    });
  });

  // ========== PERSONAL SECTION - DATE OF BIRTH ==========
  test('TC_06: Verify validation when Date of birth is left empty', async () => {
    await test.step('Để trống Date of birth', async () => {
      await openAccountPage.fillDateOfBirth('');
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_07: Verify validation when Date of birth is future date', async () => {
    const futureDate = '10/01/2030';

    await test.step('Chọn ngày tương lai', async () => {
      await openAccountPage.fillDateOfBirth(futureDate);
    });

    await test.step('Tab ra ngoài', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra hiển thị lỗi', async () => {
      const errorMessage = await openAccountPage.getErrorMessage(openAccountPage.dateOfBirthPicker);
      expect(errorMessage).toContain('Invalid date of birth');
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_08: Verify validation when Date of birth is today', async () => {
    const today = new Date().toLocaleDateString('en-GB');

    await test.step('Chọn ngày hôm nay', async () => {
      await openAccountPage.fillDateOfBirth(today);
    });

    await test.step('Tab ra ngoài', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_09: Verify Date of birth accepts valid past date', async () => {
    await test.step('Nhập ngày sinh hợp lệ', async () => {
      await openAccountPage.fillDateOfBirth('10/01/1996');
    });

    await test.step('Tab ra ngoài', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra không có lỗi', async () => {
      const value = await page.inputValue(openAccountPage.dateOfBirthPicker);
      expect(value).toBe('10/01/1996');
    });
  });

  // ========== IDENTITY SECTION - CITIZEN ID ==========
  test('TC_10: Verify validation when Citizen ID is left empty', async () => {
    await test.step('Để trống Citizen ID', async () => {
      await openAccountPage.fillCitizenId('');
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_11: Verify Citizen ID accepts valid national ID number', async () => {
    await test.step('Nhập CMND hợp lệ', async () => {
      await openAccountPage.fillCitizenId('12345678901');
    });

    await test.step('Tab ra ngoài', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra không có lỗi', async () => {
      const value = await page.inputValue(openAccountPage.citizenIdInput);
      expect(value).toBe('12345678901');
    });
  });

  // ========== IDENTITY SECTION - PLACE OF ISSUE ==========
  test('TC_12: Verify validation when Place of issue is left empty', async () => {
    await test.step('Để trống Place of issue', async () => {
      await openAccountPage.fillPlaceOfIssue('');
    });

    await test.step('Tab ra ngoài', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_13: Verify Place of issue accepts valid location', async () => {
    await test.step('Nhập nơi cấp hợp lệ', async () => {
      await openAccountPage.fillPlaceOfIssue('Ha Noi');
    });

    await test.step('Tab ra ngoài', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra không có lỗi', async () => {
      const value = await page.inputValue(openAccountPage.placeOfIssueInput);
      expect(value).toBe('Ha Noi');
    });
  });

  // ========== IDENTITY SECTION - DATE OF ISSUE ==========
  test('TC_14: Verify validation when Date of issue is left empty', async () => {
    await test.step('Để trống Date of issue', async () => {
      await openAccountPage.fillDateOfIssue('');
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_15: Verify validation when Date of issue is future date', async () => {
    const futureDate = '10/01/2030';

    await test.step('Chọn ngày tương lai', async () => {
      await openAccountPage.fillDateOfIssue(futureDate);
    });

    await test.step('Tab ra ngoài', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra hiển thị lỗi', async () => {
      const errorMessage = await openAccountPage.getErrorMessage(openAccountPage.dateOfIssuePicker);
      expect(errorMessage).toContain('Invalid issue date');
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_16: Verify Date of issue accepts valid past date', async () => {
    await test.step('Nhập ngày cấp hợp lệ', async () => {
      await openAccountPage.fillDateOfIssue('10/01/1996');
    });

    await test.step('Tab ra ngoài', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra không có lỗi', async () => {
      const value = await page.inputValue(openAccountPage.dateOfIssuePicker);
      expect(value).toBe('10/01/1996');
    });
  });

  // ========== IDENTITY SECTION - EXPIRY DATE ==========
  test('TC_17: Verify Expiry date is optional when not provided', async () => {
    await test.step('Để trống Expiry date', async () => {
      await openAccountPage.fillExpiryDate('');
    });

    await test.step('Kiểm tra không có lỗi', async () => {
      const errorMessage = await openAccountPage.getErrorMessage(openAccountPage.expiryDatePicker);
      expect(errorMessage).toBeNull();
    });
  });

  test('TC_18: Verify validation when Expiry date is before Date of issue', async () => {
    await test.step('Nhập Date of issue', async () => {
      await openAccountPage.fillDateOfIssue('10/01/1996');
    });

    await test.step('Nhập Expiry date trước Date of issue', async () => {
      await openAccountPage.fillExpiryDate('10/01/1990');
    });

    await test.step('Tab ra ngoài', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra hiển thị lỗi', async () => {
      const errorMessage = await openAccountPage.getErrorMessage(openAccountPage.expiryDatePicker);
      expect(errorMessage).toContain('Expiry must be after issue date');
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_19: Verify Expiry date accepts valid future date after issue date', async () => {
    await test.step('Nhập Date of issue', async () => {
      await openAccountPage.fillDateOfIssue('10/01/1996');
    });

    await test.step('Nhập Expiry date sau Date of issue', async () => {
      await openAccountPage.fillExpiryDate('10/01/2025');
    });

    await test.step('Tab ra ngoài', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra không có lỗi', async () => {
      const value = await page.inputValue(openAccountPage.expiryDatePicker);
      expect(value).toBe('10/01/2025');
    });
  });

  // ========== ADDRESS SECTION - PERMANENT ADDRESS ==========
  test('TC_20: Verify validation when Permanent address is left empty', async () => {
    await test.step('Để trống Permanent address', async () => {
      await openAccountPage.fillPermanentAddress('');
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_21: Verify Permanent address accepts valid home address', async () => {
    await test.step('Nhập địa chỉ hợp lệ', async () => {
      await openAccountPage.fillPermanentAddress('12 Truong Dinh, HN');
    });

    await test.step('Di chuyển đến field tiếp theo', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra không có lỗi', async () => {
      const value = await page.inputValue(openAccountPage.permanentAddressInput);
      expect(value).toBe('12 Truong Dinh, HN');
    });
  });

  // ========== ADDRESS SECTION - CONTACT ADDRESS ==========
  test('TC_22: Verify Contact address is optional', async () => {
    await test.step('Để trống Contact address', async () => {
      await openAccountPage.fillContactAddress('');
    });

    await test.step('Kiểm tra không có lỗi', async () => {
      const errorMessage = await openAccountPage.getErrorMessage(openAccountPage.contactAddressInput);
      expect(errorMessage).toBeNull();
    });
  });

  test('TC_23: Verify Contact address accepts valid mailing address', async () => {
    await test.step('Nhập địa chỉ hợp lệ', async () => {
      await openAccountPage.fillContactAddress('99 Nguyen Trai, HN');
    });

    await test.step('Di chuyển đến field tiếp theo', async () => {
      await page.keyboard.press('Tab');
    });

    await test.step('Kiểm tra không có lỗi', async () => {
      const value = await page.inputValue(openAccountPage.contactAddressInput);
      expect(value).toBe('99 Nguyen Trai, HN');
    });
  });

  // ========== FATCA SECTION ==========
  test('TC_24: Verify validation when FATCA selection is not made', async () => {
    await test.step('Không chọn FATCA', async () => {
      // Giữ nguyên không chọn gì
    });

    await test.step('Kiểm tra nút Continue bị disable', async () => {
      const isDisabled = await openAccountPage.isContinueButtonDisabled();
      expect(isDisabled).toBeTruthy();
    });
  });

  test('TC_25: Verify FATCA selection with valid option', async () => {
    await test.step('Chọn FATCA Yes', async () => {
      await openAccountPage.selectFatca('Y');
    });

    await test.step('Kiểm tra FATCA đã được chọn', async () => {
      const isChecked = await page.isChecked(openAccountPage.fatcaYes);
      expect(isChecked).toBeTruthy();
    });
  });

  // ========== CONTINUE ACTION ==========
  test('TC_26: Verify form submission when Continue is clicked with valid data', async () => {
    await test.step('Điền toàn bộ form với dữ liệu hợp lệ', async () => {
      await openAccountPage.fillCompleteValidForm();
    });

    await test.step('Click nút Continue', async () => {
      await openAccountPage.clickContinue();
    });

    await test.step('Kiểm tra chuyển sang Step 3', async () => {
      // TODO: Thay URL thực tế của Step 3
      await page.waitForURL('**/step3**');
      expect(page.url()).toContain('step3');
    });
  });
});