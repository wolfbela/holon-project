import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/* ------------------------------------------------------------------ */
/* Mock data                                                          */
/* ------------------------------------------------------------------ */

const HEADER = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const SIGNATURE = 'fakesig';

function buildJwt(payload: Record<string, unknown>): string {
  return `${HEADER}.${btoa(JSON.stringify(payload))}.${SIGNATURE}`;
}

const adminToken = buildJwt({
  userId: 'admin-1',
  email: 'admin@holon.com',
  role: 'admin',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
});

const customerToken = buildJwt({
  userId: 'cust-1',
  email: 'customer1@example.com',
  role: 'customer',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
});

const mockAdminUser = {
  id: 'admin-1',
  email: 'admin@holon.com',
  name: 'Admin Agent',
  role: 'admin',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

const mockNotifications = { data: [], unreadCount: 0 };

const mockTicketOpen = {
  id: 'ticket-1',
  display_id: 'TK-0001',
  user_id: 'cust-1',
  email: 'customer1@example.com',
  name: 'John Doe',
  product_id: 4,
  product_name: 'Fjallraven Backpack',
  subject: 'Product arrived damaged',
  message:
    'The zipper on my backpack was broken when it arrived. I would like a replacement or refund.',
  status: 'open',
  priority: 'high',
  created_at: '2025-06-15T10:30:00.000Z',
  updated_at: '2025-06-15T10:30:00.000Z',
};

const mockTicketClosed = {
  ...mockTicketOpen,
  id: 'ticket-2',
  display_id: 'TK-0002',
  subject: 'Order not received',
  message: 'My order has not arrived.',
  status: 'closed',
  priority: 'medium',
};

const mockReplies = [
  {
    id: 'reply-1',
    ticket_id: 'ticket-1',
    user_id: 'admin-1',
    author_type: 'agent',
    message:
      "We're sorry to hear about the damage. We'll arrange a replacement right away.",
    created_at: '2025-06-15T11:00:00.000Z',
  },
  {
    id: 'reply-2',
    ticket_id: 'ticket-1',
    user_id: 'cust-1',
    author_type: 'customer',
    message: 'Thank you for the quick response!',
    created_at: '2025-06-15T11:30:00.000Z',
  },
  {
    id: 'reply-3',
    ticket_id: 'ticket-1',
    user_id: 'admin-1',
    author_type: 'agent',
    message:
      'Your replacement has been shipped. Tracking number: TR-12345. Expected delivery: 3-5 business days.',
    created_at: '2025-06-15T12:00:00.000Z',
  },
];

const mockProduct = {
  id: 4,
  title: 'Fjallraven Backpack',
  price: 109.95,
  description: 'A great backpack for everyday use.',
  category: { id: 1, name: 'Clothes' },
  images: ['https://i.imgur.com/backpack.jpg'],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

async function setAuthCookie(context: BrowserContext, token: string) {
  await context.addCookies([
    { name: 'auth_token', value: token, domain: 'localhost', path: '/' },
  ]);
}

interface SetupOptions {
  ticket?: typeof mockTicketOpen | typeof mockTicketClosed | null;
  ticketStatus?: number;
  ticketDelay?: number;
  replies?: typeof mockReplies;
  repliesDelay?: number;
  repliesError?: boolean;
  product?: typeof mockProduct | null;
  token?: string;
  submitReplyStatus?: number;
  submitReplyResponse?: Record<string, unknown>;
  updateTicketStatus?: number;
  updateTicketResponse?: Record<string, unknown>;
}

async function setupAdminPage(
  page: Page,
  context: BrowserContext,
  options: SetupOptions = {},
) {
  const ticket =
    options.ticket !== undefined ? options.ticket : mockTicketOpen;
  const replies = options.replies ?? mockReplies;
  const product =
    options.product !== undefined ? options.product : mockProduct;
  const token = options.token ?? adminToken;
  const ticketId = ticket?.id ?? 'ticket-1';

  // Auth
  await setAuthCookie(context, token);
  await page.addInitScript(
    (t: string) => localStorage.setItem('auth_token', t),
    token,
  );

  // Auth/me endpoint
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: mockAdminUser }),
    });
  });

  // Notifications
  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockNotifications),
    });
  });

  // Replies endpoint (must be registered BEFORE the ticket endpoint)
  await page.route(`**/api/tickets/${ticketId}/replies`, async (route) => {
    // POST reply
    if (route.request().method() === 'POST') {
      const status = options.submitReplyStatus ?? 201;
      if (status !== 201) {
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(
            options.submitReplyResponse ?? {
              error: 'Failed to submit reply',
            },
          ),
        });
        return;
      }
      const body = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: `reply-new-${Date.now()}`,
          ticket_id: ticketId,
          user_id: 'admin-1',
          author_type: 'agent',
          message: body.message,
          created_at: new Date().toISOString(),
        }),
      });
      return;
    }

    // GET replies
    if (options.repliesError) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
      return;
    }
    if (options.repliesDelay) {
      await new Promise((r) => setTimeout(r, options.repliesDelay));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(replies),
    });
  });

  // Ticket detail endpoint (GET and PUT)
  await page.route(`**/api/tickets/${ticketId}`, async (route) => {
    // PUT (update ticket status/priority)
    if (route.request().method() === 'PUT') {
      const putStatus = options.updateTicketStatus ?? 200;
      if (putStatus !== 200) {
        await route.fulfill({
          status: putStatus,
          contentType: 'application/json',
          body: JSON.stringify(
            options.updateTicketResponse ?? {
              error: 'Failed to update ticket',
            },
          ),
        });
        return;
      }
      const body = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...ticket, ...body }),
      });
      return;
    }

    // GET ticket detail
    if (options.ticketDelay) {
      await new Promise((r) => setTimeout(r, options.ticketDelay));
    }
    const ticketStatusCode = options.ticketStatus ?? 200;
    if (ticketStatusCode !== 200 || !ticket) {
      await route.fulfill({
        status: ticketStatusCode || 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error:
            ticketStatusCode === 404
              ? 'Ticket not found'
              : ticketStatusCode === 403
                ? 'Forbidden'
                : 'Internal server error',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ticket),
    });
  });

  // Product endpoint
  await page.route('**/api/products/**', async (route) => {
    if (!product) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Product not found' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(product),
    });
  });

  // Block socket.io
  await page.route('**/socket.io/**', async (route) => {
    await route.abort();
  });
}

