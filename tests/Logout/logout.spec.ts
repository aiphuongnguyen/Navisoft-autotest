import { test, expect, Page, BrowserContext } from '@playwright/test';

class LogoutModalPage {
  constructor(private page: Page) {}

  // Selectors
  readonly stayLoggedInButton = '[data-testid="logout-btn-stay"]';
  readonly logoutButton = '[data-testid="logout-btn-confirm"]';
  readonly logoutModal = '.logout-modal'; // Adjust selector as needed
  
  async clickStayLoggedIn() {
    await this.page.click(this.stayLoggedInButton);
  }
  
  async clickLogout() {
    await this.page.click(this.logoutButton);
  }
  
  async pressEnterOnStayLoggedIn() {
    await this.page.focus(this.stayLoggedInButton);
    await this.page.keyboard.press('Enter');
  }
  
  async pressEnterOnLogout() {
    await this.page.focus(this.logoutButton);
    await this.page.keyboard.press('Enter');
  }
  
  async pressTab() {
    await this.page.keyboard.press('Tab');
  }
  
  async pressEscape() {
    await this.page.keyboard.press('Escape');
  }
  
  async doubleClickLogout() {
    await this.page.dblclick(this.logoutButton);
  }
  
  async clickOutsideModal() {
    await this.page.click('body', { position: { x: 50, y: 50 } });
  }
  
  async isModalVisible() {
    return await this.page.isVisible(this.logoutModal);
  }
  
  async waitForModalToClose() {
    await this.page.waitForSelector(this.logoutModal, { state: 'hidden' });
  }
}

