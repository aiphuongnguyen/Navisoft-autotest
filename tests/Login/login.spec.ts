import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test data constants
const VALID_CREDENTIALS = {
  username: 'linhdtt01',
  password: 'Y)7m0Fy!'
};

const INVALID_CREDENTIALS = {
  wrongUser: 'WrongUser',
  wrongPassword: 'wrongpass'
};

// Page Object Model for Login Page
class LoginPage {
  constructor(private page: Page) {}

  // Selectors
  get usernameInput() { return this.page.locator('[data-testid="login-input-username"]'); }
  get passwordInput() { return this.page.locator('[data-testid="login-input-password"]'); }
  get loginButton() { return this.page.locator('[data-testid="login-btn-submit"]'); }
  get passwordToggle() { return this.page.locator('[data-testid="login-action-password-togglevisibility"]'); }
  get forgotPasswordLink() { return this.page.locator('[data-testid="login-link-forgotpassword"]'); }
  get openAccountLink() { return this.page.locator('[data-testid="login-link-open-account"]'); }
  get userGuideLink() { return this.page.locator('[data-testid="login-link-users-guide"]'); }
  get supportLink() { return this.page.locator('[data-testid="login-link-support"]'); }
  get policyLink() { return this.page.locator('[data-testid="login-link-policy"]'); }
  get termsLink() { return this.page.locator('[data-testid="login-link-terms"]'); }
  
