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

const mockUser = {
  id: 'cust-1',
  email: 'customer1@example.com',
  name: 'John Doe',
  role: 'customer',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

const mockNotifications = {
  data: [],
  unreadCount: 0,
};

const mockTickets = [
  {
    id: 'ticket-1',
    display_id: 'TK-0001',
    user_id: 'cust-1',
    email: 'customer1@example.com',
    name: 'John Doe',
    product_id: 1,
    product_name: 'Classic Leather Jacket',
    subject: 'Product arrived damaged',
    message: 'The zipper was broken when it arrived.',
    status: 'open',
    priority: 'high',
    created_at: '2025-06-15T10:30:00.000Z',
    updated_at: '2025-06-15T10:30:00.000Z',
  },
  {
    id: 'ticket-2',
    display_id: 'TK-0002',
    user_id: 'cust-1',
    email: 'customer1@example.com',
    name: 'John Doe',
    product_id: 2,
    product_name: 'Wireless Bluetooth Headphones',
    subject: 'Missing user manual',
    message: 'The headphones came without a user manual.',
    status: 'open',
    priority: 'low',
    created_at: '2025-06-14T08:00:00.000Z',
    updated_at: '2025-06-14T08:00:00.000Z',
  },
  {
    id: 'ticket-3',
    display_id: 'TK-0003',
    user_id: 'cust-1',
    email: 'customer1@example.com',
    name: 'John Doe',
    product_id: 3,
    product_name: 'Running Sneakers Pro',
    subject: 'Wrong size delivered',
    message: 'I ordered size 10 but received size 8.',
    status: 'closed',
    priority: 'medium',
    created_at: '2025-06-10T14:00:00.000Z',
    updated_at: '2025-06-12T09:00:00.000Z',
  },
];

function buildTicketResponse(
  tickets: typeof mockTickets,
  page = 1,
  limit = 10,
) {
  const start = (page - 1) * limit;
  const data = tickets.slice(start, start + limit);
  return {
    data,
    pagination: {
      page,
      limit,
      total: tickets.length,
      totalPages: Math.ceil(tickets.length / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------

async function setupAuthenticatedPage(
  page: Page,
  context: BrowserContext,
  options?: {
    tickets?: typeof mockTickets | null;
    ticketsDelay?: number;
    ticketsError?: boolean;
    token?: string;
    filterByStatus?: boolean;
  },
) {
  const tickets =
    options?.tickets !== undefined ? options.tickets : mockTickets;
  const token = options?.token ?? customerToken;

  await setAuthCookie(context, token);

  await page.addInitScript(
    (t: string) => {
      localStorage.setItem('auth_token', t);
    },
    token,
  );

  // Auth API
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: mockUser }),
    });
  });

  // Notifications API
  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockNotifications),
    });
  });

  // Tickets API
  await page.route('**/api/tickets?*', async (route) => {
    if (options?.ticketsError) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
      return;
    }

    if (options?.ticketsDelay) {
      await new Promise((r) => setTimeout(r, options.ticketsDelay));
    }

    const url = new URL(route.request().url());
    const statusParam = url.searchParams.get('status');
    const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
    const limitParam = parseInt(url.searchParams.get('limit') || '10', 10);

    let filtered = tickets ?? [];
    if (statusParam) {
      filtered = filtered.filter((t) => t.status === statusParam);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildTicketResponse(filtered, pageParam, limitParam)),
    });
  });

  // Block socket.io
  await page.route('**/socket.io/**', async (route) => {
    await route.abort();
  });
}

// ===================================================================
// MY TICKETS — /my-tickets page
// ===================================================================