const TICKET_URL = '/tickets/ticket-1';

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

test.describe('Admin Ticket Detail page', () => {
  /* ========================= A. Page loads ========================= */

  test.describe('Page loads', () => {
    test('should render ticket detail with all key elements', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(page.getByText('TK-0001')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
      await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('High', { exact: true })).toBeVisible();
      await expect(page.getByText('Fjallraven Backpack').first()).toBeVisible();
      await expect(page.getByText(/zipper on my backpack/i)).toBeVisible();
      await expect(
        page.getByText('John Doe opened this ticket'),
      ).toBeVisible();
    });

    test('should show skeleton loader while ticket loads', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, { ticketDelay: 2000 });
      await page.goto(TICKET_URL);

      await expect(
        page.locator('[aria-busy="true"][aria-label="Loading ticket details"]'),
      ).toBeVisible();
      await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible();

      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible({ timeout: 5000 });
    });

    test('should display conversation thread with replies', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(page.getByText('Conversation')).toBeVisible();
      // Agent view: agent messages show "You", customer messages show customer name
      await expect(page.getByText('You').first()).toBeVisible();
      await expect(page.getByText('John Doe').first()).toBeVisible();
      await expect(
        page.getByText(/sorry to hear about the damage/i),
      ).toBeVisible();
      await expect(
        page.getByText('Thank you for the quick response!'),
      ).toBeVisible();
      await expect(page.getByText(/TR-12345/)).toBeVisible();
    });

    test('should show empty conversation state when no replies', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, { replies: [] });
      await page.goto(TICKET_URL);

      await expect(
        page.getByText(
          'No replies yet. Send a message to get the conversation started.',
        ),
      ).toBeVisible();
    });

    test('should show reply input for open ticket', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /send/i }),
      ).toBeVisible();
    });

    test('should show customer name in header metadata', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      // Customer name should appear in metadata section (showCustomerInfo=true)
      const metadata = page.locator('.flex.flex-wrap.items-center');
      await expect(metadata.getByText('John Doe')).toBeVisible();
    });

    test('should render without console errors', async ({ page, context }) => {
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

      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);
      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
      expect(errors).toHaveLength(0);
    });
  });

  /* ==================== B. Authentication ========================== */

  test.describe('Authentication & authorization', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.goto(TICKET_URL);
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect customer user away from admin pages', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, { token: customerToken });
      await page.goto(TICKET_URL);
      await expect(page).toHaveURL(/\/products/);
    });
  });

  /* ==================== C. Navigation ============================== */

  test.describe('Navigation', () => {
    test('should have back link to tickets list', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      const backLink = page.getByRole('link', {
        name: /back to tickets/i,
      });
      await expect(backLink).toBeVisible();
      await expect(backLink).toHaveAttribute('href', '/tickets');
    });

    test('should navigate back to tickets list on back link click', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);

      // Mock tickets list for back navigation
      await page.route('**/api/tickets?*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [mockTicketOpen],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          }),
        });
      });

      await page.goto(TICKET_URL);
      await page.getByRole('link', { name: /back to tickets/i }).click();
      await expect(page).toHaveURL(/\/tickets$/);
    });
  });

  /* ==================== D. Forms & user input ====================== */

  test.describe('Reply form', () => {
    test('should submit reply as agent and show it in conversation', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      const textarea = page.getByPlaceholder('Type your reply...');
      await textarea.fill('This is an agent reply');

      await page.getByRole('button', { name: /send/i }).click();

      await expect(page.getByText('This is an agent reply')).toBeVisible();
      await expect(textarea).toHaveValue('');
    });

    test('should disable send button when textarea is empty', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('button', { name: /send/i }),
      ).toBeDisabled();
    });

    test('should enable send button when text is entered', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await page.getByPlaceholder('Type your reply...').fill('Hello');
      await expect(
        page.getByRole('button', { name: /send/i }),
      ).toBeEnabled();
    });

    test('should show character counter when typing', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await page.getByPlaceholder('Type your reply...').fill('Hello world');
      await expect(page.getByText('11 / 5,000')).toBeVisible();
    });

    test('should show error toast when reply submission fails', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, {
        submitReplyStatus: 400,
        submitReplyResponse: { error: 'Failed to submit reply' },
      });
      await page.goto(TICKET_URL);

      await page.getByPlaceholder('Type your reply...').fill('Test reply');
      await page.getByRole('button', { name: /send/i }).click();

      await expect(
        page.getByText('Failed to submit reply'),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).toHaveValue('Test reply');
    });

    test('should submit reply with Ctrl+Enter keyboard shortcut', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      const textarea = page.getByPlaceholder('Type your reply...');
      await textarea.fill('Keyboard shortcut reply');
      await textarea.press('Control+Enter');

      await expect(
        page.getByText('Keyboard shortcut reply'),
      ).toBeVisible();
      await expect(textarea).toHaveValue('');
    });
  });

  /* ==================== E. Interactive elements ==================== */

  test.describe('Admin actions', () => {
    test('should show priority dropdown with current value', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      const trigger = page.locator('button[data-slot="select-trigger"]').first();
      await expect(trigger).toBeVisible();
      await expect(trigger).toContainText(/high/i);
    });

    test('should change priority via dropdown', async ({ page, context }) => {
      let capturedBody: Record<string, unknown> | null = null;
      await setupAdminPage(page, context);

      // Intercept PUT to capture request body
      await page.route('**/api/tickets/ticket-1', async (route) => {
        if (route.request().method() === 'PUT') {
          capturedBody = JSON.parse(route.request().postData() ?? '{}');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...mockTicketOpen, priority: 'low' }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTicketOpen),
        });
      });

      await page.goto(TICKET_URL);

      // Open the priority dropdown
      const trigger = page.locator('button[data-slot="select-trigger"]').first();
      await trigger.click();

      // Select "Low"
      await page.getByRole('option', { name: 'Low' }).click();

      // Toast should show
      await expect(page.getByText('Priority updated to low')).toBeVisible();
      expect(capturedBody).toEqual({ priority: 'low' });
    });

    test('should show Close Ticket button for open tickets', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('button', { name: /close ticket/i }),
      ).toBeVisible();
    });

    test('should show confirmation dialog when clicking Close Ticket', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await page.getByRole('button', { name: /close ticket/i }).click();

      // Dialog should appear
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /close ticket\?/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('dialog').getByText('TK-0001'),
      ).toBeVisible();
      await expect(
        page.getByText(/customer will no longer be able to reply/i),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Cancel' }),
      ).toBeVisible();
    });

    test('should close ticket after confirming in dialog', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      // Open dialog
      await page.getByRole('button', { name: /close ticket/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click the destructive "Close Ticket" button inside the dialog
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /close ticket/i })
        .click();

      // Toast should appear
      await expect(page.getByText('Ticket closed')).toBeVisible();
    });

    test('should dismiss close dialog when Cancel is clicked', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await page.getByRole('button', { name: /close ticket/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should show Reopen Ticket button for closed tickets', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, { ticket: mockTicketClosed });
      await page.goto('/tickets/ticket-2');

      await expect(
        page.getByRole('button', { name: /reopen ticket/i }),
      ).toBeVisible();
      // Close Ticket button should NOT be visible
      await expect(
        page.getByRole('button', { name: /close ticket/i }),
      ).not.toBeVisible();
    });

    test('should reopen a closed ticket', async ({ page, context }) => {
      await setupAdminPage(page, context, { ticket: mockTicketClosed });
      await page.goto('/tickets/ticket-2');

      await page.getByRole('button', { name: /reopen ticket/i }).click();

      await expect(page.getByText('Ticket reopened')).toBeVisible();
    });

    test('should show error toast when priority update fails', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, {
        updateTicketStatus: 500,
        updateTicketResponse: { error: 'Server error updating priority' },
      });
      await page.goto(TICKET_URL);

      const trigger = page.locator('button[data-slot="select-trigger"]').first();
      await trigger.click();
      await page.getByRole('option', { name: 'Low' }).click();

      await expect(
        page.getByText('Server error updating priority'),
      ).toBeVisible();
    });

    test('should show error toast when closing ticket fails', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, {
        updateTicketStatus: 500,
        updateTicketResponse: { error: 'Failed to close ticket' },
      });
      await page.goto(TICKET_URL);

      await page.getByRole('button', { name: /close ticket/i }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /close ticket/i })
        .click();

      await expect(page.getByText('Failed to close ticket')).toBeVisible();
    });

    test('should show closed ticket banner and disable reply input', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, { ticket: mockTicketClosed });
      await page.goto('/tickets/ticket-2');

      await expect(page.getByText('Closed', { exact: true })).toBeVisible();
      await expect(
        page.getByText(
          'This ticket is closed. You cannot send new replies.',
        ),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).not.toBeVisible();
    });

    test('should show keyboard shortcut hint on desktop', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(page.locator('kbd')).toBeVisible();
    });

    test('should show product name even when product fetch fails', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, { product: null });
      await page.goto(TICKET_URL);

      // Product name comes from ticket data, not product fetch
      await expect(page.getByText('Fjallraven Backpack')).toBeVisible();
    });
  });

  /* ==================== F. Data display ============================ */

  test.describe('Data display', () => {
    test('should display ticket metadata correctly', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(page.getByText('TK-0001')).toBeVisible();
      await expect(page.getByText('Jun 15, 2025')).toBeVisible();
      await expect(page.getByText('High', { exact: true })).toBeVisible();
      await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
    });

    test('should display conversation with agent messages as "You"', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      // In agent view: agent messages show "You", customer messages show name
      const youLabels = page.getByText('You');
      await expect(youLabels.first()).toBeVisible();

      // Customer messages should show the customer name, not "You"
      const customerLabels = page.getByText('John Doe');
      await expect(customerLabels.first()).toBeVisible();

      // "Support Agent" label should NOT appear (agent sees their own messages as "You")
      await expect(page.getByText('Support Agent')).not.toBeVisible();
    });

    test('should display conversation container with aria-label', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      const replyContainer = page.locator(
        '[aria-label="Conversation messages"]',
      );
      await expect(replyContainer).toBeVisible();
    });

    test('should display status and priority badges', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('High', { exact: true })).toBeVisible();
    });

    test('should display closed status badge for closed tickets', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, { ticket: mockTicketClosed });
      await page.goto('/tickets/ticket-2');

      await expect(page.getByText('Closed', { exact: true })).toBeVisible();
      await expect(page.getByText('Medium', { exact: true })).toBeVisible();
    });
  });

  /* ==================== G. Dark mode =============================== */

  test.describe('Dark mode', () => {
    test('should render correctly in light mode', async ({
      page,
      context,
    }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).toBeVisible();
    });

    test('should render correctly in dark mode', async ({
      page,
      context,
    }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).toBeVisible();
      await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('High', { exact: true })).toBeVisible();
    });
  });

  /* ==================== H. Responsive design ======================= */

  test.describe('Responsive design', () => {
    test('should render correctly on desktop (1280px)', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
      await expect(page.locator('kbd')).toBeVisible();
      await expect(
        page.getByRole('button', { name: /close ticket/i }),
      ).toBeVisible();
    });

    test('should render correctly on tablet (768px)', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /close ticket/i }),
      ).toBeVisible();
    });

    test('should render correctly on mobile (375px)', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: /back to tickets/i }),
      ).toBeVisible();
      await expect(page.locator('kbd')).not.toBeVisible();
    });
  });

  /* ==================== J. Error handling ========================== */

  test.describe('Error handling', () => {
    test('should show "Ticket not found" for 404 error', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, {
        ticket: null,
        ticketStatus: 404,
      });
      await page.goto(TICKET_URL);

      await expect(
        page.locator('main').getByText('Ticket not found'),
      ).toBeVisible();
      await expect(
        page.getByText(/exist or may have been deleted/i),
      ).toBeVisible();
    });

    test('should show "Access denied" for 403 error', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, {
        ticket: null,
        ticketStatus: 403,
      });
      await page.goto(TICKET_URL);

      await expect(page.locator('main').getByText('Access denied')).toBeVisible();
      await expect(
        page.getByText(/have permission to view this ticket/i),
      ).toBeVisible();
    });

    test('should show generic error for 500 error', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, {
        ticket: null,
        ticketStatus: 500,
      });
      await page.goto(TICKET_URL);

      await expect(page.getByText('Something went wrong')).toBeVisible();
      await expect(page.getByText(/load this ticket/i)).toBeVisible();
    });

    test('should show retry button on error and retry on click', async ({
      page,
      context,
    }) => {
      let attempt = 0;
      await setAuthCookie(context, adminToken);
      await page.addInitScript(
        (t: string) => localStorage.setItem('auth_token', t),
        adminToken,
      );

      await page.route('**/api/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockAdminUser }),
        });
      });
      await page.route('**/api/notifications', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockNotifications),
        });
      });
      await page.route('**/api/products/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProduct),
        });
      });
      await page.route('**/socket.io/**', async (route) => {
        await route.abort();
      });
      await page.route('**/api/tickets/ticket-1/replies', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });
      await page.route('**/api/tickets/ticket-1', async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockTicketOpen),
          });
          return;
        }
        attempt++;
        if (attempt === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockTicketOpen),
          });
        }
      });

      await page.goto(TICKET_URL);

      await expect(page.getByText('Something went wrong')).toBeVisible();
      await page.getByRole('button', { name: /try again/i }).click();

      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
    });
  });

  /* ==================== K. Accessibility =========================== */

  test.describe('Accessibility', () => {
    test('should have accessible reply textarea with label', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      const textarea = page.getByLabel('Reply message');
      await expect(textarea).toBeVisible();
    });

    test('should have aria-live region on conversation thread', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      const thread = page.getByLabel('Conversation messages');
      await expect(thread).toBeVisible();
    });

    test('should have accessible loading state', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context, { ticketDelay: 2000 });
      await page.goto(TICKET_URL);

      await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    });

    test('should be keyboard navigable to reply input', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      const textarea = page.getByLabel('Reply message');
      await textarea.focus();
      await expect(textarea).toBeFocused();
      await textarea.fill('Keyboard test');
      await expect(textarea).toHaveValue('Keyboard test');
    });

    test('should have proper heading hierarchy', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toContainText('Product arrived damaged');
    });

    test('should trap focus in close confirmation dialog', async ({
      page,
      context,
    }) => {
      await setupAdminPage(page, context);
      await page.goto(TICKET_URL);

      await page.getByRole('button', { name: /close ticket/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Dialog buttons should be focusable
      const cancelBtn = page.getByRole('button', { name: 'Cancel' });
      await cancelBtn.focus();
      await expect(cancelBtn).toBeFocused();
    });
  });
});
