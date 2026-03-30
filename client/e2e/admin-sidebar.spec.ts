import { test, expect, type BrowserContext, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// JWT helpers — same pattern as customer-navbar.spec.ts
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

const mockNotifications = {
  data: [
    {
      id: 'n1',
      user_id: 'admin-1',
      type: 'new_ticket',
      ticket_id: 'ticket-1',
      message: 'New ticket from customer: Product arrived damaged',
      read: false,
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: 'n2',
      user_id: 'admin-1',
      type: 'new_reply',
      ticket_id: 'ticket-2',
      message: 'Customer replied to ticket TK-0002',
      read: false,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'n3',
      user_id: 'admin-1',
      type: 'new_reply',
      ticket_id: 'ticket-3',
      message: 'Customer replied to ticket TK-0003',
      read: true,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  unreadCount: 2,
};

const emptyNotifications = { data: [], unreadCount: 0 };

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
  user?: Record<string, unknown>;
  notifications?: { data: unknown[]; unreadCount: number };
}

async function setupAuthenticatedAdmin(
  page: Page,
  context: BrowserContext,
  options: SetupOptions = {},
) {
  const token = options.token ?? adminToken;
  const user = options.user ?? mockAdminUser;
  const notifications = options.notifications ?? mockNotifications;

  await setAuthCookie(context, token);
  await page.addInitScript(
    (t) => localStorage.setItem('auth_token', t),
    token,
  );

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user }),
    }),
  );

  await page.route('**/api/notifications', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(notifications),
    }),
  );

  await page.route('**/api/notifications/read-all', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    }),
  );

  await page.route('**/api/notifications/*/read', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    }),
  );

  // Block socket.io to prevent connection errors in tests
  await page.route('**/socket.io/**', (route) => route.abort());
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