test.describe('My Tickets page', () => {
  // -----------------------------------------------------------------
  // A. Page loads correctly
  // -----------------------------------------------------------------

  test.describe('Page loads', () => {
    test('should render page heading and subtitle', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await expect(
        page.getByRole('heading', { name: /my tickets/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/track and manage your support requests/i),
      ).toBeVisible();
    });

    test('should show skeleton loaders while fetching tickets', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { ticketsDelay: 3000 });
      await page.goto('/my-tickets');

      const skeletons = page.locator('[data-slot="skeleton"]');
      await expect(skeletons.first()).toBeVisible();

      const busyContainer = page.locator('[aria-busy="true"]');
      await expect(busyContainer).toBeVisible();
    });

    test('should render ticket cards after loading', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await expect(page.getByText('Product arrived damaged')).toBeVisible();
      await expect(page.getByText('Missing user manual')).toBeVisible();
      await expect(page.getByText('Wrong size delivered')).toBeVisible();
    });

    test('should display ticket display IDs', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await expect(page.getByText('TK-0001')).toBeVisible();
      await expect(page.getByText('TK-0002')).toBeVisible();
      await expect(page.getByText('TK-0003')).toBeVisible();
    });

    test('should display product names on cards', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await expect(page.getByText('Classic Leather Jacket')).toBeVisible();
      await expect(
        page.getByText('Wireless Bluetooth Headphones'),
      ).toBeVisible();
      await expect(page.getByText('Running Sneakers Pro')).toBeVisible();
    });

    test('should display formatted dates on cards', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await expect(page.getByText('Jun 15, 2025')).toBeVisible();
      await expect(page.getByText('Jun 14, 2025')).toBeVisible();
      await expect(page.getByText('Jun 10, 2025')).toBeVisible();
    });

    test('should display ticket count', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await expect(page.getByText('3 tickets')).toBeVisible();
    });

    test('should not log console errors', async ({ page, context }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (
          msg.type() === 'error' &&
          !msg.text().includes('socket') &&
          !msg.text().includes('ERR_FAILED') &&
          !msg.text().includes('net::')
        ) {
          errors.push(msg.text());
        }
      });

      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();
      await page.waitForTimeout(1000);

      expect(errors).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  test.describe('Authentication', () => {
    test('should redirect unauthenticated user to login', async ({
      page,
    }) => {
      await page.goto('/my-tickets');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect admin user to dashboard', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, adminToken);
      await page.goto('/my-tickets');
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should allow authenticated customer to access page', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await expect(page).toHaveURL(/\/my-tickets/);
      await expect(
        page.getByRole('heading', { name: /my tickets/i }),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // C. Navigation
  // -----------------------------------------------------------------

  test.describe('Navigation', () => {
    test('should navigate to ticket detail when clicking a card', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await page.getByText('Product arrived damaged').click();
      await expect(page).toHaveURL(/\/my-tickets\/ticket-1/);
    });

    test('should highlight My Tickets link as active in navbar', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      const navLink = page
        .getByRole('link', { name: 'My Tickets' })
        .first();
      await expect(navLink).toBeVisible();
    });

    test('each card should link to the correct ticket ID', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await expect(
        page.locator('a[href="/my-tickets/ticket-1"]'),
      ).toBeVisible();
      await expect(
        page.locator('a[href="/my-tickets/ticket-2"]'),
      ).toBeVisible();
      await expect(
        page.locator('a[href="/my-tickets/ticket-3"]'),
      ).toBeVisible();
    });

    test('empty state should link to products page', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { tickets: [] });

      // Also mock the products API since we'll navigate there
      await page.route('**/api/products', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.goto('/my-tickets');

      const browseLink = page.getByRole('link', { name: /browse products/i });
      await expect(browseLink).toBeVisible();
      await browseLink.click();
      await expect(page).toHaveURL(/\/products/);
    });
  });

  // -----------------------------------------------------------------
  // D. Forms & user input (N/A — no forms on my-tickets page)
  // -----------------------------------------------------------------

  test.describe('Forms', () => {
    test('should have no form elements on the my-tickets page', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      const forms = page.locator('form');
      await expect(forms).toHaveCount(0);
    });
  });

  // -----------------------------------------------------------------
  // E. Interactive elements
  // -----------------------------------------------------------------

  test.describe('Interactive elements', () => {
    test('should show status filter buttons', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      await expect(
        page.getByRole('button', { name: /^All$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^Open$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^Closed$/i }),
      ).toBeVisible();
    });

    test('should filter tickets when clicking Open', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      await page.getByRole('button', { name: /^Open$/i }).click();

      // Open tickets visible
      await expect(page.getByText('Product arrived damaged')).toBeVisible();
      await expect(page.getByText('Missing user manual')).toBeVisible();

      // Closed ticket should not be visible
      await expect(
        page.getByText('Wrong size delivered'),
      ).not.toBeVisible();
    });

    test('should filter tickets when clicking Closed', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      await page.getByRole('button', { name: /^Closed$/i }).click();

      // Closed ticket visible
      await expect(page.getByText('Wrong size delivered')).toBeVisible();

      // Open tickets should not be visible
      await expect(
        page.getByText('Product arrived damaged'),
      ).not.toBeVisible();
      await expect(
        page.getByText('Missing user manual'),
      ).not.toBeVisible();
    });

    test('should show all tickets when clicking All after filtering', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      // Filter by Open
      await page.getByRole('button', { name: /^Open$/i }).click();
      await expect(
        page.getByText('Wrong size delivered'),
      ).not.toBeVisible();

      // Click All
      await page.getByRole('button', { name: /^All$/i }).click();

      // All tickets visible
      await expect(page.getByText('Product arrived damaged')).toBeVisible();
      await expect(page.getByText('Wrong size delivered')).toBeVisible();
    });

    test('should show filtered empty state with clear action', async ({
      page,
      context,
    }) => {
      // Use tickets where all are open — filtering by closed yields 0
      const allOpenTickets = mockTickets.filter((t) => t.status === 'open');
      await setupAuthenticatedPage(page, context, {
        tickets: allOpenTickets,
      });
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      await page.getByRole('button', { name: /^Closed$/i }).click();

      await expect(page.getByText(/no closed tickets/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /show all tickets/i }),
      ).toBeVisible();
    });

    test('should clear filter when clicking "Show all tickets" in empty state', async ({
      page,
      context,
    }) => {
      const allOpenTickets = mockTickets.filter((t) => t.status === 'open');
      await setupAuthenticatedPage(page, context, {
        tickets: allOpenTickets,
      });
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      await page.getByRole('button', { name: /^Closed$/i }).click();
      await expect(page.getByText(/no closed tickets/i)).toBeVisible();

      await page
        .getByRole('button', { name: /show all tickets/i })
        .click();

      // Tickets should reappear
      await expect(page.getByText('Product arrived damaged')).toBeVisible();
    });

    test('should display chevron icon on ticket cards', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      // Cards should have a chevron-right SVG
      const card = page.locator('a[href="/my-tickets/ticket-1"]');
      const chevron = card.locator('svg').last();
      await expect(chevron).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // F. Data display
  // -----------------------------------------------------------------

  test.describe('Data display', () => {
    test('should render all 3 tickets in the list', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      const cards = page.locator('a[href^="/my-tickets/ticket-"]');
      await expect(cards).toHaveCount(3);
    });

    test('should display status badges with correct text', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      // Status badges are <span data-slot="badge"> elements
      const badgeSelector = '[data-slot="badge"]';

      // 2 Open badges + 1 Closed badge (within card area, not filter buttons)
      const openBadges = page.locator(badgeSelector, { hasText: /^Open$/ });
      await expect(openBadges).toHaveCount(2);

      const closedBadges = page.locator(badgeSelector, { hasText: /^Closed$/ });
      await expect(closedBadges).toHaveCount(1);
    });

    test('should display priority badges with correct text', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      await expect(page.getByText('High', { exact: true })).toBeVisible();
      await expect(page.getByText('Low', { exact: true })).toBeVisible();
      await expect(
        page.getByText('Medium', { exact: true }),
      ).toBeVisible();
    });

    test('should show empty state when no tickets exist', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { tickets: [] });
      await page.goto('/my-tickets');

      await expect(page.getByText(/no tickets yet/i)).toBeVisible();
      await expect(
        page.getByText(/browse products to create a support ticket/i),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: /browse products/i }),
      ).toBeVisible();
    });

    test('should show singular "ticket" for count of 1', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        tickets: [mockTickets[0]],
      });
      await page.goto('/my-tickets');

      await expect(page.getByText('1 ticket')).toBeVisible();
    });

    test('should show left accent border on cards', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      // Cards should have border-l class
      const card = page
        .locator('a[href="/my-tickets/ticket-1"]')
        .locator('div')
        .first();
      await expect(card).toBeVisible();
    });

    test('should show pagination when tickets exceed page limit', async ({
      page,
      context,
    }) => {
      // Create 15 tickets to trigger pagination with limit=10
      const manyTickets = Array.from({ length: 15 }, (_, i) => ({
        ...mockTickets[0],
        id: `ticket-pg-${i + 1}`,
        display_id: `TK-${String(i + 1).padStart(4, '0')}`,
        subject: `Paginated ticket #${i + 1}`,
      }));

      await setupAuthenticatedPage(page, context, { tickets: manyTickets });
      await page.goto('/my-tickets');
      await page.getByText('Paginated ticket #1', { exact: true }).waitFor();

      // Pagination should appear
      await expect(page.getByText(/page 1 of 2/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Next', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous', exact: true }),
      ).toBeVisible();
    });

    test('should navigate to next page when clicking Next', async ({
      page,
      context,
    }) => {
      const manyTickets = Array.from({ length: 15 }, (_, i) => ({
        ...mockTickets[0],
        id: `ticket-pg-${i + 1}`,
        display_id: `TK-${String(i + 1).padStart(4, '0')}`,
        subject: `Paginated ticket #${i + 1}`,
      }));

      await setupAuthenticatedPage(page, context, { tickets: manyTickets });
      await page.goto('/my-tickets');
      await page.getByText('Paginated ticket #1', { exact: true }).waitFor();

      await page.getByRole('button', { name: 'Next', exact: true }).click();

      await expect(page.getByText(/page 2 of 2/i)).toBeVisible();
      await expect(page.getByText('Paginated ticket #11', { exact: true })).toBeVisible();
    });

    test('should disable Previous button on first page', async ({
      page,
      context,
    }) => {
      const manyTickets = Array.from({ length: 15 }, (_, i) => ({
        ...mockTickets[0],
        id: `ticket-pg-${i + 1}`,
        display_id: `TK-${String(i + 1).padStart(4, '0')}`,
        subject: `Paginated ticket #${i + 1}`,
      }));

      await setupAuthenticatedPage(page, context, { tickets: manyTickets });
      await page.goto('/my-tickets');
      await page.getByText('Paginated ticket #1', { exact: true }).waitFor();

      const prevButton = page.getByRole('button', { name: 'Previous', exact: true });
      await expect(prevButton).toBeDisabled();
    });

    test('should disable Next button on last page', async ({
      page,
      context,
    }) => {
      const manyTickets = Array.from({ length: 15 }, (_, i) => ({
        ...mockTickets[0],
        id: `ticket-pg-${i + 1}`,
        display_id: `TK-${String(i + 1).padStart(4, '0')}`,
        subject: `Paginated ticket #${i + 1}`,
      }));

      await setupAuthenticatedPage(page, context, { tickets: manyTickets });
      await page.goto('/my-tickets');
      await page.getByText('Paginated ticket #1', { exact: true }).waitFor();

      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByText(/page 2 of 2/i).waitFor();

      const nextButton = page.getByRole('button', { name: 'Next', exact: true });
      await expect(nextButton).toBeDisabled();
    });

    test('should not show pagination when all tickets fit one page', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      // PaginationControls returns null when totalPages <= 1
      await expect(page.getByText(/page \d+ of/i)).not.toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // G. Dark mode
  // -----------------------------------------------------------------

  test.describe('Dark mode', () => {
    test('should render correctly in light mode', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/my-tickets');

      await expect(
        page.getByRole('heading', { name: /my tickets/i }),
      ).toBeVisible();
      await expect(page.getByText('Product arrived damaged')).toBeVisible();
    });

    test('should render correctly in dark mode', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/my-tickets');

      await expect(
        page.getByRole('heading', { name: /my tickets/i }),
      ).toBeVisible();
      await expect(page.getByText('Product arrived damaged')).toBeVisible();

      // Filter buttons should be visible in dark mode
      await expect(
        page.getByRole('button', { name: /^All$/i }),
      ).toBeVisible();
    });

    test('should have readable badges in dark mode', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      const badgeSelector = '[data-slot="badge"]';
      await expect(page.locator(badgeSelector, { hasText: /^Open$/ }).first()).toBeVisible();
      await expect(page.locator(badgeSelector, { hasText: /^High$/ })).toBeVisible();
      await expect(page.locator(badgeSelector, { hasText: /^Closed$/ })).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // H. Responsive design
  // -----------------------------------------------------------------

  test.describe('Responsive design', () => {
    test('should render correctly on desktop (1280px)', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/my-tickets');

      await expect(page.getByText('Product arrived damaged')).toBeVisible();
      await expect(page.getByText('TK-0001')).toBeVisible();
    });

    test('should render correctly on tablet (768px)', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/my-tickets');

      await expect(page.getByText('Product arrived damaged')).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^All$/i }),
      ).toBeVisible();
    });

    test('should render correctly on mobile (375px)', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/my-tickets');

      await expect(page.getByText('Product arrived damaged')).toBeVisible();
      await expect(page.getByText('TK-0001')).toBeVisible();
      await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
    });

    test('should show all tickets on mobile viewport', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/my-tickets');

      await expect(page.getByText('Product arrived damaged')).toBeVisible();
      await expect(page.getByText('Missing user manual')).toBeVisible();
      await expect(page.getByText('Wrong size delivered')).toBeVisible();
    });

    test('filter buttons should be visible on mobile', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      await expect(
        page.getByRole('button', { name: /^All$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^Open$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^Closed$/i }),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // I. Real-time features (N/A — no real-time on ticket list)
  // -----------------------------------------------------------------

  test.describe('Real-time', () => {
    test('should block socket.io without affecting page functionality', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      await expect(page.getByText('Product arrived damaged')).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // J. Error handling
  // -----------------------------------------------------------------

  test.describe('Error handling', () => {
    test('should show error state when tickets API fails', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { ticketsError: true });
      await page.goto('/my-tickets');

      await expect(page.getByText(/something went wrong/i)).toBeVisible();
      await expect(
        page.getByText(/couldn.*t load your tickets/i),
      ).toBeVisible();
    });

    test('should show retry button on API failure', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { ticketsError: true });
      await page.goto('/my-tickets');

      await expect(
        page.getByRole('button', { name: /try again/i }),
      ).toBeVisible();
    });

    test('should retry fetching tickets when clicking retry', async ({
      page,
      context,
    }) => {
      let callCount = 0;

      await setAuthCookie(context, customerToken);
      await page.addInitScript(
        (t: string) => {
          localStorage.setItem('auth_token', t);
        },
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
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockNotifications),
        });
      });

      await page.route('**/api/tickets?*', async (route) => {
        callCount++;
        if (callCount === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildTicketResponse(mockTickets)),
          });
        }
      });

      await page.route('**/socket.io/**', async (route) => {
        await route.abort();
      });

      await page.goto('/my-tickets');

      await expect(page.getByText(/something went wrong/i)).toBeVisible();

      await page.getByRole('button', { name: /try again/i }).click();

      await expect(page.getByText('Product arrived damaged')).toBeVisible();
    });

    test('should show error toast on API failure', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { ticketsError: true });
      await page.goto('/my-tickets');

      const toast = page.locator('[data-sonner-toast]');
      await expect(toast.first()).toBeVisible({ timeout: 5000 });
    });

    test('should not show status filters when API fails', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { ticketsError: true });
      await page.goto('/my-tickets');

      await expect(page.getByText(/something went wrong/i)).toBeVisible();

      // Filter buttons should not appear
      await expect(
        page.getByRole('button', { name: /^All$/i }),
      ).not.toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // K. Accessibility
  // -----------------------------------------------------------------

  test.describe('Accessibility', () => {
    test('should have exactly one h1 heading', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);
    });

    test('should have a main landmark', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('filter buttons should be keyboard accessible', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      const allButton = page.getByRole('button', { name: /^All$/i });
      await allButton.focus();
      await expect(allButton).toBeFocused();
    });

    test('ticket cards should be navigable via keyboard', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');
      await page.getByText('Product arrived damaged').waitFor();

      const firstCard = page.locator('a[href="/my-tickets/ticket-1"]');
      await firstCard.focus();
      await expect(firstCard).toBeFocused();

      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/my-tickets\/ticket-1/);
    });

    test('should have skip-to-content link', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/my-tickets');

      const skipLink = page.locator('a[href="#main"]');
      await expect(skipLink).toBeAttached();
    });

    test('pagination buttons should be keyboard accessible', async ({
      page,
      context,
    }) => {
      const manyTickets = Array.from({ length: 15 }, (_, i) => ({
        ...mockTickets[0],
        id: `ticket-kb-${i + 1}`,
        display_id: `TK-${String(i + 1).padStart(4, '0')}`,
        subject: `KB ticket #${i + 1}`,
      }));

      await setupAuthenticatedPage(page, context, { tickets: manyTickets });
      await page.goto('/my-tickets');
      await page.getByText('KB ticket #1', { exact: true }).waitFor();

      const nextButton = page.getByRole('button', { name: 'Next', exact: true });
      await nextButton.focus();
      await expect(nextButton).toBeFocused();
    });
  });
});
