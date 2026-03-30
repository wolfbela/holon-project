import { test, expect, type BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers — craft minimal JWT cookies so middleware can decode them.
// ---------------------------------------------------------------------------

const HEADER = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const SIGNATURE = 'fakesig';

function buildJwt(payload: Record<string, unknown>): string {
  return `${HEADER}.${btoa(JSON.stringify(payload))}.${SIGNATURE}`;
}

const customerToken = buildJwt({
  userId: 'cust-1',
  email: 'customer1@example.com',
  role: 'customer',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
});

const adminToken = buildJwt({
  userId: 'admin-1',
  email: 'admin@holon.com',
  role: 'admin',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
});

async function setAuthCookie(context: BrowserContext, token: string) {
  await context.addCookies([
    {
      name: 'auth_token',
      value: token,
      domain: 'localhost',
      path: '/',
    },
  ]);
}

// ===================================================================
// LOGIN PAGE — /login
// ===================================================================

test.describe('Login page', () => {
  // -----------------------------------------------------------------
  // A. Page loads correctly
  // -----------------------------------------------------------------

  test.describe('Page loads', () => {
    test('should render with heading and subtitle', async ({ page }) => {
      await page.goto('/login');
      await expect(page).toHaveURL('/login');
      await expect(
        page.getByRole('heading', { name: /sign in/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/sign in to your account to continue/i),
      ).toBeVisible();
    });

    test('should render email and password fields', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should render the sign in button', async ({ page }) => {
      await page.goto('/login');
      await expect(
        page.getByRole('button', { name: /sign in/i }),
      ).toBeVisible();
    });

    test('should render the register link', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('link', { name: /register/i })).toBeVisible();
    });

    test('should have correct input placeholders', async ({ page }) => {
      await page.goto('/login');
      await expect(
        page.getByPlaceholder('you@example.com'),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('Enter your password'),
      ).toBeVisible();
    });

    test('should not have console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto('/login');
      await page.waitForTimeout(1000);
      expect(errors).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  test.describe('Authentication redirects', () => {
    test('should redirect authenticated customer away from login', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, customerToken);
      await page.goto('/login');
      await expect(page).toHaveURL(/\/products/);
    });

    test('should redirect authenticated admin away from login', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, adminToken);
      await page.goto('/login');
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  // -----------------------------------------------------------------
  // C. Navigation
  // -----------------------------------------------------------------

  test.describe('Navigation', () => {
    test('register link should navigate to /register', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('link', { name: /register/i }).click();
      await expect(page).toHaveURL(/\/register/);
    });

    test('logo link should navigate to landing page', async ({ page }) => {
      await page.goto('/login');
      const logo = page.getByRole('link', { name: /agilite/i }).first();
      await logo.click();
      await expect(page).toHaveURL('/');
    });
  });

  // -----------------------------------------------------------------
  // D. Form validation
  // -----------------------------------------------------------------

  test.describe('Form validation', () => {
    test('should show email validation error on empty submit', async ({
      page,
    }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByText(/please enter a valid email/i)).toBeVisible();
    });

    test('should show password validation error on empty submit', async ({
      page,
    }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('user@example.com');
      await page.getByRole('button', { name: /sign in/i }).click();
      // Password min(1) — error should appear for empty password
      await expect(
        page.locator('p.text-destructive').last(),
      ).toBeVisible();
    });

    test('should show validation error for invalid email format', async ({
      page,
    }) => {
      await page.goto('/login');
      // Use dispatch to bypass HTML5 email validation and let Zod handle it
      await page.getByLabel(/email/i).fill('not-an-email');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();
      // Either HTML5 validation prevents submit (no error text) or Zod shows error
      const emailInput = page.getByLabel(/email/i);
      const validationMessage = await emailInput.evaluate(
        (el: HTMLInputElement) => el.validationMessage,
      );
      // HTML5 type="email" blocks submission with its own validation
      expect(validationMessage.length).toBeGreaterThan(0);
    });

    test('should set aria-invalid on fields with errors', async ({
      page,
    }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByLabel(/email/i)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    test('should preserve email input after validation failure', async ({
      page,
    }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('user@example.com');
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByLabel(/email/i)).toHaveValue(
        'user@example.com',
      );
    });
  });

  // -----------------------------------------------------------------
  // E. Form submission (mocked API)
  // -----------------------------------------------------------------

  test.describe('Form submission', () => {
    test('should show loading state during submission', async ({ page }) => {
      // Intercept the login request and delay it
      await page.route('**/api/auth/login', async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'fake-jwt',
            user: {
              id: '1',
              email: 'user@example.com',
              name: 'Test',
              role: 'customer',
            },
          }),
        });
      });

      await page.goto('/login');
      await page.getByLabel(/email/i).fill('user@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Button should show loading state
      await expect(page.getByText(/signing in/i)).toBeVisible();

      // Inputs should be disabled
      await expect(page.getByLabel(/email/i)).toBeDisabled();
      await expect(page.getByLabel(/password/i)).toBeDisabled();
    });

    test('should show error toast on invalid credentials', async ({
      page,
    }) => {
      // Use 400 instead of 401 — the api-client auto-redirects on 401
      await page.route('**/api/auth/login', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid credentials' }),
        });
      });

      await page.goto('/login');
      await page.getByLabel(/email/i).fill('user@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Toast should appear with error message
      await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    });

    test('should show generic error toast on network failure', async ({
      page,
    }) => {
      await page.route('**/api/auth/login', async (route) => {
        await route.abort('connectionrefused');
      });

      await page.goto('/login');
      await page.getByLabel(/email/i).fill('user@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(
        page.getByText(/something went wrong/i),
      ).toBeVisible();
    });

    test('should redirect customer to /products on successful login', async ({
      page,
    }) => {
      await page.route('**/api/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: customerToken,
            user: {
              id: 'cust-1',
              email: 'customer1@example.com',
              name: 'Customer',
              role: 'customer',
            },
          }),
        });
      });

      await page.goto('/login');
      await page.getByLabel(/email/i).fill('customer1@example.com');
      await page.getByLabel(/password/i).fill('customer123');
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page).toHaveURL(/\/products/, { timeout: 5000 });
    });

    test('should redirect admin to /dashboard on successful login', async ({
      page,
    }) => {
      await page.route('**/api/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: adminToken,
            user: {
              id: 'admin-1',
              email: 'admin@holon.com',
              name: 'Admin',
              role: 'admin',
            },
          }),
        });
      });

      await page.goto('/login');
      await page.getByLabel(/email/i).fill('admin@holon.com');
      await page.getByLabel(/password/i).fill('admin123');
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
    });
  });

  // -----------------------------------------------------------------
  // G. Dark mode
  // -----------------------------------------------------------------

  test.describe('Dark mode', () => {
    test('should render correctly in light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/login');
      await expect(
        page.getByRole('heading', { name: /sign in/i }),
      ).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });

    test('should render correctly in dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/login');
      await expect(
        page.getByRole('heading', { name: /sign in/i }),
      ).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // H. Responsive design
  // -----------------------------------------------------------------

  test.describe('Responsive design', () => {
    test('should show branding panel on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/login');
      await expect(page.getByText(/welcome back/i)).toBeVisible();
      await expect(
        page.getByText(/smart ticketing system/i),
      ).toBeVisible();
    });

    test('should hide branding panel on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/login');
      // Desktop branding panel should be hidden
      await expect(page.getByText(/welcome back/i)).toBeHidden();
      // Mobile branding should be visible
      await expect(
        page.locator('.lg\\:hidden').getByText(/agilite/i),
      ).toBeVisible();
    });

    test('should show mobile branding on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/login');
      // Below lg breakpoint, desktop panel hidden, mobile branding visible
      await expect(page.getByText(/welcome back/i)).toBeHidden();
    });

    test('should render form properly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/login');
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /sign in/i }),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // K. Accessibility
  // -----------------------------------------------------------------

  test.describe('Accessibility', () => {
    test('should have exactly one h1 heading', async ({ page }) => {
      await page.goto('/login');
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(/sign in/i);
    });

    test('should have labels associated with inputs', async ({ page }) => {
      await page.goto('/login');
      // getByLabel works when label[for] matches input[id]
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should support keyboard navigation (tab order)', async ({
      page,
    }) => {
      await page.goto('/login');

      // Focus the email input first
      await page.getByLabel(/email/i).focus();
      const emailFocused = await page.evaluate(
        () => document.activeElement?.getAttribute('id'),
      );
      expect(emailFocused).toBe('email');

      // Tab to password input
      await page.keyboard.press('Tab');
      const passwordFocused = await page.evaluate(
        () => document.activeElement?.getAttribute('id'),
      );
      expect(passwordFocused).toBe('password');

      // Tab to submit button
      await page.keyboard.press('Tab');
      const buttonFocused = await page.evaluate(
        () => document.activeElement?.textContent?.trim(),
      );
      expect(buttonFocused).toBe('Sign in');
    });

    test('should submit form with Enter key', async ({ page }) => {
      await page.route('**/api/auth/login', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid credentials' }),
        });
      });

      await page.goto('/login');
      await page.getByLabel(/email/i).fill('user@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.keyboard.press('Enter');

      // Should attempt submission — error toast appears because we mocked a 400
      await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    });

    test('should have password field with type=password', async ({
      page,
    }) => {
      await page.goto('/login');
      await expect(page.getByLabel(/password/i)).toHaveAttribute(
        'type',
        'password',
      );
    });

    test('should have autocomplete attributes', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByLabel(/email/i)).toHaveAttribute(
        'autocomplete',
        'email',
      );
      await expect(page.getByLabel(/password/i)).toHaveAttribute(
        'autocomplete',
        'current-password',
      );
    });
  });
});
