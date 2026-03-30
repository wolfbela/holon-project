import { test, expect, type BrowserContext, type Page } from '@playwright/test';

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

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockNotifications = {
  data: [
    {
      id: 'notif-1',
      user_id: 'cust-1',
      type: 'new_reply',
      ticket_id: 'ticket-1',
      message: 'New reply on ticket TK-0001',
      read: false,
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-2',
      user_id: 'cust-1',
      type: 'ticket_closed',
      ticket_id: 'ticket-2',
      message: 'Your ticket TK-0002 has been closed',
      read: false,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-3',
      user_id: 'cust-1',
      type: 'new_reply',
      ticket_id: 'ticket-3',
      message: 'New reply on ticket TK-0003 from Support Agent',
      read: true,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  unreadCount: 2,
};

const emptyNotifications = {
  data: [],
  unreadCount: 0,
};

const mockUser = {
  id: 'cust-1',
  email: 'customer1@example.com',
  name: 'John Doe',
  role: 'customer',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helper to set up a fully authenticated customer page with mocked APIs.
// Sets cookie (middleware), localStorage (auth context), and all API mocks.
// ---------------------------------------------------------------------------

async function setupAuthenticatedPage(
  page: Page,
  context: BrowserContext,
  options?: {
    notifications?: typeof mockNotifications;
    token?: string;
  },
) {
  const notifData = options?.notifications ?? mockNotifications;
  const token = options?.token ?? customerToken;

  // Cookie for Next.js middleware routing
  await setAuthCookie(context, token);

  // localStorage for client-side AuthProvider hydration
  await page.addInitScript(
    (t: string) => {
      localStorage.setItem('auth_token', t);
    },
    token,
  );

  // Mock API endpoints
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: mockUser }),
    });
  });

  await page.route('**/api/notifications', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(notifData),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/notifications/read-all', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'All notifications marked as read' }),
    });
  });

  await page.route('**/api/notifications/*/read', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...notifData.data[0], read: true }),
    });
  });

  // Block socket.io to prevent connection errors in tests
  await page.route('**/socket.io/**', async (route) => {
    await route.abort();
  });
}

// ===================================================================
// CUSTOMER NAVBAR — visible on /products, /my-tickets
// ===================================================================

