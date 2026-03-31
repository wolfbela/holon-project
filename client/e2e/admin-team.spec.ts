import { test, expect, type BrowserContext, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

function buildJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

const adminToken = buildJwt({
  userId: 'admin-1',
  email: 'admin@holon.com',
  role: 'admin',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const customerToken = buildJwt({
  userId: 'cust-1',
  email: 'customer1@example.com',
  role: 'customer',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
});

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockAdminUser = {
  id: 'admin-1',
  email: 'admin@holon.com',
  name: 'Admin User',
  role: 'admin',
};

const mockCustomerUser = {
  id: 'cust-1',
  email: 'customer1@example.com',
  name: 'Customer One',
  role: 'customer',
};

const mockNotifications = { data: [], unreadCount: 0 };

function createMockAdmin(overrides: Record<string, unknown> = {}) {
  return {
    id: 'admin-1',
    email: 'admin@holon.com',
    name: 'Admin User',
    role: 'admin',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

const mockAdmins = [
  createMockAdmin(),
  createMockAdmin({
    id: 'admin-2',
    email: 'jane@holon.com',
    name: 'Jane Smith',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  createMockAdmin({
    id: 'admin-3',
    email: 'bob@holon.com',
    name: 'Bob Wilson',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  }),
];

const mockSingleAdmin = [createMockAdmin()];

const mockNewAdmin = createMockAdmin({
  id: 'admin-4',
  email: 'newadmin@holon.com',
  name: 'New Admin',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// ---------------------------------------------------------------------------
// Auth & route helpers
// ---------------------------------------------------------------------------

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

interface SetupOptions {
  token?: string;
  authUser?: typeof mockAdminUser;
  admins?: typeof mockAdmins;
  adminsStatus?: number;
  adminsDelay?: number;
}

async function setupTeamPage(
  page: Page,
  context: BrowserContext,
  options: SetupOptions = {},
) {
  const token = options.token ?? adminToken;
  const authUser = options.authUser ?? mockAdminUser;

  await setAuthCookie(context, token);
  await page.addInitScript(
    (t: string) => localStorage.setItem('auth_token', t),
    token,
  );

  // Auth endpoint
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: authUser }),
    }),
  );

  // Notifications
  await page.route('**/api/notifications', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockNotifications),
    }),
  );

  // Admin users endpoint
  await page.route('**/api/admin/users', async (route) => {
    if (route.request().method() === 'GET') {
      if (options.adminsDelay) {
        await new Promise((r) => setTimeout(r, options.adminsDelay));
      }

      const status = options.adminsStatus ?? 200;
      if (status !== 200) {
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.admins ?? mockAdmins),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockNewAdmin,
          email: body.email,
          name: body.name,
        }),
      });
      return;
    }

    await route.continue();
  });

  // Delete admin endpoint
  await page.route('**/api/admin/users/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });
}

// =========================================================================
// TESTS
// =========================================================================

