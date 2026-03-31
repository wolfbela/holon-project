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

function createMockTicket(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

const mockTickets = [
  createMockTicket(),
  createMockTicket({
    id: 'ticket-2',
    display_id: 'TK-0002',
    user_id: 'cust-2',
    email: 'customer2@example.com',
    name: 'Jane Smith',
    product_id: 2,
    product_name: 'Classic T-Shirt',
    subject: 'Wrong size delivered',
    status: 'open',
    priority: 'medium',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  }),
  createMockTicket({
    id: 'ticket-3',
    display_id: 'TK-0003',
    user_id: 'cust-3',
    email: 'customer3@example.com',
    name: 'Bob Wilson',
    product_id: 3,
    product_name: 'Leather Wallet',
    subject: 'Refund request',
    status: 'closed',
    priority: 'low',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  }),
  createMockTicket({
    id: 'ticket-4',
    display_id: 'TK-0004',
    user_id: 'cust-1',
    email: 'customer1@example.com',
    name: 'John Doe',
    product_id: 4,
    product_name: 'Running Shoes',
    subject: 'Color mismatch',
    status: 'open',
    priority: 'medium',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  }),
  createMockTicket({
    id: 'ticket-5',
    display_id: 'TK-0005',
    user_id: 'cust-2',
    email: 'customer2@example.com',
    name: 'Jane Smith',
    product_id: 5,
    product_name: 'Wireless Headphones',
    subject: 'Battery drains quickly',
    status: 'open',
    priority: 'high',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  }),
];

const mockPaginatedTickets = {
  data: mockTickets,
  pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
};

const mockPaginatedTicketsPage2 = {
  data: mockTickets.map((t, i) => ({
    ...t,
    id: `ticket-p2-${i + 1}`,
    display_id: `TK-00${i + 6}`,
    subject: `Page 2 ticket ${i + 1}`,
  })),
  pagination: { page: 2, limit: 10, total: 25, totalPages: 3 },
};

const mockEmptyTickets = {
  data: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
};

const mockFilteredTicketsOpen = {
  data: mockTickets.filter((t) => t.status === 'open'),
  pagination: { page: 1, limit: 10, total: 4, totalPages: 1 },
};

const mockFilteredTicketsHigh = {
  data: mockTickets.filter((t) => t.priority === 'high'),
  pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
};

const mockSearchResults = {
  data: [mockTickets[0]],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
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
  tickets?: typeof mockPaginatedTickets;
  ticketsStatus?: number;
  ticketsDelay?: number;
  ticketsHandler?: (url: URL) => { status: number; body: string };
}

async function setupTicketsPage(
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

  // Tickets endpoint with query param handling
  await page.route('**/api/tickets?*', async (route) => {
    if (options.ticketsDelay) {
      await new Promise((r) => setTimeout(r, options.ticketsDelay));
    }

    if (options.ticketsHandler) {
      const url = new URL(route.request().url());
      const result = options.ticketsHandler(url);
      await route.fulfill({
        status: result.status,
        contentType: 'application/json',
        body: result.body,
      });
      return;
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
      body: JSON.stringify(options.tickets ?? mockPaginatedTickets),
    });
  });

  // Block socket.io
  await page.route('**/socket.io/**', (route) => route.abort());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Admin Tickets page', () => {
  // =========================================================================
  // A. Page loads correctly
  // =========================================================================

  test.describe('Page loads', () => {
    test('should render the page with heading and subtitle', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await expect(
        page.getByRole('heading', { name: /tickets/i }),
      ).toBeVisible();
      await expect(
        page.getByText('Manage all customer support tickets.'),
      ).toBeVisible();
    });

    test('should render the search input', async ({ page, context }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await expect(
        page.getByPlaceholder('Search by subject or customer name...'),
      ).toBeVisible();
    });

    test('should render status and priority filter dropdowns', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      // Base-ui Select renders as combobox — at least 2 for status + priority filters
      const comboboxes = page.getByRole('combobox');
      expect(await comboboxes.count()).toBeGreaterThanOrEqual(2);
    });

    test('should display tickets in a table on desktop', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      // Wait for table to render
      await expect(page.locator('table')).toBeVisible();

      // Ticket data should be visible
      await expect(page.getByText('TK-0001')).toBeVisible();
      await expect(page.getByText('John Doe').first()).toBeVisible();
      await expect(page.getByText('Product arrived damaged')).toBeVisible();
    });

    test('should show ticket count', async ({ page, context }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await expect(page.getByText('25 tickets')).toBeVisible();
    });

    test('should show skeleton loaders while loading', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context, { ticketsDelay: 2000 });
      await page.goto('/tickets');

      // Skeletons should be visible initially
      const skeletons = page.locator('[data-slot="skeleton"]');
      await expect(skeletons.first()).toBeVisible();

      // Wait for data to load — skeleton should disappear
      await expect(page.getByText('TK-0001')).toBeVisible({ timeout: 5000 });
    });

    test('should show customer name and email in table rows', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await expect(page.getByText('customer1@example.com').first()).toBeVisible();
      await expect(page.getByText('Jane Smith').first()).toBeVisible();
    });

    test('should show status and priority badges', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await expect(page.getByText('Open').first()).toBeVisible();
      await expect(page.getByText('High').first()).toBeVisible();
      await expect(page.getByText('Closed').first()).toBeVisible();
      await expect(page.getByText('Low').first()).toBeVisible();
    });
  });

  // =========================================================================
  // B. Authentication & authorization
  // =========================================================================

  test.describe('Authentication', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.route('**/socket.io/**', (route) => route.abort());
      await page.goto('/tickets');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect customer to /products', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, customerToken);
      await page.addInitScript(
        (t: string) => localStorage.setItem('auth_token', t),
        customerToken,
      );
      await page.route('**/socket.io/**', (route) => route.abort());
      await page.goto('/tickets');
      await expect(page).toHaveURL(/\/products/);
    });
  });

  // =========================================================================
  // C. Navigation
  // =========================================================================

  test.describe('Navigation', () => {
    test('should navigate to ticket detail when clicking a table row', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await page.getByText('Product arrived damaged').click();
      await expect(page).toHaveURL(/\/tickets\/ticket-1/);
    });

    test('should have active Tickets link in sidebar', async ({ page, context }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      // Sidebar should have a Tickets link pointing to /tickets
      const ticketsLink = page.locator('a[href="/tickets"]').first();
      await expect(ticketsLink).toBeVisible();
    });
  });

  // =========================================================================
  // D. Search
  // =========================================================================

  test.describe('Search', () => {
    test('should filter tickets when typing in search', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          const search = url.searchParams.get('search') ?? '';
          const body =
            search === 'damaged'
              ? JSON.stringify(mockSearchResults)
              : JSON.stringify(mockPaginatedTickets);
          return { status: 200, body };
        },
      });
      await page.goto('/tickets');

      await page.getByPlaceholder('Search by subject or customer name...').fill('damaged');

      // Wait for debounced search to take effect
      await expect(page.getByText('1 ticket')).toBeVisible({ timeout: 3000 });
    });

    test('should clear search when clicking the clear button', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          const search = url.searchParams.get('search') ?? '';
          const body = search
            ? JSON.stringify(mockSearchResults)
            : JSON.stringify(mockPaginatedTickets);
          return { status: 200, body };
        },
      });
      await page.goto('/tickets');

      const searchInput = page.getByPlaceholder('Search by subject or customer name...');
      await searchInput.fill('damaged');
      await expect(page.getByText('1 ticket')).toBeVisible({ timeout: 3000 });

      // Click the clear button
      await page.getByRole('button', { name: 'Clear search' }).click();
      await expect(searchInput).toHaveValue('');
      await expect(page.getByText('25 tickets')).toBeVisible({ timeout: 3000 });
    });

    test('should update URL with search param', async ({ page, context }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await page.getByPlaceholder('Search by subject or customer name...').fill('damaged');
      await page.waitForTimeout(500); // wait for debounce + URL update

      expect(page.url()).toContain('search=damaged');
    });
  });

  // =========================================================================
  // E. Filters
  // =========================================================================

  test.describe('Filters', () => {
    test('should filter by status when selecting Open', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          const status = url.searchParams.get('status');
          if (status === 'open') {
            return {
              status: 200,
              body: JSON.stringify(mockFilteredTicketsOpen),
            };
          }
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      // Click the first combobox (status filter)
      await page.getByRole('combobox').first().click();
      await page.getByRole('option', { name: 'Open' }).click();

      await expect(page.getByText('4 tickets open')).toBeVisible({
        timeout: 3000,
      });
    });

    test('should filter by priority when selecting High', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          const priority = url.searchParams.get('priority');
          if (priority === 'high') {
            return {
              status: 200,
              body: JSON.stringify(mockFilteredTicketsHigh),
            };
          }
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });
      await page.goto('/tickets');

      // Click the second combobox (priority filter)
      await page.getByRole('combobox').nth(1).click();
      await page.getByRole('option', { name: 'High' }).click();

      await expect(page.getByText('2 tickets (high priority)')).toBeVisible({
        timeout: 3000,
      });
    });

    test('should update URL with filter params', async ({ page, context }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      // Click status filter
      await page.getByRole('combobox').first().click();
      await page.getByRole('option', { name: 'Open' }).click();

      await expect(page).toHaveURL(/status=open/);
    });
  });

  // =========================================================================
  // F. Sorting
  // =========================================================================

  test.describe('Sorting', () => {
    test('should sort by Date column when clicking header', async ({
      page,
      context,
    }) => {
      let lastSort = '';
      let lastOrder = '';
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          lastSort = url.searchParams.get('sort') ?? '';
          lastOrder = url.searchParams.get('order') ?? '';
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });
      await page.goto('/tickets');
      await expect(page.locator('table')).toBeVisible();

      // Click Date header to toggle sort
      await page.locator('th').filter({ hasText: 'Date' }).click();

      // Should have toggled to asc
      await page.waitForTimeout(500);
      expect(lastSort).toBe('created_at');
      expect(lastOrder).toBe('asc');
    });

    test('should sort by Status column', async ({ page, context }) => {
      let lastSort = '';
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          lastSort = url.searchParams.get('sort') ?? '';
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });
      await page.goto('/tickets');
      await expect(page.locator('table')).toBeVisible();

      await page.locator('th').filter({ hasText: 'Status' }).click();

      await page.waitForTimeout(500);
      expect(lastSort).toBe('status');
    });

    test('should sort by Priority column', async ({ page, context }) => {
      let lastSort = '';
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          lastSort = url.searchParams.get('sort') ?? '';
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });
      await page.goto('/tickets');
      await expect(page.getByText('TK-0001')).toBeVisible();

      // The Priority column header is a sortable th
      await page.locator('th').filter({ hasText: /^Priority/ }).click();

      await expect(page).toHaveURL(/sort=priority/, { timeout: 3000 });
      expect(lastSort).toBe('priority');
    });

    test('should toggle sort order on double click', async ({
      page,
      context,
    }) => {
      let lastOrder = '';
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          lastOrder = url.searchParams.get('order') ?? '';
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });
      await page.goto('/tickets');
      // Wait for real data, not skeleton
      await expect(page.getByText('TK-0001')).toBeVisible();

      const dateHeader = page.locator('th').filter({ hasText: 'Date' });

      // First click: asc (default is desc, toggle to asc)
      await dateHeader.click();
      await expect(page).toHaveURL(/order=asc/, { timeout: 3000 });
      expect(lastOrder).toBe('asc');

      // Second click: desc
      await dateHeader.click();
      await expect(page).toHaveURL(/order=desc/, { timeout: 3000 });
      expect(lastOrder).toBe('desc');
    });

    test('should update URL with sort params', async ({ page, context }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      // Wait for real data, not skeleton
      await expect(page.getByText('TK-0001')).toBeVisible();

      await page.locator('th').filter({ hasText: 'Priority' }).click();
      await expect(page).toHaveURL(/sort=priority/, { timeout: 3000 });
    });
  });

  // =========================================================================
  // G. Pagination
  // =========================================================================

  test.describe('Pagination', () => {
    test('should show pagination controls', async ({ page, context }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
    });

    test('should navigate to next page', async ({ page, context }) => {
      let requestedPage = 1;
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          requestedPage = Number(url.searchParams.get('page') ?? 1);
          const body =
            requestedPage === 2
              ? JSON.stringify(mockPaginatedTicketsPage2)
              : JSON.stringify(mockPaginatedTickets);
          return { status: 200, body };
        },
      });
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      await page.getByRole('button', { name: 'Next', exact: true }).click();

      await expect(page.getByText('Page 2 ticket 1')).toBeVisible({
        timeout: 3000,
      });
    });

    test('should disable Previous on first page', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      await expect(
        page.getByRole('button', { name: 'Previous', exact: true }),
      ).toBeDisabled();
    });

    test('should show items-per-page selector', async ({ page, context }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      await expect(page.getByText('per page')).toBeVisible();
    });

    test('should change items per page', async ({ page, context }) => {
      let requestedLimit = 10;
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          requestedLimit = Number(url.searchParams.get('limit') ?? 10);
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      // The limit selector is the 3rd combobox (after status + priority filters)
      await page.getByRole('combobox').nth(2).click();
      await page.getByRole('option', { name: '25' }).click();

      await page.waitForTimeout(500);
      expect(requestedLimit).toBe(25);
    });

    test('should update URL with page param', async ({ page, context }) => {
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          const p = Number(url.searchParams.get('page') ?? 1);
          return {
            status: 200,
            body:
              p === 2
                ? JSON.stringify(mockPaginatedTicketsPage2)
                : JSON.stringify(mockPaginatedTickets),
          };
        },
      });
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page).toHaveURL(/page=2/);
    });

    test('should show page number buttons', async ({ page, context }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      await expect(page.getByRole('button', { name: '1' })).toBeVisible();
      await expect(page.getByRole('button', { name: '2' })).toBeVisible();
      await expect(page.getByRole('button', { name: '3' })).toBeVisible();
    });
  });

  // =========================================================================
  // H. Delete ticket
  // =========================================================================

  test.describe('Delete ticket', () => {
    test('should show delete confirmation dialog', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.locator('table')).toBeVisible();

      // Click delete button on first row
      await page.getByRole('button', { name: 'Delete ticket' }).first().click();

      await expect(
        page.getByRole('heading', { name: /delete ticket/i }),
      ).toBeVisible();
      await expect(page.getByText('cannot be undone')).toBeVisible();
    });

    test('should cancel deletion', async ({ page, context }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.locator('table')).toBeVisible();

      await page.getByRole('button', { name: 'Delete ticket' }).first().click();

      await page.getByRole('button', { name: 'Cancel' }).click();

      // Dialog should close, ticket still visible
      await expect(
        page.getByRole('heading', { name: /delete ticket/i }),
      ).not.toBeVisible();
      await expect(page.getByText('TK-0001')).toBeVisible();
    });

    test('should delete ticket on confirm', async ({ page, context }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);

      // Mock delete endpoint
      await page.route('**/api/tickets/ticket-1', (route) => {
        if (route.request().method() === 'DELETE') {
          return route.fulfill({ status: 204 });
        }
        return route.continue();
      });

      await page.goto('/tickets');
      await expect(page.locator('table')).toBeVisible();

      await page.getByRole('button', { name: 'Delete ticket' }).first().click();

      // Click the "Delete" button in the dialog (not the "Delete ticket" icon button)
      await page.locator('[role="dialog"]').getByRole('button', { name: 'Delete' }).click();

      // Ticket should be removed from the list
      await expect(page.getByText('TK-0001')).not.toBeVisible({
        timeout: 3000,
      });
    });

    test('should show error toast when delete fails', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);

      // Mock delete endpoint with failure
      await page.route('**/api/tickets/ticket-1', (route) => {
        if (route.request().method() === 'DELETE') {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server error' }),
          });
        }
        return route.continue();
      });

      await page.goto('/tickets');
      await expect(page.locator('table')).toBeVisible();

      await page.getByRole('button', { name: 'Delete ticket' }).first().click();
      await page.locator('[role="dialog"]').getByRole('button', { name: 'Delete' }).click();

      // Error toast should appear
      await expect(page.getByText(/server error/i)).toBeVisible({
        timeout: 3000,
      });
    });
  });

  // =========================================================================
  // I. Empty state
  // =========================================================================

  test.describe('Empty state', () => {
    test('should show empty state when no tickets exist', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context, { tickets: mockEmptyTickets });
      await page.goto('/tickets');

      await expect(page.getByText('No tickets found')).toBeVisible();
      await expect(
        page.getByText('No tickets have been created yet.'),
      ).toBeVisible();
    });

    test('should show empty state with clear filters action when filters active', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          const status = url.searchParams.get('status');
          if (status) {
            return { status: 200, body: JSON.stringify(mockEmptyTickets) };
          }
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      // Apply a filter
      await page.getByRole('combobox').first().click();
      await page.getByRole('option', { name: 'Closed' }).click();

      await expect(
        page.getByText('Try adjusting your search or filters.'),
      ).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole('button', { name: /clear filters/i }),
      ).toBeVisible();
    });

    test('should clear filters from empty state', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          const status = url.searchParams.get('status');
          if (status) {
            return { status: 200, body: JSON.stringify(mockEmptyTickets) };
          }
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });
      await page.goto('/tickets');
      await expect(page.getByText('25 tickets')).toBeVisible();

      await page.getByRole('combobox').first().click();
      await page.getByRole('option', { name: 'Closed' }).click();

      await expect(
        page.getByRole('button', { name: /clear filters/i }),
      ).toBeVisible({ timeout: 3000 });

      await page.getByRole('button', { name: /clear filters/i }).click();

      await expect(page.getByText('25 tickets')).toBeVisible({
        timeout: 3000,
      });
    });
  });

  // =========================================================================
  // J. Error handling
  // =========================================================================

  test.describe('Error handling', () => {
    test('should show error state when API fails', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context, { ticketsStatus: 500 });
      await page.goto('/tickets');

      await expect(page.getByText('Something went wrong')).toBeVisible();
      await expect(
        page.getByRole('button', { name: /try again/i }),
      ).toBeVisible();
    });

    test('should retry when clicking Try again', async ({
      page,
      context,
    }) => {
      let callCount = 0;
      await setupTicketsPage(page, context, {
        ticketsHandler: () => {
          callCount++;
          if (callCount === 1) {
            return {
              status: 500,
              body: JSON.stringify({ error: 'Internal server error' }),
            };
          }
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });
      await page.goto('/tickets');

      await expect(page.getByText('Something went wrong')).toBeVisible();

      await page.getByRole('button', { name: /try again/i }).click();

      await expect(page.getByText('25 tickets')).toBeVisible({
        timeout: 3000,
      });
    });
  });

  // =========================================================================
  // K. Dark mode
  // =========================================================================

  test.describe('Dark mode', () => {
    test('should render correctly in dark mode', async ({ page, context }) => {
      await setupTicketsPage(page, context);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/tickets');

      await expect(
        page.getByRole('heading', { name: /tickets/i }),
      ).toBeVisible();
      await expect(page.getByText('TK-0001')).toBeVisible();
    });

    test('should render correctly in light mode', async ({ page, context }) => {
      await setupTicketsPage(page, context);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/tickets');

      await expect(
        page.getByRole('heading', { name: /tickets/i }),
      ).toBeVisible();
      await expect(page.getByText('TK-0001')).toBeVisible();
    });
  });

  // =========================================================================
  // L. Responsive design
  // =========================================================================

  test.describe('Responsive design', () => {
    test('should show table on desktop', async ({ page, context }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await expect(page.locator('table')).toBeVisible();
    });

    test('should show cards on mobile instead of table', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      // Table should not be visible
      await expect(page.locator('table')).not.toBeVisible();

      // Cards should show ticket data
      await expect(page.getByText('TK-0001')).toBeVisible();
      await expect(page.getByText('Product arrived damaged')).toBeVisible();
    });

    test('should show customer name and email on mobile cards', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await expect(page.getByText('John Doe').first()).toBeVisible();
      await expect(
        page.getByText('customer1@example.com').first(),
      ).toBeVisible();
    });

    test('should show delete button on mobile cards', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await expect(page.getByRole('button', { name: 'Delete ticket' }).first()).toBeVisible();
    });

    test('should show skeleton cards on mobile while loading', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupTicketsPage(page, context, { ticketsDelay: 2000 });
      await page.goto('/tickets');

      const skeletons = page.locator('[data-slot="skeleton"]');
      await expect(skeletons.first()).toBeVisible();

      await expect(page.getByText('TK-0001')).toBeVisible({ timeout: 5000 });
    });

    test('should render search and filters on mobile', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      await expect(page.getByPlaceholder('Search by subject or customer name...')).toBeVisible();
      // Two filter comboboxes should be visible
      const comboboxes = page.getByRole('combobox');
      await expect(comboboxes.first()).toBeVisible();
    });
  });

  // =========================================================================
  // M. URL state preservation
  // =========================================================================

  test.describe('URL state preservation', () => {
    test('should restore filters from URL on page load', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          const status = url.searchParams.get('status');
          if (status === 'open') {
            return {
              status: 200,
              body: JSON.stringify(mockFilteredTicketsOpen),
            };
          }
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });

      // Navigate directly with filter in URL
      await page.goto('/tickets?status=open');

      await expect(page.getByText('4 tickets open')).toBeVisible({
        timeout: 3000,
      });
    });

    test('should restore search from URL', async ({ page, context }) => {
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          const search = url.searchParams.get('search');
          if (search === 'damaged') {
            return { status: 200, body: JSON.stringify(mockSearchResults) };
          }
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });

      await page.goto('/tickets?search=damaged');

      await expect(page.getByPlaceholder('Search by subject or customer name...')).toHaveValue('damaged');
      await expect(page.getByText('1 ticket')).toBeVisible({ timeout: 3000 });
    });

    test('should restore page from URL', async ({ page, context }) => {
      await setupTicketsPage(page, context, {
        ticketsHandler: (url) => {
          const p = Number(url.searchParams.get('page') ?? 1);
          if (p === 2) {
            return { status: 200, body: JSON.stringify(mockPaginatedTicketsPage2) };
          }
          return { status: 200, body: JSON.stringify(mockPaginatedTickets) };
        },
      });

      await page.goto('/tickets?page=2');
      await expect(page.getByText('Page 2 ticket 1')).toBeVisible({ timeout: 3000 });
    });
  });

  // =========================================================================
  // N. Accessibility
  // =========================================================================

  test.describe('Accessibility', () => {
    test('should have accessible search input', async ({
      page,
      context,
    }) => {
      await setupTicketsPage(page, context);
      await page.goto('/tickets');

      const input = page.getByPlaceholder('Search by subject or customer name...');
      await expect(input).toBeVisible();
    });

    test('should have accessible delete buttons on desktop', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.getByText('TK-0001')).toBeVisible();

      const deleteButtons = page.getByRole('button', { name: 'Delete ticket' });
      await expect(deleteButtons.first()).toBeVisible();
      expect(await deleteButtons.count()).toBeGreaterThan(0);
    });

    test('should be keyboard navigable', async ({ page, context }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.locator('table')).toBeVisible();

      // Focus search input and verify it accepts input
      const searchInput = page.getByPlaceholder('Search by subject or customer name...');
      await searchInput.focus();
      await expect(searchInput).toBeFocused();
    });

    test('should close delete dialog with Escape', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupTicketsPage(page, context);
      await page.goto('/tickets');
      await expect(page.locator('table')).toBeVisible();

      await page.getByRole('button', { name: 'Delete ticket' }).first().click();
      await expect(
        page.getByRole('heading', { name: /delete ticket/i }),
      ).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(
        page.getByRole('heading', { name: /delete ticket/i }),
      ).not.toBeVisible();
    });
  });
});