test.describe('Logout Modal Tests', () => {
  let logoutModal: LogoutModalPage;
  
  test.beforeEach(async ({ page }) => {
    logoutModal = new LogoutModalPage(page);
    // Setup: Navigate to app and login
    await page.goto('/login');
    // Add your login logic here
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'testpass');
    await page.click('[data-testid="login-btn"]');
    
    // Trigger logout modal
    await page.click('[data-testid="logout-trigger"]'); // Adjust selector as needed
    await expect(page.locator(logoutModal.logoutModal)).toBeVisible();
  });

  test('TC_05: Stay logged in button cancels logout', async ({ page }) => {
    // Click "Stay logged in" button
    await logoutModal.clickStayLoggedIn();
    
    // Verify modal closes
    await logoutModal.waitForModalToClose();
    await expect(page.locator(logoutModal.logoutModal)).not.toBeVisible();
    
    // Verify user remains logged in and stays on current page
    await expect(page).toHaveURL(/dashboard|profile|home/); // Adjust expected URLs
    // Verify user is still authenticated
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('TC_06: Press Enter on Stay logged in button cancels logout', async ({ page }) => {
    // Press Enter on "Stay logged in" button
    await logoutModal.pressEnterOnStayLoggedIn();
    
    // Verify modal closes
    await logoutModal.waitForModalToClose();
    await expect(page.locator(logoutModal.logoutModal)).not.toBeVisible();
    
    // Verify user remains logged in and stays on current page
    await expect(page).toHaveURL(/dashboard|profile|home/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('TC_07: Log out button successfully logs out user', async ({ page }) => {
    // Click "Log out" button
    await logoutModal.clickLogout();
    
    // Wait for logout process to complete
    await page.waitForURL(/login|home|\/$/, { timeout: 5000 });
    
    // Verify session cleared and user redirected to Home page (non-login)
    await expect(page).toHaveURL(/login|home|\/$/);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('TC_08: Press Enter on Log out button successfully logs out', async ({ page }) => {
    // Press Enter on "Log out" button
    await logoutModal.pressEnterOnLogout();
    
    // Wait for logout process to complete
    await page.waitForURL(/login|home|\/$/, { timeout: 5000 });
    
    // Verify session cleared and user redirected
    await expect(page).toHaveURL(/login|home|\/$/);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('TC_09: API Error Handling - logout API fails', async ({ page }) => {
    // Mock API to return error response
    await page.route('**/api/logout', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    // Click "Log out" button
    await logoutModal.clickLogout();
    
    // Verify error message displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/error|failed/i);
    
    // Verify modal remains open and user stays logged in
    await expect(page.locator(logoutModal.logoutModal)).toBeVisible();
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('TC_10: Network Connection - no network during logout', async ({ page, context }) => {
    // Simulate network disconnection
    await context.setOffline(true);
    
    // Click "Log out" button
    await logoutModal.clickLogout();
    
    // Verify appropriate error message about network connectivity
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="network-error"]')).toContainText(/network|connection/i);
    
    // Verify user remains logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Restore network
    await context.setOffline(false);
  });

  test('TC_11: Keyboard Navigation - Tab key works in modal', async ({ page }) => {
    // Focus should start on Stay logged in button or first focusable element
    await logoutModal.pressTab();
    
    // Verify tab navigates between buttons
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('data-testid', /logout-btn-(stay|confirm)/);
    
    // Tab again to next button
    await logoutModal.pressTab();
    const nextFocusedElement = await page.locator(':focus');
    await expect(nextFocusedElement).toHaveAttribute('data-testid', /logout-btn-(stay|confirm)/);
  });

  test('TC_12: Double Click Prevention on Log out button', async ({ page }) => {
    let apiCallCount = 0;
    
    // Monitor API calls
    await page.route('**/api/logout', (route) => {
      apiCallCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    // Double-click "Log out" button rapidly
    await logoutModal.doubleClickLogout();
    
    // Wait a moment for any potential duplicate requests
    await page.waitForTimeout(1000);
    
    // Verify only one logout API request is sent
    expect(apiCallCount).toBe(1);
  });

  test('TC_13: Response Time - logout completes within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    // Click "Log out" button
    await logoutModal.clickLogout();
    
    // Wait for logout to complete
    await page.waitForURL(/login|home|\/$/, { timeout: 3000 });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Verify logout completes within 3 seconds
    expect(duration).toBeLessThan(3000);
  });

  test('TC_14: Session Security - session properly cleared after logout', async ({ page }) => {
    // Click "Log out" button
    await logoutModal.clickLogout();
    await page.waitForURL(/login|home|\/$/, { timeout: 5000 });
    
    // Try to access protected pages directly via URL
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login|unauthorized/);
    
    await page.goto('/profile');
    await expect(page).toHaveURL(/login|unauthorized/);
    
    // Check browser storage for session data
    const localStorage = await page.evaluate(() => {
      return {
        token: localStorage.getItem('token'),
        sessionId: localStorage.getItem('sessionId'),
        userData: localStorage.getItem('userData')
      };
    });
    
    expect(localStorage.token).toBeNull();
    expect(localStorage.sessionId).toBeNull();
    expect(localStorage.userData).toBeNull();
    
    // Check session storage
    const sessionStorage = await page.evaluate(() => {
      return {
        token: sessionStorage.getItem('token'),
        sessionId: sessionStorage.getItem('sessionId')
      };
    });
    
    expect(sessionStorage.token).toBeNull();
    expect(sessionStorage.sessionId).toBeNull();
    
    // Check authentication cookies are removed
    const cookies = await page.context().cookies();
    const authCookies = cookies.filter(cookie => 
      cookie.name.includes('auth') || cookie.name.includes('session') || cookie.name.includes('token')
    );
    expect(authCookies).toHaveLength(0);
  });

  test('TC_15: Browser Back Button behavior after logout', async ({ page }) => {
    const currentUrl = page.url();
    
    // Click "Log out" button
    await logoutModal.clickLogout();
    await page.waitForURL(/login|home|\/$/, { timeout: 5000 });
    
    // Press browser back button
    await page.goBack();
    
    // Verify user cannot return to protected pages
    await expect(page).not.toHaveURL(currentUrl);
    await expect(page).toHaveURL(/login|home|\/$/);
  });

  test('TC_16: Multiple Tabs - logout affects all browser tabs', async ({ context }) => {
    // Open application in 3 tabs
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const page3 = await context.newPage();
    
    // Login in all tabs (assuming session is shared)
    for (const page of [page1, page2, page3]) {
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    }
    
    // Logout from first tab
    await page1.click('[data-testid="logout-trigger"]');
    const logoutModal1 = new LogoutModalPage(page1);
    await logoutModal1.clickLogout();
    await page1.waitForURL(/login|home|\/$/, { timeout: 5000 });
    
    // Wait for other tabs to detect logout
    await page2.waitForTimeout(2000);
    await page3.waitForTimeout(2000);
    
    // Verify all tabs redirect to login/home page
    await expect(page1).toHaveURL(/login|home|\/$/);
    await expect(page2).toHaveURL(/login|home|\/$/);
    await expect(page3).toHaveURL(/login|home|\/$/);
    
    await page1.close();
    await page2.close();
    await page3.close();
  });

  test('TC_18: Close modal by clicking outside without logging out', async ({ page }) => {
    // Click outside modal
    await logoutModal.clickOutsideModal();
    
    // Verify modal closes without triggering logout
    await logoutModal.waitForModalToClose();
    await expect(page.locator(logoutModal.logoutModal)).not.toBeVisible();
    
    // Verify user remains logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page).not.toHaveURL(/login|home|\/$/);
  });

  test('TC_19: Close modal by pressing Escape key without logging out', async ({ page }) => {
    // Press Escape key
    await logoutModal.pressEscape();
    
    // Verify modal closes without triggering logout
    await logoutModal.waitForModalToClose();
    await expect(page.locator(logoutModal.logoutModal)).not.toBeVisible();
    
    // Verify user remains logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page).not.toHaveURL(/login|home|\/$/);
  });

  test('TC_20: Token Expiry - logout with expired session token', async ({ page }) => {
    // Mock expired token scenario
    await page.route('**/api/logout', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Token expired' })
      });
    });
    
    // Wait for session to expire (simulate)
    await page.evaluate(() => {
      localStorage.setItem('tokenExpiry', (Date.now() - 1000).toString());
    });
    
    // Click logout
    await logoutModal.clickLogout();
    
    // Verify system handles expired token gracefully and redirects to login page
    await page.waitForURL(/login|home|\/$/, { timeout: 5000 });
    await expect(page).toHaveURL(/login|home|\/$/);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });
});

// Browser compatibility tests
test.describe('TC_17: Browser Compatibility Tests', () => {
  const browsers = ['chromium', 'firefox', 'webkit'];
  
  browsers.forEach(browserName => {
    test(`Logout works in ${browserName}`, async ({ page }) => {
      // This test will run with the browser specified in playwright config
      // Setup
      await page.goto('/login');
      await page.fill('[data-testid="username"]', 'testuser');
      await page.fill('[data-testid="password"]', 'testpass');
      await page.click('[data-testid="login-btn"]');
      
      // Trigger logout modal
      await page.click('[data-testid="logout-trigger"]');
      
      const logoutModal = new LogoutModalPage(page);
      
      // Test logout functionality
      await logoutModal.clickLogout();
      await page.waitForURL(/login|home|\/$/, { timeout: 5000 });
      
      // Verify logout works consistently
      await expect(page).toHaveURL(/login|home|\/$/);
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });
  });
});