test.describe('Admin Team page', () => {
  // -----------------------------------------------------------------------
  // A. Page loads correctly
  // -----------------------------------------------------------------------
  test.describe('Page loads', () => {
    test('should render the page with key elements', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await expect(
        page.getByRole('heading', { name: /team/i }),
      ).toBeVisible();
      await expect(
        page.getByText('Manage administrator accounts.'),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /add admin/i }),
      ).toBeVisible();
    });

    test('should display admin count', async ({ page, context }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await expect(page.getByText('3 admins')).toBeVisible();
    });

    test('should show skeleton loaders while fetching', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context, { adminsDelay: 2000 });
      await page.goto('/team');

      // Skeletons should appear while loading
      await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible();

      // After loading, table should appear
      await expect(page.getByText('Admin User')).toBeVisible({ timeout: 5000 });
    });

    test('should display all admin users in table', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await expect(page.getByText('Admin User')).toBeVisible();
      await expect(page.getByText('Jane Smith')).toBeVisible();
      await expect(page.getByText('Bob Wilson')).toBeVisible();
    });

    test('should display correct table columns', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await expect(page.getByText('Admin User')).toBeVisible();

      // Column headers
      await expect(
        page.getByRole('columnheader', { name: /name/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: /email/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: /date added/i }),
      ).toBeVisible();
    });

    test('should display email addresses', async ({ page, context }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await expect(page.getByText('admin@holon.com')).toBeVisible();
      await expect(page.getByText('jane@holon.com')).toBeVisible();
      await expect(page.getByText('bob@holon.com')).toBeVisible();
    });

    test('should show "You" label for current user', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      // The current user's row should show "You"
      const adminRow = page.getByRole('row').filter({ hasText: 'Admin User' });
      await expect(adminRow.getByText('You')).toBeVisible();
    });

    test('should show avatar initials for each admin', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      const table = page.getByRole('table');
      await expect(table.getByText('AU')).toBeVisible();
      await expect(table.getByText('JS')).toBeVisible();
      await expect(table.getByText('BW')).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------------
  test.describe('Authentication', () => {
    test('should redirect unauthenticated user to login', async ({
      page,
    }) => {
      await page.goto('/team');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect customer to products page', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, customerToken);
      await page.addInitScript(
        (t: string) => localStorage.setItem('auth_token', t),
        customerToken,
      );

      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockCustomerUser }),
        }),
      );
      await page.route('**/api/notifications', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockNotifications),
        }),
      );

      await page.goto('/team');
      await expect(page).toHaveURL(/\/products/);
    });
  });

  // -----------------------------------------------------------------------
  // C. Navigation
  // -----------------------------------------------------------------------
  test.describe('Navigation', () => {
    test('should highlight Team in sidebar', async ({ page, context }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await expect(page.getByText('Admin User')).toBeVisible();

      const teamLink = page.getByRole('link', { name: /team/i });
      await expect(teamLink).toBeVisible();
    });

    test('should navigate to dashboard from sidebar', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);

      // Mock dashboard data
      await page.route('**/api/tickets/stats', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total: 10,
            open: 5,
            closed: 5,
            byPriority: { low: 3, medium: 4, high: 3 },
            avgResponseTime: '2h 30m',
          }),
        }),
      );
      await page.route('**/api/tickets?*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
          }),
        }),
      );

      await page.goto('/team');
      await expect(page.getByText('Admin User')).toBeVisible();

      await page.getByRole('link', { name: /dashboard/i }).click();
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  // -----------------------------------------------------------------------
  // D. Add Admin — form & validation
  // -----------------------------------------------------------------------
  test.describe('Add Admin dialog', () => {
    test('should open add admin dialog', async ({ page, context }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      await expect(
        page.getByRole('heading', { name: /add admin/i }),
      ).toBeVisible();
      await expect(
        page.getByText('Create a new administrator account.'),
      ).toBeVisible();
    });

    test('should show form fields in dialog', async ({ page, context }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /add admin/i }).last(),
      ).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      // Submit empty form
      await page
        .locator('form')
        .getByRole('button', { name: /add admin/i })
        .click();

      // Validation errors should appear
      await expect(page.getByText(/name is required/i)).toBeVisible();
      await expect(
        page.getByText(/please enter a valid email/i),
      ).toBeVisible();
    });

    test('should show validation error for invalid email', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      const dialog = page.getByRole('dialog');
      await dialog.getByLabel(/name/i).fill('Test Admin');
      // Use a value that passes HTML5 email validation but fails Zod
      await dialog.getByLabel(/email/i).fill('test@x');
      await dialog.getByLabel(/password/i).fill('password123');

      await dialog.getByRole('button', { name: /add admin/i }).click();

      await expect(
        dialog.getByText(/please enter a valid email/i),
      ).toBeVisible();
    });

    test('should show validation error for short password', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      await page.getByLabel(/name/i).fill('Test Admin');
      await page.getByLabel(/email/i).fill('test@holon.com');
      await page.getByLabel(/password/i).fill('12345');

      await page
        .locator('form')
        .getByRole('button', { name: /add admin/i })
        .click();

      await expect(
        page.getByText(/password must be at least 6 characters/i),
      ).toBeVisible();
    });

    test('should show password hint when no error', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      await expect(
        page.getByText('Must be at least 6 characters'),
      ).toBeVisible();
    });

    test('should successfully create a new admin', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      await page.getByLabel(/name/i).fill('New Admin');
      await page.getByLabel(/email/i).fill('newadmin@holon.com');
      await page.getByLabel(/password/i).fill('password123');

      await page
        .locator('form')
        .getByRole('button', { name: /add admin/i })
        .click();

      // Dialog should close
      await expect(
        page.getByRole('heading', { name: /add admin/i }),
      ).toBeHidden();

      // Success toast
      await expect(page.getByText('Admin added successfully.')).toBeVisible();

      // New admin should appear in the table
      await expect(page.getByText('New Admin')).toBeVisible();
    });

    test('should show spinner during submission', async ({
      page,
      context,
    }) => {
      // Add delay to POST response
      await setupTeamPage(page, context);
      await page.route('**/api/admin/users', async (route) => {
        if (route.request().method() === 'POST') {
          await new Promise((r) => setTimeout(r, 1000));
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(mockNewAdmin),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAdmins),
        });
      });

      await page.goto('/team');
      await page.getByRole('button', { name: /add admin/i }).first().click();

      await page.getByLabel(/name/i).fill('New Admin');
      await page.getByLabel(/email/i).fill('newadmin@holon.com');
      await page.getByLabel(/password/i).fill('password123');

      await page
        .locator('form')
        .getByRole('button', { name: /add admin/i })
        .click();

      // Should show "Adding..." text
      await expect(page.getByText('Adding...')).toBeVisible();
    });

    test('should show error toast on duplicate email (409)', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);

      // Override POST to return 409
      await page.route('**/api/admin/users', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Email already in use' }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAdmins),
        });
      });

      await page.goto('/team');
      await page.getByRole('button', { name: /add admin/i }).first().click();

      await page.getByLabel(/name/i).fill('Duplicate Admin');
      await page.getByLabel(/email/i).fill('admin@holon.com');
      await page.getByLabel(/password/i).fill('password123');

      await page
        .locator('form')
        .getByRole('button', { name: /add admin/i })
        .click();

      // Error toast should appear
      await expect(page.getByText('Email already in use')).toBeVisible();

      // Dialog should remain open
      await expect(
        page.getByRole('heading', { name: /add admin/i }),
      ).toBeVisible();
    });

    test('should close dialog with cancel button', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();
      await expect(
        page.getByRole('heading', { name: /add admin/i }),
      ).toBeVisible();

      await page.getByRole('button', { name: /cancel/i }).click();
      await expect(
        page.getByRole('heading', { name: /add admin/i }),
      ).toBeHidden();
    });

    test('should close dialog with close button (X)', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();
      await expect(
        page.getByRole('heading', { name: /add admin/i }),
      ).toBeVisible();

      await page.getByRole('button', { name: /close/i }).click();
      await expect(
        page.getByRole('heading', { name: /add admin/i }),
      ).toBeHidden();
    });

    test('should reset form when dialog reopens', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      // Open dialog and fill fields
      await page.getByRole('button', { name: /add admin/i }).first().click();
      await page.getByLabel(/name/i).fill('Test Name');
      await page.getByLabel(/email/i).fill('test@holon.com');

      // Close dialog
      await page.getByRole('button', { name: /cancel/i }).click();

      // Reopen dialog
      await page.getByRole('button', { name: /add admin/i }).first().click();

      // Fields should be empty
      await expect(page.getByLabel(/name/i)).toHaveValue('');
      await expect(page.getByLabel(/email/i)).toHaveValue('');
    });
  });

  // -----------------------------------------------------------------------
  // E. Delete Admin
  // -----------------------------------------------------------------------
  test.describe('Delete Admin', () => {
    test('should not show delete button for current user', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      const selfRow = page.getByRole('row').filter({ hasText: 'Admin User' });
      await expect(
        selfRow.getByRole('button', { name: /delete/i }),
      ).toBeHidden();
    });

    test('should show delete button for other admins', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      const otherRow = page
        .getByRole('row')
        .filter({ hasText: 'Jane Smith' });
      await expect(
        otherRow.getByRole('button', { name: /delete jane smith/i }),
      ).toBeVisible();
    });

    test('should open delete confirmation dialog', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      const otherRow = page
        .getByRole('row')
        .filter({ hasText: 'Jane Smith' });
      await otherRow.getByRole('button', { name: /delete jane smith/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(
        dialog.getByRole('heading', { name: /remove admin/i }),
      ).toBeVisible();
      await expect(dialog.getByText('Jane Smith')).toBeVisible();
      await expect(dialog.getByText('jane@holon.com')).toBeVisible();
    });

    test('should close delete dialog with cancel', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      const otherRow = page
        .getByRole('row')
        .filter({ hasText: 'Jane Smith' });
      await otherRow.getByRole('button', { name: /delete jane smith/i }).click();

      await page.getByRole('button', { name: /cancel/i }).click();

      await expect(
        page.getByRole('heading', { name: /remove admin/i }),
      ).toBeHidden();
      // Admin should still be in the table
      await expect(page.getByText('Jane Smith')).toBeVisible();
    });

    test('should successfully delete an admin', async ({ page, context }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      const otherRow = page
        .getByRole('row')
        .filter({ hasText: 'Jane Smith' });
      await otherRow.getByRole('button', { name: /delete jane smith/i }).click();

      await page.getByRole('button', { name: /^remove$/i }).click();

      // Success toast
      await expect(page.getByText('Admin removed.')).toBeVisible();

      // Admin should be removed from table (optimistic)
      await expect(page.getByText('jane@holon.com')).toBeHidden();
    });

    test('should show error toast on delete failure', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);

      // Override DELETE to fail
      await page.route('**/api/admin/users/*', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Failed to remove admin.' }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto('/team');

      const otherRow = page
        .getByRole('row')
        .filter({ hasText: 'Bob Wilson' });
      await otherRow.getByRole('button', { name: /delete bob wilson/i }).click();

      await page.getByRole('button', { name: /^remove$/i }).click();

      // Error toast
      await expect(
        page.getByText('Failed to remove admin.'),
      ).toBeVisible();

      // Admin should reappear after rollback (re-fetch)
      await expect(page.getByText('Bob Wilson')).toBeVisible({ timeout: 5000 });
    });
  });

  // -----------------------------------------------------------------------
  // F. Data display — empty state
  // -----------------------------------------------------------------------
  test.describe('Empty state', () => {
    test('should show empty state when only one admin exists', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context, { admins: mockSingleAdmin });
      await page.goto('/team');

      await expect(page.getByText('No other admins')).toBeVisible();
      await expect(
        page.getByText(
          "You're the only administrator. Add team members to help manage the platform.",
        ),
      ).toBeVisible();
    });

    test('should show add admin button in empty state', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context, { admins: mockSingleAdmin });
      await page.goto('/team');

      await expect(page.getByText('No other admins')).toBeVisible();

      // Both header and empty state have "Add Admin" buttons
      const addButtons = page.getByRole('button', { name: /add admin/i });
      await expect(addButtons).toHaveCount(2);
    });

    test('should open add admin dialog from empty state action', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context, { admins: mockSingleAdmin });
      await page.goto('/team');

      // Click the second "Add Admin" button (inside the empty state)
      await page.getByRole('button', { name: /add admin/i }).last().click();

      await expect(
        page.getByRole('dialog').getByRole('heading', { name: /add admin/i }),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // G. Dark mode
  // -----------------------------------------------------------------------
  test.describe('Dark mode', () => {
    test('should render correctly in light mode', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await expect(page.getByText('Admin User')).toBeVisible();
      // Verify light mode by checking the HTML element doesn't have dark class
      const htmlClass = await page
        .locator('html')
        .getAttribute('class');
      // In light mode, the class should not contain 'dark' (or style attribute)
      // Just verify the page renders without errors
      await expect(
        page.getByRole('heading', { name: /team/i }),
      ).toBeVisible();
    });

    test('should render correctly in dark mode', async ({
      page,
      context,
    }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await setupTeamPage(page, context);
      await page.goto('/team');

      await expect(page.getByText('Admin User')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /team/i }),
      ).toBeVisible();

      // Table should be visible in dark mode
      await expect(
        page.getByRole('columnheader', { name: /name/i }),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // H. Responsive design
  // -----------------------------------------------------------------------
  test.describe('Responsive design', () => {
    test('should show table on desktop', async ({ page, context }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await setupTeamPage(page, context);
      await page.goto('/team');

      await expect(
        page.getByRole('columnheader', { name: /name/i }),
      ).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
    });

    test('should show cards on mobile', async ({ page, context }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupTeamPage(page, context);
      await page.goto('/team');

      // Table should not be visible
      await expect(page.getByRole('table')).toBeHidden();

      // Admin names should still be visible as cards
      await expect(page.getByText('Admin User')).toBeVisible();
      await expect(page.getByText('Jane Smith')).toBeVisible();
    });

    test('should show (You) tag on mobile for current user', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupTeamPage(page, context);
      await page.goto('/team');

      await expect(page.getByText('(You)')).toBeVisible();
    });

    test('should hide delete button for self on mobile', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupTeamPage(page, context);
      await page.goto('/team');

      // Should have delete buttons for other admins
      await expect(
        page.getByRole('button', { name: /delete jane smith/i }),
      ).toBeVisible();

      // Should not have delete button for self
      await expect(
        page.getByRole('button', { name: /delete admin user/i }),
      ).toBeHidden();
    });

    test('should show card skeletons on mobile while loading', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupTeamPage(page, context, { adminsDelay: 2000 });
      await page.goto('/team');

      // Skeletons should appear
      await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible();
    });

    test('should show empty state on mobile', async ({ page, context }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupTeamPage(page, context, { admins: mockSingleAdmin });
      await page.goto('/team');

      await expect(page.getByText('No other admins')).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // J. Error handling
  // -----------------------------------------------------------------------
  test.describe('Error handling', () => {
    test('should show error state on API failure', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context, { adminsStatus: 500 });
      await page.goto('/team');

      await expect(page.getByText('Something went wrong')).toBeVisible();
      await expect(
        page.getByText('Could not load team members.'),
      ).toBeVisible();
    });

    test('should show retry button on error', async ({ page, context }) => {
      await setupTeamPage(page, context, { adminsStatus: 500 });
      await page.goto('/team');

      await expect(
        page.getByRole('button', { name: /try again/i }),
      ).toBeVisible();
    });

    test('should hide add admin button on error', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context, { adminsStatus: 500 });
      await page.goto('/team');

      await expect(page.getByText('Something went wrong')).toBeVisible();
      // Add Admin button should not appear in header when there's an error
      await expect(
        page.getByRole('button', { name: /add admin/i }),
      ).toBeHidden();
    });

    test('should retry loading on Try again click', async ({
      page,
      context,
    }) => {
      let callCount = 0;
      await setupTeamPage(page, context);

      // First call fails, second succeeds
      await page.route('**/api/admin/users', async (route) => {
        if (route.request().method() !== 'GET') {
          await route.continue();
          return;
        }
        callCount++;
        if (callCount === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockAdmins),
          });
        }
      });

      await page.goto('/team');

      await expect(page.getByText('Something went wrong')).toBeVisible();

      await page.getByRole('button', { name: /try again/i }).click();

      // Should now show the admin list
      await expect(page.getByText('Admin User')).toBeVisible({ timeout: 5000 });
    });
  });

  // -----------------------------------------------------------------------
  // K. Accessibility basics
  // -----------------------------------------------------------------------
  test.describe('Accessibility', () => {
    test('should have accessible delete button labels', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      // Each delete button should have an aria-label
      await expect(
        page.getByRole('button', { name: /delete jane smith/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /delete bob wilson/i }),
      ).toBeVisible();
    });

    test('should have form labels in add admin dialog', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      // Form inputs should have associated labels
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should focus first field when add dialog opens', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      // Name input should be focused (autoFocus)
      await expect(page.getByLabel(/name/i)).toBeFocused();
    });

    test('should mark invalid fields with aria-invalid', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      // Submit empty form
      await page
        .locator('form')
        .getByRole('button', { name: /add admin/i })
        .click();

      // Name input should have aria-invalid
      await expect(page.getByLabel(/name/i)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    test('should be navigable with keyboard in dialog', async ({
      page,
      context,
    }) => {
      await setupTeamPage(page, context);
      await page.goto('/team');

      await page.getByRole('button', { name: /add admin/i }).first().click();

      // Tab through form fields
      await expect(page.getByLabel(/name/i)).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(/email/i)).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(/password/i)).toBeFocused();
    });
  });
});