  // Helper methods
  async fillCredentials(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  async login(username: string, password: string) {
    await this.fillCredentials(username, password);
    await this.loginButton.click();
  }

  async getErrorMessage() {
    return this.page.locator('.error-message, [class*="error"]').first();
  }
}

test.describe('Login Page Tests', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('http://localhost:3000/'); // Adjust URL as needed
  });

  test.describe('Username Field Tests', () => {
    test('TC_15: Validate username with valid information', async ({ page }) => {
      await loginPage.usernameInput.click();
      await loginPage.usernameInput.fill(VALID_CREDENTIALS.username);
      
      // Verify no validation errors
      await expect(loginPage.usernameInput).toHaveValue(VALID_CREDENTIALS.username);
      const errorMessage = await loginPage.getErrorMessage();
      await expect(errorMessage).not.toBeVisible();
    });

    test('TC_16: Allow Copy & paste into username field', async ({ page }) => {
      // Copy text to clipboard
      await page.evaluate(() => navigator.clipboard.writeText('DifiSoft01'));
      
      // Paste into username field
      await loginPage.usernameInput.click();
      await page.keyboard.press('Meta+V');
      
      // Check username field
      await expect(loginPage.usernameInput).toHaveValue('DifiSoft01');
    });

    test('TC_17: Verify disable Login button when leaving username blank', async ({ page }) => {
      // Leave username field empty and enter valid password
      await loginPage.passwordInput.fill(VALID_CREDENTIALS.password);
      
      // Check Login button is disabled
      await expect(loginPage.loginButton).toBeDisabled();
    });
  });

  test.describe('Password Field Tests', () => {
    test('TC_18: Verify no error displayed when entering valid Password', async ({ page }) => {
      await loginPage.passwordInput.click();
      await loginPage.passwordInput.fill(VALID_CREDENTIALS.password);
      
      // Password is accepted without validation errors
      await expect(loginPage.passwordInput).toHaveValue(VALID_CREDENTIALS.password);
      const errorMessage = await loginPage.getErrorMessage();
      await expect(errorMessage).not.toBeVisible();
    });

    test('TC_19: Allow Copy & paste into password field', async ({ page }) => {
      // Copy password to clipboard
      await page.evaluate(() => navigator.clipboard.writeText('123456'));
      
      // Paste into password field
      await loginPage.passwordInput.click();
      await page.keyboard.press('Meta+V');
      
      // Check text was pasted and is masked
      await expect(loginPage.passwordInput).toHaveValue('123456');
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });

    test('TC_20: Verify disable Login button when leaving Password blank', async ({ page }) => {
      // Enter username but leave password blank
      await loginPage.usernameInput.fill(VALID_CREDENTIALS.username);
      
      // Check Login button is disabled
      await expect(loginPage.loginButton).toBeDisabled();
    });

    test('TC_21: Show password when click open eye', async ({ page }) => {
      await loginPage.passwordInput.fill('123456');
      await loginPage.passwordToggle.click();
      
      // Verify password is visible
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
      await expect(loginPage.passwordInput).toHaveValue('123456');
    });

    test('TC_22: Hide password when clicking close eye', async ({ page }) => {
      await loginPage.passwordInput.fill('123456');
      
      // Show password first
      await loginPage.passwordToggle.click();
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
      
      // Hide password
      await loginPage.passwordToggle.click();
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });

    test('TC_23: Password Toggle works stable when Toggled multiple times', async ({ page }) => {
      await loginPage.passwordInput.fill('123456');
      
      // Click toggle 3 times
      for (let i = 0; i < 3; i++) {
        await loginPage.passwordToggle.click();
      }
      
      // Final state should be visible (odd number of clicks)
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
      await expect(loginPage.passwordInput).toHaveValue('123456');
    });
  });

  test.describe('Login Button Tests', () => {
    test('TC_24: Login successful with valid information', async ({ page }) => {
        const responsePromise = page.waitForResponse(response => 
          response.url().includes('/login') && response.status() === 200
        );
        
        await loginPage.login(VALID_CREDENTIALS.username, VALID_CREDENTIALS.password);
        await responsePromise;
        
        // Verify redirect to home page
        await expect(page).toHaveURL(/.*home.*/);
      });

    test('TC_25: Login successfully with valid information when pressing enter', async ({ page }) => {
      const responsePromise = page.waitForResponse(response => 
        response.url().includes('/login') && response.status() === 200
      );
      
      await loginPage.fillCredentials(VALID_CREDENTIALS.username, VALID_CREDENTIALS.password);
      await page.keyboard.press('Enter');
      await responsePromise;
      
      // Verify redirect to home page
      await expect(page).toHaveURL(/.*home.*/);
    });

    test('TC_26: Login failed with wrong username', async ({ page }) => {
      await loginPage.login(INVALID_CREDENTIALS.wrongUser, VALID_CREDENTIALS.password);
      
      // Verify error message appears
      const errorMessage = await loginPage.getErrorMessage();
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Incorrect username or password');
      
      // Verify field border turns red
      await expect(loginPage.passwordInput).toHaveCSS('border-color', /red/);
    });

    test('TC_27: Login failed with wrong password', async ({ page }) => {
      await loginPage.login(VALID_CREDENTIALS.username, INVALID_CREDENTIALS.wrongPassword);
      
      // Verify error message appears
      const errorMessage = await loginPage.getErrorMessage();
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Incorrect username or password');
      
      // Verify field border turns red
      await expect(loginPage.passwordInput).toHaveCSS('border-color', /red/);
    });

    test('TC_28: Login failed with both wrong username and password', async ({ page }) => {
      await loginPage.login(INVALID_CREDENTIALS.wrongUser, INVALID_CREDENTIALS.wrongPassword);
      
      // Verify error message appears
      const errorMessage = await loginPage.getErrorMessage();
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Incorrect username or password');
      
      // Verify field border turns red
      await expect(loginPage.passwordInput).toHaveCSS('border-color', /red/);
    });
  });

  test.describe('Contact Field Tests', () => {
    test('TC_29: Browser opens correct action when clicking phone number', async ({ page }) => {
      const phoneLink = page.locator('a[href^="tel:"]');
      await expect(phoneLink).toBeVisible();
      
      // Verify href attribute contains tel: protocol
      const href = await phoneLink.getAttribute('href');
      expect(href).toMatch(/^tel:/);
    });

    test('TC_30: Browser opens correct task when clicking email', async ({ page }) => {
      const emailLink = page.locator('a[href^="mailto:"]');
      await expect(emailLink).toBeVisible();
      
      // Verify href attribute contains mailto: protocol
      const href = await emailLink.getAttribute('href');
      expect(href).toMatch(/^mailto:/);
    });
  });

  test.describe('Link Navigation Tests', () => {
    test('TC_31: Test the function of "Forgot passwords" button', async ({ page }) => {
      await loginPage.forgotPasswordLink.click();
      await expect(page).toHaveURL(/.*forgot-password.*/);
    });

    test('TC_32: Test the function of Open an account button', async ({ page }) => {
      await loginPage.openAccountLink.click();
      await expect(page).toHaveURL(/.*open-account.*/);
    });

    test('TC_33: Test the function of Users Guide button', async ({ page }) => {
      await loginPage.userGuideLink.click();
      await expect(page).toHaveURL(/.*users-guide.*/);
    });

    test('TC_34: Test the function of Support button', async ({ page }) => {
      await loginPage.supportLink.click();
      await expect(page).toHaveURL(/.*support.*/);
    });

    test('TC_35: Test the function of Privacy Policy button', async ({ page }) => {
      await loginPage.policyLink.click();
      await expect(page).toHaveURL(/.*privacy-policy.*/);
    });

    test('TC_36: Test the function of Terms Of User button', async ({ page }) => {
      await loginPage.termsLink.click();
      await expect(page).toHaveURL(/.*terms.*/);
    });
  });

  test.describe('Browser Compatibility Tests', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`TC_37-40: Login screen works fine on ${browserName}`, async ({ page, browserName: currentBrowser }) => {
        test.skip(currentBrowser !== browserName, `Skipping ${browserName} test on ${currentBrowser}`);
        
        await loginPage.login(VALID_CREDENTIALS.username, VALID_CREDENTIALS.password);
        
        // Verify all functions work normally
        await expect(loginPage.usernameInput).toBeVisible();
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.loginButton).toBeVisible();
        await expect(loginPage.passwordToggle).toBeVisible();
      });
    });
  });

  test.describe('Exception Tests', () => {
    test('TC_41: Allow tab navigation when using the tab key', async ({ page }) => {
      // Test tab navigation order
      await page.keyboard.press('Tab');
      await expect(loginPage.usernameInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(loginPage.passwordInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(loginPage.passwordToggle).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(loginPage.loginButton).toBeFocused();
    });

    test('TC_42: Allow re-login if page is refreshed while logged in', async ({ page }) => {
      await loginPage.fillCredentials(VALID_CREDENTIALS.username, VALID_CREDENTIALS.password);
      
      // Start login process and immediately refresh
      const loginPromise = loginPage.loginButton.click();
      await page.reload();
      
      // Verify page loads normally and allows login again
      await expect(loginPage.usernameInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.loginButton).toBeVisible();
    });

    test('TC_43: Verify login page doesn\'t cache sensitive data', async ({ page, context }) => {
      await loginPage.fillCredentials(VALID_CREDENTIALS.username, VALID_CREDENTIALS.password);
      await loginPage.loginButton.click();
      
      // Clear browser cache
      await context.clearCookies();
      await page.reload();
      
      // Check if credentials are prefilled
      await expect(loginPage.usernameInput).toHaveValue('');
      await expect(loginPage.passwordInput).toHaveValue('');
    });

    test('TC_44: Verify login response time is acceptable', async ({ page, context }) => {
        await context.setOffline(false);
        const startTime = Date.now();
      
      await loginPage.login(VALID_CREDENTIALS.username, VALID_CREDENTIALS.password);
      
      // Wait for navigation or success indicator
      await page.waitForLoadState('networkidle');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Verify response time is under 5 seconds (adjust as needed)
      expect(responseTime).toBeLessThan(5000);
    });

    test('TC_45: Verify login behavior with network disconnection', async ({ page, context }) => {
      // Simulate network disconnection
      await context.setOffline(true);
      
      await loginPage.login(VALID_CREDENTIALS.username, VALID_CREDENTIALS.password);
      
      // Verify error message appears
      const errorMessage = page.locator('.network-error, .connection-error, [class*="error"]');
      await expect(errorMessage).toBeVisible();
      
      // Reconnect network
      await context.setOffline(false);
    });
  });
});
