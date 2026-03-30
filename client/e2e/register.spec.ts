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
// REGISTER PAGE — /register
// ===================================================================

test.describe('Register page', () => {
  // -----------------------------------------------------------------
  // A. Page loads correctly
  // -----------------------------------------------------------------

  test.describe('Page loads', () => {
    test('should render with heading and subtitle', async ({ page }) => {
      await page.goto('/register');
      await expect(page).toHaveURL('/register');
      await expect(
        page.getByRole('heading', { name: /register/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/create a new account to get started/i),
      ).toBeVisible();
    });

    test('should render name, email, and password fields', async ({
      page,
    }) => {
      await page.goto('/register');
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should render the create account button', async ({ page }) => {
      await page.goto('/register');
      await expect(
        page.getByRole('button', { name: /create account/i }),
      ).toBeVisible();
    });

    test('should render the sign in link', async ({ page }) => {
      await page.goto('/register');
      await expect(
        page.getByRole('link', { name: /sign in/i }),
      ).toBeVisible();
    });

    test('should have correct input placeholders', async ({ page }) => {
      await page.goto('/register');
      await expect(page.getByPlaceholder('John Doe')).toBeVisible();
      await expect(
        page.getByPlaceholder('you@example.com'),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('At least 6 characters'),
      ).toBeVisible();
    });

    test('should show password hint below the field', async ({ page }) => {
      await page.goto('/register');
      await expect(
        page.getByText(/must be at least 6 characters/i),
      ).toBeVisible();
    });

    test('should not have console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto('/register');
      await page.waitForTimeout(1000);
      expect(errors).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  test.describe('Authentication redirects', () => {
    test('should redirect authenticated customer away from register', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, customerToken);
      await page.goto('/register');
      await expect(page).toHaveURL(/\/products/);
    });

    test('should redirect authenticated admin away from register', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, adminToken);
      await page.goto('/register');
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  // -----------------------------------------------------------------
  // C. Navigation
  // -----------------------------------------------------------------

  test.describe('Navigation', () => {
    test('sign in link should navigate to /login', async ({ page }) => {
      await page.goto('/register');
      await page.getByRole('link', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/login/);
    });

    test('logo link should navigate to landing page', async ({ page }) => {
      await page.goto('/register');
      const logo = page.getByRole('link', { name: /agilite/i }).first();
      await logo.click();
      await expect(page).toHaveURL('/');
    });
  });

  // -----------------------------------------------------------------
  // D. Form validation
  // -----------------------------------------------------------------

  test.describe('Form validation', () => {
    test('should show name validation error on empty submit', async ({
      page,
    }) => {
      await page.goto('/register');
      await page.getByRole('button', { name: /create account/i }).click();
      await expect(page.getByText(/name is required/i)).toBeVisible();
    });

    test('should show email validation error on empty submit', async ({
      page,
    }) => {
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByRole('button', { name: /create account/i }).click();
      await expect(
        page.getByText(/please enter a valid email/i),
      ).toBeVisible();
    });

    test('should show password validation error on empty submit', async ({
      page,
    }) => {
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('user@example.com');
      await page.getByRole('button', { name: /create account/i }).click();
      // Password min(6) — error replaces the hint
      await expect(
        page.getByText(/password must be at least 6 characters/i),
      ).toBeVisible();
    });

    test('should show validation error for invalid email format', async ({
      page,
    }) => {
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('not-an-email');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /create account/i }).click();
      // HTML5 type="email" blocks submission with its own validation
      const emailInput = page.getByLabel(/email/i);
      const validationMessage = await emailInput.evaluate(
        (el: HTMLInputElement) => el.validationMessage,
      );
      expect(validationMessage.length).toBeGreaterThan(0);
    });

    test('should show validation error for short password', async ({
      page,
    }) => {
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('user@example.com');
      await page.getByLabel(/password/i).fill('abc');
      await page.getByRole('button', { name: /create account/i }).click();
      await expect(
        page.getByText(/password must be at least 6 characters/i),
      ).toBeVisible();
    });

    test('should set aria-invalid on fields with errors', async ({
      page,
    }) => {
      await page.goto('/register');
      await page.getByRole('button', { name: /create account/i }).click();
      await expect(page.getByLabel(/name/i)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      await expect(page.getByLabel(/email/i)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    test('should preserve input values after validation failure', async ({
      page,
    }) => {
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('user@example.com');
      // Leave password empty to trigger error
      await page.getByRole('button', { name: /create account/i }).click();
      await expect(page.getByLabel(/name/i)).toHaveValue('Test User');
      await expect(page.getByLabel(/email/i)).toHaveValue(
        'user@example.com',
      );
    });

    test('should replace password hint with error on validation failure', async ({
      page,
    }) => {
      await page.goto('/register');
      // Hint should be visible initially
      await expect(
        page.locator('p.text-muted-foreground', {
          hasText: /must be at least 6 characters/i,
        }),
      ).toBeVisible();

      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('user@example.com');
      await page.getByLabel(/password/i).fill('abc');
      await page.getByRole('button', { name: /create account/i }).click();

      // Error should replace hint
      await expect(
        page.locator('p.text-destructive', {
          hasText: /password must be at least 6 characters/i,
        }),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // E. Form submission (mocked API)
  // -----------------------------------------------------------------

  test.describe('Form submission', () => {
    test('should show loading state during submission', async ({ page }) => {
      await page.route('**/api/auth/register', async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            token: customerToken,
            user: {
              id: 'cust-new',
              email: 'newuser@example.com',
              name: 'New User',
              role: 'customer',
            },
          }),
        });
      });

      await page.goto('/register');
      await page.getByLabel(/name/i).fill('New User');
      await page.getByLabel(/email/i).fill('newuser@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /create account/i }).click();

      // Button should show loading state
      await expect(page.getByText(/creating account/i)).toBeVisible();

      // Inputs should be disabled
      await expect(page.getByLabel(/name/i)).toBeDisabled();
      await expect(page.getByLabel(/email/i)).toBeDisabled();
      await expect(page.getByLabel(/password/i)).toBeDisabled();
    });

    test('should redirect to /products on successful registration', async ({
      page,
    }) => {
      await page.route('**/api/auth/register', async (route) => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            token: customerToken,
            user: {
              id: 'cust-new',
              email: 'newuser@example.com',
              name: 'New User',
              role: 'customer',
            },
          }),
        });
      });

      await page.goto('/register');
      await page.getByLabel(/name/i).fill('New User');
      await page.getByLabel(/email/i).fill('newuser@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page).toHaveURL(/\/products/, { timeout: 5000 });
    });

    test('should show error toast when email already exists', async ({
      page,
    }) => {
      await page.route('**/api/auth/register', async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Email already in use' }),
        });
      });

      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Existing User');
      await page.getByLabel(/email/i).fill('existing@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page.getByText(/email already in use/i)).toBeVisible();
    });

    test('should show generic error toast on network failure', async ({
      page,
    }) => {
      await page.route('**/api/auth/register', async (route) => {
        await route.abort('connectionrefused');
      });

      await page.goto('/register');
      await page.getByLabel(/name/i).fill('New User');
      await page.getByLabel(/email/i).fill('newuser@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(
        page.getByText(/something went wrong/i),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // G. Dark mode
  // -----------------------------------------------------------------

  test.describe('Dark mode', () => {
    test('should render correctly in light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/register');
      await expect(
        page.getByRole('heading', { name: /register/i }),
      ).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });

    test('should render correctly in dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/register');
      await expect(
        page.getByRole('heading', { name: /register/i }),
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
      await page.goto('/register');
      await expect(page.getByText(/create your account/i)).toBeVisible();
      await expect(
        page.getByText(/smart ticketing system/i),
      ).toBeVisible();
    });

    test('should hide branding panel on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/register');
      // Desktop branding panel should be hidden
      await expect(
        page.getByRole('heading', { name: /create your account/i }),
      ).toBeHidden();
      // Mobile branding should be visible
      await expect(
        page.locator('.lg\\:hidden').getByText(/agilite/i),
      ).toBeVisible();
    });

    test('should hide branding panel on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/register');
      await expect(
        page.getByRole('heading', { name: /create your account/i }),
      ).toBeHidden();
    });

    test('should render form properly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/register');
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /create account/i }),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // K. Accessibility
  // -----------------------------------------------------------------

  test.describe('Accessibility', () => {
    test('should have exactly one h1 heading', async ({ page }) => {
      await page.goto('/register');
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(/register/i);
    });

    test('should have labels associated with inputs', async ({ page }) => {
      await page.goto('/register');
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should support keyboard navigation (tab order)', async ({
      page,
    }) => {
      await page.goto('/register');

      // Focus the name input first
      await page.getByLabel(/name/i).focus();
      const nameFocused = await page.evaluate(
        () => document.activeElement?.getAttribute('id'),
      );
      expect(nameFocused).toBe('name');

      // Tab to email input
      await page.keyboard.press('Tab');
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
      expect(buttonFocused).toBe('Create account');
    });

    test('should submit form with Enter key', async ({ page }) => {
      await page.route('**/api/auth/register', async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Email already in use' }),
        });
      });

      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('user@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.keyboard.press('Enter');

      await expect(page.getByText(/email already in use/i)).toBeVisible();
    });

    test('should have password field with type=password', async ({
      page,
    }) => {
      await page.goto('/register');
      await expect(page.getByLabel(/password/i)).toHaveAttribute(
        'type',
        'password',
      );
    });

    test('should have autocomplete attributes', async ({ page }) => {
      await page.goto('/register');
      await expect(page.getByLabel(/name/i)).toHaveAttribute(
        'autocomplete',
        'name',
      );
      await expect(page.getByLabel(/email/i)).toHaveAttribute(
        'autocomplete',
        'email',
      );
      await expect(page.getByLabel(/password/i)).toHaveAttribute(
        'autocomplete',
        'new-password',
      );
    });
  });
});