test.describe('Customer navbar', () => {
  // -----------------------------------------------------------------
  // A. Page loads correctly
  // -----------------------------------------------------------------

  test.describe('Page loads', () => {
    test('should render navbar with logo on products page', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await expect(
        page.getByRole('navigation', { name: /customer navigation/i }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: /agilite/i })).toBeVisible();
    });

    test('should render navbar with logo on my-tickets page', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await expect(
        page.getByRole('navigation', { name: /customer navigation/i }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: /agilite/i })).toBeVisible();
    });

    test('should render Products and My Tickets nav links', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/products');

      await expect(
        page.getByRole('link', { name: /^products$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: /my tickets/i }),
      ).toBeVisible();
    });

    test('should render notification bell button', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await expect(
        page.getByRole('button', { name: /notifications/i }),
      ).toBeVisible();
    });

    test('should render user avatar with initials', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await expect(page.locator('[data-slot="avatar"]')).toBeVisible();
      await expect(
        page.locator('[data-slot="avatar-fallback"]'),
      ).toContainText('JD');
    });

    test('should render skip-to-content link', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      const skipLink = page.getByRole('link', { name: /skip to content/i });
      await expect(skipLink).toBeAttached();
    });

    test('should have sticky header with backdrop blur', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      const header = page.locator('header');
      await expect(header).toHaveClass(/sticky/);
      await expect(header).toHaveClass(/backdrop-blur/);
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  test.describe('Authentication', () => {
    test('should redirect unauthenticated user to login from /products', async ({
      page,
    }) => {
      await page.goto('/products');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated user to login from /my-tickets', async ({
      page,
    }) => {
      await page.goto('/my-tickets');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should not show customer navbar for admin users', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, adminToken);
      await page.goto('/dashboard');

      await expect(
        page.getByRole('navigation', { name: /customer navigation/i }),
      ).not.toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // C. Navigation
  // -----------------------------------------------------------------

  test.describe('Navigation', () => {
    test('should navigate to /products when clicking logo', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await page.getByRole('link', { name: /agilite/i }).click();
      await expect(page).toHaveURL(/\/products/);
    });

    test('should navigate to /products when clicking Products link', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/my-tickets');

      await page.getByRole('link', { name: /^products$/i }).click();
      await expect(page).toHaveURL(/\/products/);
    });

    test('should navigate to /my-tickets when clicking My Tickets link', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/products');

      await page.getByRole('link', { name: /my tickets/i }).click();
      await expect(page).toHaveURL(/\/my-tickets/);
    });

    test('should highlight Products link as active on /products', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/products');

      const productsLink = page.getByRole('link', { name: /^products$/i });
      await expect(productsLink).toHaveClass(/font-medium/);
      await expect(productsLink).toHaveClass(/bg-accent/);
    });

    test('should highlight My Tickets link as active on /my-tickets', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/my-tickets');

      const ticketsLink = page.getByRole('link', { name: /my tickets/i });
      await expect(ticketsLink).toHaveClass(/font-medium/);
      await expect(ticketsLink).toHaveClass(/bg-accent/);
    });

    test('should not highlight inactive nav links', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/products');

      const ticketsLink = page.getByRole('link', { name: /my tickets/i });
      await expect(ticketsLink).not.toHaveClass(/font-medium/);
    });
  });

  // -----------------------------------------------------------------
  // E. Interactive elements — Notification bell
  // -----------------------------------------------------------------

  test.describe('Notification bell', () => {
    test('should show unread count badge when there are unread notifications', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      const badge = page.locator('.bg-destructive');
      await expect(badge).toBeVisible();
      await expect(badge).toContainText('2');
    });

    test('should not show badge when there are no unread notifications', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        notifications: emptyNotifications,
      });
      await page.goto('/products');

      await expect(page.locator('.bg-destructive')).not.toBeVisible();
    });

    test('should open notification dropdown when bell is clicked', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.getByRole('button', { name: /notifications/i }).click();

      // The dropdown menu should be visible with notification content
      await expect(page.getByRole('menu')).toBeVisible();
    });

    test('should display notification items in dropdown', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.getByRole('button', { name: /notifications/i }).click();
      await expect(
        page.getByText(/new reply on ticket tk-0001/i),
      ).toBeVisible();
      await expect(
        page.getByText(/your ticket tk-0002 has been closed/i),
      ).toBeVisible();
      await expect(
        page.getByText(/new reply on ticket tk-0003/i),
      ).toBeVisible();
    });

    test('should show relative timestamps for notifications', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.getByRole('button', { name: /notifications/i }).click();
      await expect(page.getByText(/5m ago/)).toBeVisible();
      await expect(page.getByText(/2h ago/)).toBeVisible();
      await expect(page.getByText(/1d ago/)).toBeVisible();
    });

    test('should show "Mark all as read" button when unread notifications exist', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.getByRole('button', { name: /notifications/i }).click();
      await expect(
        page.getByRole('button', { name: /mark all as read/i }),
      ).toBeVisible();
    });

    test('should not show "Mark all as read" when no unread notifications', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        notifications: {
          data: [{ ...mockNotifications.data[2] }],
          unreadCount: 0,
        },
      });
      await page.goto('/products');

      await page.getByRole('button', { name: /notifications/i }).click();
      await expect(
        page.getByRole('button', { name: /mark all as read/i }),
      ).not.toBeVisible();
    });

    test('should call mark-all-as-read API when button is clicked', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.getByRole('button', { name: /notifications/i }).click();

      const markAllRequest = page.waitForRequest(
        (req) =>
          req.url().includes('/notifications/read-all') &&
          req.method() === 'PUT',
      );

      await page.getByRole('button', { name: /mark all as read/i }).click();
      await markAllRequest;
    });

    test('should show empty state when no notifications', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        notifications: emptyNotifications,
      });
      await page.goto('/products');

      await page.getByRole('button', { name: /notifications/i }).click();
      await expect(page.getByText(/no notifications yet/i)).toBeVisible();
    });

    test('should show loading skeletons while fetching notifications', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, customerToken);
      await page.addInitScript(
        (t: string) => localStorage.setItem('auth_token', t),
        customerToken,
      );

      await page.route('**/api/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockUser }),
        });
      });

      // Delay notification response to observe loading state
      await page.route('**/api/notifications', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockNotifications),
        });
      });

      await page.route('**/socket.io/**', async (route) => route.abort());

      await page.goto('/products');
      await page.getByRole('button', { name: /notifications/i }).click();

      await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible();
    });

    test('should navigate to ticket when notification is clicked', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.getByRole('button', { name: /notifications/i }).click();
      await page.getByText(/new reply on ticket tk-0001/i).click();

      await expect(page).toHaveURL(/\/my-tickets\/ticket-1/);
    });

    test('should visually distinguish unread from read notifications', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.getByRole('button', { name: /notifications/i }).click();

      // Unread notification: the <p> containing the message should be font-medium
      const unreadP = page.locator('p', {
        hasText: /new reply on ticket tk-0001/i,
      });
      await expect(unreadP).toHaveClass(/font-medium/);

      // Read notification: should NOT be font-medium
      const readP = page.locator('p', {
        hasText: /new reply on ticket tk-0003/i,
      });
      await expect(readP).not.toHaveClass(/font-medium/);
    });

    test('should show accessible label with unread count', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      const bellButton = page.getByRole('button', {
        name: /notifications \(2 unread\)/i,
      });
      await expect(bellButton).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // E. Interactive elements — User menu
  // -----------------------------------------------------------------

  test.describe('User menu', () => {
    test('should open user dropdown when avatar is clicked', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.locator('[data-slot="avatar"]').click();
      await expect(page.getByText('John Doe')).toBeVisible();
      await expect(page.getByText('customer1@example.com')).toBeVisible();
    });

    test('should show dark mode toggle in user menu', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.locator('[data-slot="avatar"]').click();
      await expect(page.getByText(/dark mode/i)).toBeVisible();
    });

    test('should show logout option in user menu', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.locator('[data-slot="avatar"]').click();
      await expect(page.getByText(/log out/i)).toBeVisible();
    });

    test('should redirect to /login when logout is clicked', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.locator('[data-slot="avatar"]').click();
      await page.getByText(/log out/i).click();

      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('should display user initials in avatar fallback', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await expect(
        page.locator('[data-slot="avatar-fallback"]'),
      ).toContainText('JD');
    });
  });

  // -----------------------------------------------------------------
  // G. Dark mode
  // -----------------------------------------------------------------

  test.describe('Dark mode', () => {
    test('should render navbar correctly in light mode', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/products');

      await expect(
        page.getByRole('navigation', { name: /customer navigation/i }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: /agilite/i })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /notifications/i }),
      ).toBeVisible();
    });

    test('should render navbar correctly in dark mode', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/products');

      await expect(
        page.getByRole('navigation', { name: /customer navigation/i }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: /agilite/i })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /notifications/i }),
      ).toBeVisible();
    });

    test('should toggle dark mode from user menu', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/products');

      await page.locator('[data-slot="avatar"]').click();
      await page.getByText(/dark mode/i).click();

      await expect(page.locator('html')).toHaveClass(/dark/);
    });
  });

  // -----------------------------------------------------------------
  // H. Responsive design
  // -----------------------------------------------------------------

  test.describe('Responsive design', () => {
    test('should show nav links on desktop', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/products');

      await expect(
        page.getByRole('link', { name: /^products$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: /my tickets/i }),
      ).toBeVisible();
    });

    test('should hide nav links on mobile', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/products');

      const navLinksContainer = page.locator('.hidden.md\\:flex');
      await expect(navLinksContainer).not.toBeVisible();
    });

    test('should show hamburger menu on mobile', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/products');

      await expect(
        page.getByRole('button', { name: /open menu/i }),
      ).toBeVisible();
    });

    test('should hide hamburger menu on desktop', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/products');

      await expect(
        page.getByRole('button', { name: /open menu/i }),
      ).not.toBeVisible();
    });

    test('should show nav links in mobile menu dropdown', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/products');

      await page.getByRole('button', { name: /open menu/i }).click();
      await expect(
        page.getByRole('menuitem', { name: /products/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: /my tickets/i }),
      ).toBeVisible();
    });

    test('should navigate from mobile menu', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/products');

      await page.getByRole('button', { name: /open menu/i }).click();
      await page.getByRole('menuitem', { name: /my tickets/i }).click();
      await expect(page).toHaveURL(/\/my-tickets/);
    });

    test('should show notification bell on mobile', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/products');

      await expect(
        page.getByRole('button', { name: /notifications/i }),
      ).toBeVisible();
    });

    test('should show user avatar on mobile', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/products');

      await expect(page.locator('[data-slot="avatar"]')).toBeVisible();
    });

    test('should render correctly on tablet', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/products');

      await expect(
        page.getByRole('link', { name: /^products$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: /customer navigation/i }),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // J. Error handling
  // -----------------------------------------------------------------

  test.describe('Error handling', () => {
    test('should handle notification API failure gracefully', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, customerToken);
      await page.addInitScript(
        (t: string) => localStorage.setItem('auth_token', t),
        customerToken,
      );

      await page.route('**/api/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockUser }),
        });
      });

      await page.route('**/api/notifications', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.route('**/socket.io/**', async (route) => route.abort());

      await page.goto('/products');

      await expect(
        page.getByRole('navigation', { name: /customer navigation/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /notifications/i }),
      ).toBeVisible();
    });

    test('should show empty dropdown when notification fetch fails', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, customerToken);
      await page.addInitScript(
        (t: string) => localStorage.setItem('auth_token', t),
        customerToken,
      );

      await page.route('**/api/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockUser }),
        });
      });

      await page.route('**/api/notifications', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.route('**/socket.io/**', async (route) => route.abort());

      await page.goto('/products');
      await page.getByRole('button', { name: /notifications/i }).click();
      await expect(page.getByText(/no notifications yet/i)).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // K. Accessibility
  // -----------------------------------------------------------------

  test.describe('Accessibility', () => {
    test('should have aria-label on navigation element', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      const nav = page.getByRole('navigation', {
        name: /customer navigation/i,
      });
      await expect(nav).toBeVisible();
    });

    test('should have accessible name on notification bell', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      const bell = page.getByRole('button', { name: /notifications/i });
      await expect(bell).toBeVisible();
    });

    test('should have accessible name on mobile menu button', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/products');

      const menuButton = page.getByRole('button', { name: /open menu/i });
      await expect(menuButton).toBeVisible();
    });

    test('skip-to-content link should become visible on focus', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await page.keyboard.press('Tab');
      const skipLink = page.getByRole('link', { name: /skip to content/i });
      await expect(skipLink).toBeVisible();
    });

    test('skip-to-content link should point to #main', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      const skipLink = page.getByRole('link', { name: /skip to content/i });
      await expect(skipLink).toHaveAttribute('href', '#main');
    });

    test('main content should have id="main" for skip link target', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      await expect(page.locator('main#main')).toBeVisible();
    });

    test('notification dropdown should be keyboard navigable', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      // Focus and open with keyboard
      await page.getByRole('button', { name: /notifications/i }).focus();
      await page.keyboard.press('Enter');

      // Dropdown menu should appear
      await expect(page.getByRole('menu').first()).toBeVisible();

      // Escape should close it
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).not.toBeVisible();
    });

    test('user menu should be keyboard navigable', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products');

      // Open avatar menu
      await page.locator('[data-slot="avatar"]').click();
      await expect(page.getByText('John Doe')).toBeVisible();

      // Escape should close
      await page.keyboard.press('Escape');
      await expect(page.getByText('John Doe')).not.toBeVisible();
    });
  });
});
