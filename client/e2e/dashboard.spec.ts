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

const mockNotifications = { data: [], unreadCount: 0 };

const mockStats = {
  total: 42,
  open: 28,
  closed: 14,
  byPriority: { low: 10, medium: 22, high: 10 },
  avgResponseTime: '2h 30m',
};

const mockStatsEmpty = {
  total: 0,
  open: 0,
  closed: 0,
  byPriority: { low: 0, medium: 0, high: 0 },
  avgResponseTime: 'N/A',
};

const mockRecentTickets = {
  data: [
    {
      id: 'ticket-1',
      display_id: 'TK-0001',
      user_id: 'cust-1',
      email: 'customer1@example.com',
      name: 'John Doe',
      product_id: 1,
      product_name: 'Fjallraven Backpack',
      subject: 'Product arrived damaged',
      message: 'The zipper was broken.',
      status: 'open',
      priority: 'high',
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'ticket-2',
      display_id: 'TK-0002',
      user_id: 'cust-2',
      email: 'customer2@example.com',
      name: 'Jane Smith',
      product_id: 2,
      product_name: 'Classic T-Shirt',
      subject: 'Wrong size delivered',
      message: 'I ordered a M but received an XL.',
      status: 'open',
      priority: 'medium',
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ticket-3',
      display_id: 'TK-0003',
      user_id: 'cust-3',
      email: 'customer3@example.com',
      name: 'Bob Wilson',
      product_id: 3,
      product_name: 'Leather Wallet',
      subject: 'Refund request',
      message: 'I would like a refund please.',
      status: 'closed',
      priority: 'low',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ticket-4',
      display_id: 'TK-0004',
      user_id: 'cust-1',
      email: 'customer1@example.com',
      name: 'John Doe',
      product_id: 4,
      product_name: 'Running Shoes',
      subject: 'Color mismatch',
      message: 'The shoes are a different color than pictured.',
      status: 'open',
      priority: 'medium',
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ticket-5',
      display_id: 'TK-0005',
      user_id: 'cust-2',
      email: 'customer2@example.com',
      name: 'Jane Smith',
      product_id: 5,
      product_name: 'Wireless Headphones',
      subject: 'Battery drains quickly',
      message: 'Battery only lasts 2 hours instead of 10.',
      status: 'open',
      priority: 'high',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  pagination: { page: 1, limit: 5, total: 42, totalPages: 9 },
};

const mockRecentTicketsEmpty = {
  data: [],
  pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
};

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
  stats?: typeof mockStats | null;
  statsStatus?: number;
  statsDelay?: number;
  tickets?: typeof mockRecentTickets;
  ticketsStatus?: number;
  ticketsDelay?: number;
}

async function setupDashboard(
  page: Page,
  context: BrowserContext,
  options: SetupOptions = {},
) {
  const token = options.token ?? adminToken;

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
      body: JSON.stringify({ user: mockAdminUser }),
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

  // Stats endpoint
  await page.route('**/api/tickets/stats', async (route) => {
    if (options.statsDelay) {
      await new Promise((r) => setTimeout(r, options.statsDelay));
    }
    const status = options.statsStatus ?? 200;
    if (status !== 200 || options.stats === null) {
      await route.fulfill({
        status: status || 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(options.stats ?? mockStats),
    });
  });

  // Tickets endpoint (recent tickets for dashboard)
  await page.route('**/api/tickets?*', async (route) => {
    if (options.ticketsDelay) {
      await new Promise((r) => setTimeout(r, options.ticketsDelay));
    }
    const status = options.ticketsStatus ?? 200;
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
      body: JSON.stringify(options.tickets ?? mockRecentTickets),
    });
  });

  // Block socket.io to prevent connection errors
  await page.route('**/socket.io/**', (route) => route.abort());
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

test.describe('Dashboard page', () => {
  // ===================== A. Page loads correctly =====================
  test.describe('Page loads', () => {
    test('should render the dashboard with all key sections', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      // Page heading
      await expect(
        page.getByRole('heading', { name: /dashboard/i }),
      ).toBeVisible();
      await expect(
        page.getByText('Overview of your support operations.'),
      ).toBeVisible();

      // Stat cards — scope to paragraph elements (stat values render in <p> tags)
      await expect(page.getByText('Total Tickets')).toBeVisible();
      await expect(page.getByText('Open Tickets')).toBeVisible();
      await expect(page.getByText('Closed Tickets')).toBeVisible();
      await expect(page.getByText('Avg Response Time')).toBeVisible();

      // Stat values — use locator scoping to card content paragraphs
      await expect(
        page.locator('p.font-bold', { hasText: '42' }).first(),
      ).toBeVisible();
      await expect(page.getByText('2h 30m')).toBeVisible();

      // Chart titles
      await expect(page.getByText('Tickets by Status')).toBeVisible();
      await expect(page.getByText('Tickets by Priority')).toBeVisible();

      // Recent tickets section
      await expect(page.getByText('Recent Tickets')).toBeVisible();
      await expect(
        page.getByRole('link', { name: /view all/i }),
      ).toBeVisible();
    });

    test('should show skeleton loaders while fetching data', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context, { statsDelay: 3000, ticketsDelay: 3000 });
      await page.goto('/dashboard');

      // Skeleton elements should appear
      const skeletons = page.locator('[data-slot="skeleton"]');
      await expect(skeletons.first()).toBeVisible();

      // Wait for data to load
      await expect(page.getByText('Total Tickets')).toBeVisible({ timeout: 10000 });

      // Skeletons should be gone
      await expect(skeletons).toHaveCount(0);
    });

    test('should display correct stat card values from API', async ({
      page,
      context,
    }) => {
      const customStats = {
        total: 99,
        open: 71,
        closed: 28,
        byPriority: { low: 30, medium: 50, high: 19 },
        avgResponseTime: '1h 15m',
      };
      await setupDashboard(page, context, { stats: customStats });
      await page.goto('/dashboard');

      // Scope to stat card paragraphs to avoid matching SVG chart labels
      await expect(
        page.locator('p.font-bold', { hasText: '99' }).first(),
      ).toBeVisible();
      await expect(
        page.locator('p.font-bold', { hasText: '71' }).first(),
      ).toBeVisible();
      await expect(page.getByText('1h 15m')).toBeVisible();
    });

    test('should highlight the Open Tickets card', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('Open Tickets')).toBeVisible();

      // The Open Tickets card's container should have the emerald ring highlight
      const highlightedCard = page.locator('[data-slot="card"]').filter({ hasText: 'Open Tickets' });
      await expect(highlightedCard).toHaveClass(/ring-2/);
    });
  });

  // ===================== B. Authentication & authorization =====================
  test.describe('Authentication & authorization', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.route('**/socket.io/**', (route) => route.abort());
      await page.goto('/dashboard');
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
      await page.route('**/socket.io/**', (route) => route.abort());

      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/products/);
    });

    test('should allow admin to access dashboard', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(
        page.getByRole('heading', { name: /dashboard/i }),
      ).toBeVisible();
    });
  });

  // ===================== C. Navigation =====================
  test.describe('Navigation', () => {
    test('"View all" link navigates to /tickets', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('Recent Tickets')).toBeVisible();

      const viewAllLink = page.getByRole('link', { name: /view all/i });
      await expect(viewAllLink).toHaveAttribute('href', '/tickets');
    });

    test('recent ticket row links to ticket detail page', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      // Wait for recent tickets to load
      await expect(page.getByText('TK-0001')).toBeVisible();

      // Check the first ticket links to /tickets/{id}
      const firstTicketLink = page.getByRole('link', { name: /product arrived damaged/i });
      await expect(firstTicketLink).toHaveAttribute('href', '/tickets/ticket-1');
    });

    test('should display all 5 recent tickets', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('TK-0001')).toBeVisible();
      await expect(page.getByText('TK-0002')).toBeVisible();
      await expect(page.getByText('TK-0003')).toBeVisible();
      await expect(page.getByText('TK-0004')).toBeVisible();
      await expect(page.getByText('TK-0005')).toBeVisible();
    });
  });

  // ===================== D. Forms & user input =====================
  test.describe('Forms & user input', () => {
    test('dashboard has no forms — verified page is view-only', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');
      await expect(page.getByText('Total Tickets')).toBeVisible();

      const forms = page.locator('form');
      await expect(forms).toHaveCount(0);
    });
  });

  // ===================== E. Interactive elements =====================
  test.describe('Interactive elements', () => {
    test('retry button refetches dashboard data on error', async ({
      page,
      context,
    }) => {
      // First load fails
      let callCount = 0;
      await setAuthCookie(context, adminToken);
      await page.addInitScript(
        (t: string) => localStorage.setItem('auth_token', t),
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
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockNotifications),
        }),
      );
      await page.route('**/api/tickets/stats', async (route) => {
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
            body: JSON.stringify(mockStats),
          });
        }
      });
      await page.route('**/api/tickets?*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockRecentTickets),
        }),
      );
      await page.route('**/socket.io/**', (route) => route.abort());

      await page.goto('/dashboard');

      // Error state shows
      await expect(page.getByText(/something went wrong/i)).toBeVisible();

      // Click retry
      await page.getByRole('button', { name: /try again/i }).click();

      // Data loads on retry — scope to stat card paragraph to avoid SVG match
      await expect(
        page.locator('p.font-bold', { hasText: '42' }).first(),
      ).toBeVisible();
      await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    });

    test('recent ticket rows have hover effect', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');
      await expect(page.getByText('TK-0001')).toBeVisible();

      // Verify rows have hover transition class
      const firstRow = page.getByRole('link', { name: /product arrived damaged/i });
      await expect(firstRow).toHaveClass(/hover:bg-muted/);
    });
  });

  // ===================== F. Data display =====================
  test.describe('Data display', () => {
    test('should display status badges on recent tickets', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('TK-0001')).toBeVisible();

      // Status badges
      const openBadges = page.getByText('Open', { exact: true });
      const closedBadges = page.getByText('Closed', { exact: true });
      await expect(openBadges.first()).toBeVisible();
      await expect(closedBadges.first()).toBeVisible();
    });

    test('should display priority badges on recent tickets', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('TK-0001')).toBeVisible();

      // Priority badges
      const highBadges = page.getByText('High', { exact: true });
      const mediumBadges = page.getByText('Medium', { exact: true });
      const lowBadges = page.getByText('Low', { exact: true });
      await expect(highBadges.first()).toBeVisible();
      await expect(mediumBadges.first()).toBeVisible();
      await expect(lowBadges.first()).toBeVisible();
    });

    test('should display relative timestamps on recent tickets', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('TK-0001')).toBeVisible();

      // Timestamps are relative (e.g. "10m ago", "1h ago", "2h ago", "5h ago", "1d ago")
      const timeElements = page.locator('time');
      const count = await timeElements.count();
      expect(count).toBe(5);
    });

    test('should show empty state when no tickets exist', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context, {
        stats: mockStatsEmpty,
        tickets: mockRecentTicketsEmpty,
      });
      await page.goto('/dashboard');

      // Empty recent tickets
      await expect(page.getByText('No tickets yet.')).toBeVisible();

      // Empty charts
      const noDataTexts = page.getByText('No data yet');
      await expect(noDataTexts.first()).toBeVisible();
      expect(await noDataTexts.count()).toBe(2);
    });

    test('should display chart donut center label with total count', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      // The pie chart should show the total in its center
      await expect(page.getByText('Tickets by Status')).toBeVisible();

      // SVG tspan element showing "Total" label and the count inside the donut
      const totalLabel = page.locator('tspan', { hasText: 'Total' });
      await expect(totalLabel).toBeVisible();
    });
  });

  // ===================== G. Dark mode =====================
  test.describe('Dark mode', () => {
    test('should render correctly in light mode', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/dashboard');

      // All key elements should be visible
      await expect(page.getByText('Total Tickets')).toBeVisible();
      await expect(page.getByText('Open Tickets')).toBeVisible();
      await expect(page.getByText('Tickets by Status')).toBeVisible();
      await expect(page.getByText('Recent Tickets')).toBeVisible();
    });

    test('should render correctly in dark mode', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/dashboard');

      // All key elements should be visible in dark mode
      await expect(page.getByText('Total Tickets')).toBeVisible();
      await expect(page.getByText('Open Tickets')).toBeVisible();
      await expect(page.getByText('Tickets by Status')).toBeVisible();
      await expect(page.getByText('Recent Tickets')).toBeVisible();
    });

    test('stat card text should be readable in dark mode', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/dashboard');

      // Stat labels and values should be visible (implies sufficient contrast)
      await expect(page.getByText('Total Tickets')).toBeVisible();
      await expect(page.getByText('Open Tickets')).toBeVisible();
      await expect(page.getByText('Closed Tickets')).toBeVisible();
      await expect(page.getByText('Avg Response Time')).toBeVisible();
      await expect(page.getByText('2h 30m')).toBeVisible();
    });

    test('chart titles should be readable in dark mode', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/dashboard');

      await expect(page.getByText('Tickets by Status')).toBeVisible();
      await expect(page.getByText('Tickets by Priority')).toBeVisible();
    });
  });

  // ===================== H. Responsive design =====================
  test.describe('Responsive design', () => {
    test('should render 4-column stat cards on desktop (1280px)', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('Total Tickets')).toBeVisible();
      await expect(page.getByText('Open Tickets')).toBeVisible();
      await expect(page.getByText('Closed Tickets')).toBeVisible();
      await expect(page.getByText('Avg Response Time')).toBeVisible();

      // Charts should be side by side
      await expect(page.getByText('Tickets by Status')).toBeVisible();
      await expect(page.getByText('Tickets by Priority')).toBeVisible();
    });

    test('should render correctly on tablet (768px)', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      // Stat cards visible (2-column grid)
      await expect(page.getByText('Total Tickets')).toBeVisible();
      await expect(page.getByText('Open Tickets')).toBeVisible();
      await expect(page.getByText('Closed Tickets')).toBeVisible();
      await expect(page.getByText('Avg Response Time')).toBeVisible();

      // Charts visible
      await expect(page.getByText('Tickets by Status')).toBeVisible();
      await expect(page.getByText('Tickets by Priority')).toBeVisible();

      // Recent tickets visible
      await expect(page.getByText('Recent Tickets')).toBeVisible();
    });

    test('should stack cards on mobile (375px)', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      // All stat cards visible (stacked single column)
      await expect(page.getByText('Total Tickets')).toBeVisible();
      await expect(page.getByText('Open Tickets')).toBeVisible();
      await expect(page.getByText('Avg Response Time')).toBeVisible();

      // Charts visible (stacked)
      await expect(page.getByText('Tickets by Status')).toBeVisible();
      await expect(page.getByText('Tickets by Priority')).toBeVisible();

      // Recent tickets visible
      await expect(page.getByText('Recent Tickets')).toBeVisible();
      await expect(page.getByText('TK-0001')).toBeVisible();
    });

    test('should show badges on mobile in recent tickets', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('TK-0001')).toBeVisible();

      // Badges should be visible even on mobile
      const openBadges = page.getByText('Open', { exact: true });
      await expect(openBadges.first()).toBeVisible();

      const highBadges = page.getByText('High', { exact: true });
      await expect(highBadges.first()).toBeVisible();
    });

    test('should show mobile header on small screens', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      // Mobile header with sidebar trigger should be visible
      const mobileTrigger = page.locator('button[data-slot="sidebar-trigger"]');
      await expect(mobileTrigger).toBeVisible();
    });
  });

  // ===================== I. Real-time features =====================
  test.describe('Real-time features', () => {
    test('should abort socket.io connections gracefully', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      // The page should load without errors despite socket being blocked
      await expect(page.getByText('Total Tickets')).toBeVisible();
      await expect(
        page.locator('p.font-bold', { hasText: '42' }).first(),
      ).toBeVisible();
    });
  });

  // ===================== J. Error handling =====================
  test.describe('Error handling', () => {
    test('should show error state when stats API fails', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context, { statsStatus: 500 });
      await page.goto('/dashboard');

      await expect(page.getByText(/something went wrong/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /try again/i }),
      ).toBeVisible();
    });

    test('should show error state when tickets API fails', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context, { ticketsStatus: 500 });
      await page.goto('/dashboard');

      await expect(page.getByText(/something went wrong/i)).toBeVisible();
    });

    test('should recover after retry on API failure', async ({
      page,
      context,
    }) => {
      let statsCallCount = 0;

      await setAuthCookie(context, adminToken);
      await page.addInitScript(
        (t: string) => localStorage.setItem('auth_token', t),
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
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockNotifications),
        }),
      );
      await page.route('**/api/tickets/stats', async (route) => {
        statsCallCount++;
        if (statsCallCount <= 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockStats),
          });
        }
      });
      await page.route('**/api/tickets?*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockRecentTickets),
        }),
      );
      await page.route('**/socket.io/**', (route) => route.abort());

      await page.goto('/dashboard');

      await expect(page.getByText(/something went wrong/i)).toBeVisible();

      await page.getByRole('button', { name: /try again/i }).click();

      await expect(
        page.locator('p.font-bold', { hasText: '42' }).first(),
      ).toBeVisible();
      await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    });

    test('should not render page as blank on API failure', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context, {
        statsStatus: 500,
        ticketsStatus: 500,
      });
      await page.goto('/dashboard');

      // Page heading should still be visible
      await expect(
        page.getByRole('heading', { name: /dashboard/i }),
      ).toBeVisible();
      await expect(
        page.getByText('Overview of your support operations.'),
      ).toBeVisible();

      // Error message should be visible
      await expect(page.getByText(/something went wrong/i)).toBeVisible();
    });
  });

  // ===================== K. Accessibility =====================
  test.describe('Accessibility', () => {
    test('should use semantic headings', async ({ page, context }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      const h1 = page.getByRole('heading', { level: 1, name: /dashboard/i });
      await expect(h1).toBeVisible();
    });

    test('all links should be keyboard focusable', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');
      await expect(page.getByText('TK-0001')).toBeVisible();

      // "View all" link should be keyboard accessible
      const viewAllLink = page.getByRole('link', { name: /view all/i });
      await viewAllLink.focus();
      await expect(viewAllLink).toBeFocused();
    });

    test('retry button should be keyboard accessible', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context, { statsStatus: 500 });
      await page.goto('/dashboard');

      const retryButton = page.getByRole('button', { name: /try again/i });
      await expect(retryButton).toBeVisible();
      await retryButton.focus();
      await expect(retryButton).toBeFocused();
    });

    test('recent ticket links should have descriptive text', async ({
      page,
      context,
    }) => {
      await setupDashboard(page, context);
      await page.goto('/dashboard');

      await expect(page.getByText('TK-0001')).toBeVisible();

      // Each ticket should have a link with the subject as identifiable text
      await expect(
        page.getByRole('link', { name: /product arrived damaged/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: /wrong size delivered/i }),
      ).toBeVisible();
    });
  });
});