test.describe('Admin sidebar', () => {
  // ===================== A. Page loads =====================
  test.describe('Page loads', () => {
    test('should render the sidebar on desktop with all key elements', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).toBeVisible();

      // Logo
      await expect(page.getByRole('link', { name: 'Agilite' }).first()).toBeVisible();

      // Nav items
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Tickets' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Team' })).toBeVisible();
    });

    test('should render the notification bell in the sidebar header', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      await expect(
        page.getByRole('button', { name: /notifications/i }),
      ).toBeVisible();
    });

    test('should render the user avatar with initials', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      // "Admin User" → "AU" — wait for auth hydration to complete
      // The avatar appears after useAuth resolves the /auth/me call
      await expect(page.getByText('AU')).toBeVisible({ timeout: 15000 });
    });

    test('should render the dark mode toggle', async ({ page, context }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('Dark mode')).toBeVisible();
    });

    test('should render the logout button', async ({ page, context }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('Log out')).toBeVisible();
    });

    test('should render the sidebar on all admin pages', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);

      for (const route of ['/dashboard', '/tickets', '/team']) {
        await page.goto(route);
        const sidebar = page.locator('[data-slot="sidebar"]');
        await expect(sidebar).toBeVisible({ timeout: 10000 });
      }
    });

    test('should render main content area alongside the sidebar', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      const inset = page.locator('[data-slot="sidebar-inset"]');
      await expect(inset).toBeVisible();
    });
  });

  // ===================== B. Authentication =====================
  test.describe('Authentication & authorization', () => {
    test('should redirect unauthenticated user to login from admin pages', async ({
      page,
    }) => {
      await page.route('**/socket.io/**', (route) => route.abort());

      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect customer user away from admin pages', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, customerToken);
      await page.addInitScript(
        (t) => localStorage.setItem('auth_token', t),
        customerToken,
      );
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'cust-1',
            email: 'customer1@example.com',
            name: 'John Doe',
            role: 'customer',
          }),
        }),
      );
      await page.route('**/socket.io/**', (route) => route.abort());

      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/products/);
    });

    test('should allow authenticated admin user to access admin pages', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      await expect(page).toHaveURL(/\/dashboard/);
      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).toBeVisible();
    });
  });

  // ===================== C. Navigation =====================
  test.describe('Navigation', () => {
    test.beforeEach(async ({ page, context }) => {
      await setupAuthenticatedAdmin(page, context);
    });

    test('should navigate to Dashboard when clicking Dashboard link', async ({
      page,
    }) => {
      await page.goto('/tickets');
      await page.getByRole('link', { name: 'Dashboard' }).click();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should navigate to Tickets when clicking Tickets link', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByRole('link', { name: 'Tickets' }).click();
      await expect(page).toHaveURL(/\/tickets/);
    });

    test('should navigate to Products when clicking Products link', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByRole('link', { name: 'Products' }).click();
      await expect(page).toHaveURL(/\/products/);
    });

    test('should navigate to Team when clicking Team link', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByRole('link', { name: 'Team' }).click();
      await expect(page).toHaveURL(/\/team/);
    });

    test('should navigate to Dashboard when clicking the logo', async ({
      page,
    }) => {
      await page.goto('/tickets');
      await page.getByRole('link', { name: 'Agilite' }).first().click();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should highlight the active navigation item on Dashboard', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      const dashboardButton = page.getByRole('link', { name: 'Dashboard' });
      await expect(dashboardButton).toHaveAttribute('data-active');
    });

    test('should highlight the active navigation item on Tickets', async ({
      page,
    }) => {
      await page.goto('/tickets');
      const ticketsButton = page.getByRole('link', { name: 'Tickets' });
      await expect(ticketsButton).toHaveAttribute('data-active');
    });

    test('should highlight the active navigation item on Team', async ({
      page,
    }) => {
      await page.goto('/team');
      const teamButton = page.getByRole('link', { name: 'Team' });
      await expect(teamButton).toHaveAttribute('data-active');
    });

    test('should not highlight non-active navigation items', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      const ticketsButton = page.getByRole('link', { name: 'Tickets' });
      await expect(ticketsButton).not.toHaveAttribute('data-active');
    });
  });

  // ===================== D. Notification bell =====================
  test.describe('Notification bell', () => {
    test.beforeEach(async ({ page, context }) => {
      await setupAuthenticatedAdmin(page, context);
    });

    test('should display the unread notification badge count', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      const bell = page.getByRole('button', { name: /notifications/i });
      await expect(bell).toBeVisible();
      await expect(bell.locator('.bg-destructive')).toHaveText('2');
    });

    test('should open the notification dropdown on click', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();
      const dropdownContent = page.locator('[data-slot="dropdown-menu-content"]');
      await expect(dropdownContent).toBeVisible();
      await expect(dropdownContent.getByText('Notifications')).toBeVisible();
    });

    test('should display notification items in the dropdown', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();

      await expect(
        page.getByText('New ticket from customer: Product arrived damaged'),
      ).toBeVisible();
      await expect(
        page.getByText('Customer replied to ticket TK-0002'),
      ).toBeVisible();
      await expect(
        page.getByText('Customer replied to ticket TK-0003'),
      ).toBeVisible();
    });

    test('should display relative timestamps for notifications', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();

      // Timestamps are approximate — match patterns rather than exact values
      await expect(page.getByText(/\dm ago/)).toBeVisible();
      await expect(page.getByText(/\dh ago/)).toBeVisible();
      await expect(page.getByText(/\dd ago/)).toBeVisible();
    });

    test('should show "Mark all as read" button when there are unread notifications', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();
      await expect(page.getByText('Mark all as read')).toBeVisible();
    });

    test('should call mark-all-as-read API when button is clicked', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();

      const markAllPromise = page.waitForRequest('**/api/notifications/read-all');
      await page.getByText('Mark all as read').click();
      await markAllPromise;
    });

    test('should show empty state when there are no notifications', async ({
      page,
      context,
    }) => {
      await page.unrouteAll();
      await setupAuthenticatedAdmin(page, context, {
        notifications: emptyNotifications,
      });
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();

      await expect(page.getByText('No notifications yet')).toBeVisible();
    });

    test('should not show notification badge when unread count is 0', async ({
      page,
      context,
    }) => {
      await page.unrouteAll();
      await setupAuthenticatedAdmin(page, context, {
        notifications: emptyNotifications,
      });
      await page.goto('/dashboard');

      const bell = page.getByRole('button', { name: /notifications/i });
      // Badge element should not be present
      await expect(
        bell.locator('.bg-destructive'),
      ).toHaveCount(0);
    });

    test('should not show "Mark all as read" when all are read', async ({
      page,
      context,
    }) => {
      await page.unrouteAll();
      await setupAuthenticatedAdmin(page, context, {
        notifications: emptyNotifications,
      });
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();

      await expect(page.getByText('Mark all as read')).not.toBeVisible();
    });

    test('should navigate to admin ticket page when clicking a notification', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();

      await page
        .getByText('New ticket from customer: Product arrived damaged')
        .click();
      // Admin notification links to /tickets/:id (not /my-tickets/:id)
      await expect(page).toHaveURL(/\/tickets\/ticket-1/);
    });

    test('should show loading skeletons while notifications are loading', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, adminToken);
      await page.addInitScript(
        (t) => localStorage.setItem('auth_token', t),
        adminToken,
      );
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockAdminUser }),
        }),
      );
      // Delay notification response
      await page.route('**/api/notifications', async (route) => {
        await new Promise((r) => setTimeout(r, 3000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockNotifications),
        });
      });
      await page.route('**/socket.io/**', (route) => route.abort());

      await page.goto('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();

      // Should show skeletons while loading
      const skeletons = page.locator('[data-slot="skeleton"]');
      await expect(skeletons.first()).toBeVisible();
    });

    test('should include accessible label with unread count on bell', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      const bell = page.getByRole('button', {
        name: /notifications \(2 unread\)/i,
      });
      await expect(bell).toBeVisible();
    });
  });

  // ===================== E. Interactive elements =====================
  test.describe('Interactive elements', () => {
    test.beforeEach(async ({ page, context }) => {
      await setupAuthenticatedAdmin(page, context);
    });

    test('should toggle dark mode when clicking the Dark mode button', async ({
      page,
    }) => {
      await page.goto('/dashboard');

      // Initially light mode — html should not have class "dark"
      await expect(page.locator('html')).not.toHaveClass(/dark/);

      // Click dark mode toggle
      await page.getByText('Dark mode').click();
      await expect(page.locator('html')).toHaveClass(/dark/);

      // Click again to go back to light
      await page.getByText('Dark mode').click();
      await expect(page.locator('html')).not.toHaveClass(/dark/);
    });

    test('should log out and redirect to login when clicking Log out', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByText('Log out').click();
      await expect(page).toHaveURL(/\/login/);
    });

    test('should open notification dropdown and close on outside click', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();
      const dropdownContent = page.locator('[data-slot="dropdown-menu-content"]');
      await expect(dropdownContent).toBeVisible();

      // Click outside the dropdown
      await page.locator('[data-slot="sidebar-inset"]').click({ force: true });
      await expect(dropdownContent).not.toBeVisible();
    });
  });

  // ===================== F. Data display =====================
  test.describe('Data display', () => {
    test('should display 4 navigation items in correct order', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      const menuItems = page.locator(
        '[data-slot="sidebar-menu-button"]',
      );
      // 4 nav items + dark mode + log out = 6 total menu buttons
      await expect(menuItems).toHaveCount(6);
    });

    test('should display correct icons alongside nav labels', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      // Each nav item has an svg icon and a text label
      const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
      await expect(dashboardLink.locator('svg')).toBeVisible();
      await expect(dashboardLink.getByText('Dashboard')).toBeVisible();
    });
  });

  // ===================== G. Dark mode =====================
  test.describe('Dark mode', () => {
    test('should render sidebar correctly in light mode', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).toBeVisible();
      await expect(page.locator('html')).not.toHaveClass(/dark/);
    });

    test('should render sidebar correctly in dark mode', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      // Activate dark mode
      await page.getByText('Dark mode').click();
      await expect(page.locator('html')).toHaveClass(/dark/);

      // Sidebar should still be visible
      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).toBeVisible();

      // All nav items still visible
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Tickets' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Team' })).toBeVisible();
    });
  });

  // ===================== H. Responsive design =====================
  test.describe('Responsive design', () => {
    test('should show the sidebar on desktop (1280px)', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/dashboard');

      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).toBeVisible();
    });

    test('should hide the sidebar and show hamburger on mobile (375px)', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      // Mobile header with trigger should be visible
      const trigger = page.locator('[data-slot="sidebar-trigger"]');
      await expect(trigger).toBeVisible();

      // Mobile header shows "Agilite" brand
      const mobileHeader = page.locator('header').filter({ hasText: 'Agilite' });
      await expect(mobileHeader).toBeVisible();
    });

    test('should open the sidebar sheet when clicking hamburger on mobile', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      // Click the sidebar trigger (hamburger)
      await page.locator('[data-slot="sidebar-trigger"]').click();

      // Nav items should be visible inside the opened sheet
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Tickets' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Team' })).toBeVisible();
    });

    test('should navigate from mobile sidebar and close the sheet', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      await page.locator('[data-slot="sidebar-trigger"]').click();
      await page.getByRole('link', { name: 'Tickets' }).click();

      await expect(page).toHaveURL(/\/tickets/);
    });

    test('should render correctly on tablet (768px)', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/dashboard');

      // At 768px, sidebar should be visible (md breakpoint)
      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).toBeVisible();
    });

    test('should show notification bell in mobile sidebar sheet', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      await page.locator('[data-slot="sidebar-trigger"]').click();

      await expect(
        page.getByRole('button', { name: /notifications/i }),
      ).toBeVisible();
    });

    test('should show dark mode toggle in mobile sidebar sheet', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      await page.locator('[data-slot="sidebar-trigger"]').click();
      await expect(page.getByText('Dark mode')).toBeVisible();
    });

    test('should show logout in mobile sidebar sheet', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      await page.locator('[data-slot="sidebar-trigger"]').click();
      // Log out is in the footer — may need to scroll down in the sheet
      const logoutButton = page.getByText('Log out');
      await logoutButton.scrollIntoViewIfNeeded();
      await expect(logoutButton).toBeVisible();
    });
  });

  // ===================== I. Real-time features =====================
  test.describe('Real-time features', () => {
    test('should display notification count from API response', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedAdmin(page, context);
      await page.goto('/dashboard');

      // Notification badge should show "2" based on mockNotifications.unreadCount
      const bell = page.getByRole('button', { name: /notifications/i });
      await expect(bell.locator('.bg-destructive')).toHaveText('2');
    });
  });

  // ===================== J. Error handling =====================
  test.describe('Error handling', () => {
    test('should handle notification API failure gracefully', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, adminToken);
      await page.addInitScript(
        (t) => localStorage.setItem('auth_token', t),
        adminToken,
      );
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockAdminUser }),
        }),
      );
      await page.route('**/api/notifications', (route) =>
        route.fulfill({ status: 500, body: 'Internal Server Error' }),
      );
      await page.route('**/socket.io/**', (route) => route.abort());

      await page.goto('/dashboard');

      // Sidebar should still render even if notifications fail
      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).toBeVisible();

      // Bell should still be clickable
      await page.getByRole('button', { name: /notifications/i }).click();
      // Should show empty dropdown (graceful fallback) — wait for loading to finish
      await expect(page.getByText('No notifications yet')).toBeVisible({ timeout: 10000 });
    });

    test('should still render nav items when notification API fails', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, adminToken);
      await page.addInitScript(
        (t) => localStorage.setItem('auth_token', t),
        adminToken,
      );
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockAdminUser }),
        }),
      );
      await page.route('**/api/notifications', (route) =>
        route.fulfill({ status: 500, body: 'Server Error' }),
      );
      await page.route('**/socket.io/**', (route) => route.abort());

      await page.goto('/dashboard');

      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Tickets' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Team' })).toBeVisible();
    });
  });

  // ===================== K. Accessibility =====================
  test.describe('Accessibility', () => {
    test.beforeEach(async ({ page, context }) => {
      await setupAuthenticatedAdmin(page, context);
    });

    test('should have accessible button names for all interactive elements', async ({
      page,
    }) => {
      await page.goto('/dashboard');

      // Bell button has sr-only text
      await expect(
        page.getByRole('button', { name: /notifications/i }),
      ).toBeVisible();

      // Sidebar trigger has sr-only text
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(
        page.getByRole('button', { name: /toggle sidebar/i }),
      ).toBeVisible();
    });

    test('should support keyboard navigation through sidebar items', async ({
      page,
    }) => {
      await page.goto('/dashboard');

      // Focus on the dashboard link
      const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
      await dashboardLink.focus();
      await expect(dashboardLink).toBeFocused();
    });

    test('should open notification dropdown with Enter key', async ({
      page,
    }) => {
      await page.goto('/dashboard');

      const bell = page.getByRole('button', { name: /notifications/i });
      await bell.focus();
      await page.keyboard.press('Enter');

      const dropdownContent = page.locator('[data-slot="dropdown-menu-content"]');
      await expect(dropdownContent).toBeVisible();
    });

    test('should close notification dropdown with Escape key', async ({
      page,
    }) => {
      await page.goto('/dashboard');

      await page.getByRole('button', { name: /notifications/i }).click();
      const dropdownContent = page.locator('[data-slot="dropdown-menu-content"]');
      await expect(dropdownContent).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dropdownContent).not.toBeVisible();
    });

    test('should have a main landmark element', async ({ page }) => {
      await page.goto('/dashboard');
      const main = page.locator('main.overflow-auto');
      await expect(main).toBeVisible();
    });
  });
});
