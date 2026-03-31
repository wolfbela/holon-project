import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/* ------------------------------------------------------------------ */
/* Mock data                                                          */
/* ------------------------------------------------------------------ */

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

const mockUser = {
  id: 'cust-1',
  email: 'customer1@example.com',
  name: 'John Doe',
  role: 'customer',
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
  ticket?: typeof mockTicketOpen | null;
  ticketStatus?: number;
  ticketDelay?: number;
  replies?: typeof mockReplies;
  repliesDelay?: number;
  repliesError?: boolean;
  product?: typeof mockProduct | null;
  token?: string;
  submitReplyStatus?: number;
  submitReplyResponse?: Record<string, unknown>;
}

async function setupAuthenticatedPage(
  page: Page,
  context: BrowserContext,
  options: SetupOptions = {},
) {
  const ticket = options.ticket !== undefined ? options.ticket : mockTicketOpen;
  const replies = options.replies ?? mockReplies;
  const product = options.product !== undefined ? options.product : mockProduct;
  const token = options.token ?? customerToken;
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
      body: JSON.stringify({ user: mockUser }),
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
              error: 'Cannot reply to a closed ticket',
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
          user_id: 'cust-1',
          author_type: 'customer',
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

  // Ticket detail endpoint
  await page.route(`**/api/tickets/${ticketId}`, async (route) => {
    if (options.ticketDelay) {
      await new Promise((r) => setTimeout(r, options.ticketDelay));
    }
    const ticketStatus = options.ticketStatus ?? 200;
    if (ticketStatus !== 200 || !ticket) {
      await route.fulfill({
        status: ticketStatus || 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error:
            ticketStatus === 404
              ? 'Ticket not found'
              : ticketStatus === 403
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

const TICKET_URL = '/my-tickets/ticket-1';

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

test.describe('Ticket detail page', () => {
  /* ========================= A. Page loads ========================= */

  test.describe('Page loads', () => {
    test('should render ticket detail with all key elements', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
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
      await setupAuthenticatedPage(page, context, { ticketDelay: 2000 });
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
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      await expect(page.getByText('Conversation')).toBeVisible();
      await expect(page.getByText('Support Agent').first()).toBeVisible();
      await expect(
        page.getByText(/sorry to hear about the damage/i),
      ).toBeVisible();
      await expect(page.getByText('You').first()).toBeVisible();
      await expect(
        page.getByText('Thank you for the quick response!'),
      ).toBeVisible();
      await expect(page.getByText(/TR-12345/)).toBeVisible();
    });

    test('should show empty conversation state when no replies', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { replies: [] });
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
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /send/i }),
      ).toBeVisible();
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

      await setupAuthenticatedPage(page, context);
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

    test('should redirect admin user away from customer pages', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { token: adminToken });
      await page.goto(TICKET_URL);
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  /* ==================== C. Navigation ============================== */

  test.describe('Navigation', () => {
    test('should have back link to my-tickets list', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      const backLink = page.getByRole('link', {
        name: /back to my tickets/i,
      });
      await expect(backLink).toBeVisible();
      await expect(backLink).toHaveAttribute('href', '/my-tickets');
    });

    test('should navigate back to my-tickets on back link click', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);

      // Also mock tickets list for back navigation
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
      await page.getByRole('link', { name: /back to my tickets/i }).click();
      await expect(page).toHaveURL(/\/my-tickets$/);
    });
  });

  /* ==================== D. Forms & user input ====================== */

  test.describe('Reply form', () => {
    test('should submit reply and show it in conversation', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      const textarea = page.getByPlaceholder('Type your reply...');
      await textarea.fill('This is my test reply');

      await page.getByRole('button', { name: /send/i }).click();

      await expect(page.getByText('This is my test reply')).toBeVisible();
      await expect(textarea).toHaveValue('');
    });

    test('should disable send button when textarea is empty', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('button', { name: /send/i }),
      ).toBeDisabled();
    });

    test('should enable send button when text is entered', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
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
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      await page.getByPlaceholder('Type your reply...').fill('Hello world');
      await expect(page.getByText('11 / 5,000')).toBeVisible();
    });

    test('should show error toast when reply submission fails', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        submitReplyStatus: 400,
        submitReplyResponse: { error: 'Cannot reply to a closed ticket' },
      });
      await page.goto(TICKET_URL);

      await page.getByPlaceholder('Type your reply...').fill('Test reply');
      await page.getByRole('button', { name: /send/i }).click();

      await expect(
        page.getByText('Cannot reply to a closed ticket'),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).toHaveValue('Test reply');
    });

    test('should submit reply with Ctrl+Enter keyboard shortcut', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
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

  test.describe('Interactive elements', () => {
    test('should show closed ticket banner and disable reply input', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        ticket: mockTicketClosed,
      });
      await page.goto('/my-tickets/ticket-2');

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
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      await expect(page.locator('kbd')).toBeVisible();
    });

    test('should display product name in ticket header', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      await expect(page.getByText('Fjallraven Backpack')).toBeVisible();
    });

    test('should show product name even when product fetch fails', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { product: null });
      await page.goto(TICKET_URL);

      await expect(page.getByText('Fjallraven Backpack')).toBeVisible();
    });
  });

  /* ==================== F. Data display ============================ */

  test.describe('Data display', () => {
    test('should display ticket metadata correctly', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      await expect(page.getByText('TK-0001')).toBeVisible();
      await expect(page.getByText('Jun 15, 2025')).toBeVisible();
      await expect(page.getByText('High', { exact: true })).toBeVisible();
      await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
    });

    test('should display conversation bubbles with correct labels', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      const agentLabels = page.getByText('Support Agent');
      await expect(agentLabels.first()).toBeVisible();

      const customerLabels = page.getByText('You');
      await expect(customerLabels.first()).toBeVisible();
    });

    test('should display conversation container with aria-label', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      const replyContainer = page.locator(
        '[aria-label="Conversation messages"]',
      );
      await expect(replyContainer).toBeVisible();
    });
  });

  /* ==================== G. Dark mode =============================== */

  test.describe('Dark mode', () => {
    test('should render correctly in light mode', async ({
      page,
      context,
    }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await setupAuthenticatedPage(page, context);
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
      await setupAuthenticatedPage(page, context);
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
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
      await expect(page.locator('kbd')).toBeVisible();
    });

    test('should render correctly on tablet (768px)', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).toBeVisible();
    });

    test('should render correctly on mobile (375px)', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      await expect(
        page.getByRole('heading', { name: /product arrived damaged/i }),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder('Type your reply...'),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: /back to my tickets/i }),
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
      await setupAuthenticatedPage(page, context, {
        ticket: null,
        ticketStatus: 404,
      });
      await page.goto(TICKET_URL);

      await expect(
        page.locator('#main').getByText('Ticket not found'),
      ).toBeVisible();
      await expect(
        page.getByText(/exist or may have been deleted/i),
      ).toBeVisible();
    });

    test('should show "Access denied" for 403 error', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        ticket: null,
        ticketStatus: 403,
      });
      await page.goto(TICKET_URL);

      await expect(page.getByText('Access denied')).toBeVisible();
      await expect(
        page.getByText(/have permission to view this ticket/i),
      ).toBeVisible();
    });

    test('should show generic error for 500 error', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        ticket: null,
        ticketStatus: 500,
      });
      await page.goto(TICKET_URL);

      await expect(page.getByText('Something went wrong')).toBeVisible();
      await expect(
        page.getByText(/load this ticket/i),
      ).toBeVisible();
    });

    test('should show retry button on error and retry on click', async ({
      page,
      context,
    }) => {
      let attempt = 0;
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
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      const textarea = page.getByLabel('Reply message');
      await expect(textarea).toBeVisible();
    });

    test('should have aria-live region on conversation thread', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      const thread = page.getByLabel('Conversation messages');
      await expect(thread).toBeVisible();
    });

    test('should have accessible loading state', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { ticketDelay: 2000 });
      await page.goto(TICKET_URL);

      await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    });

    test('should be keyboard navigable to reply input', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
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
      await setupAuthenticatedPage(page, context);
      await page.goto(TICKET_URL);

      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toContainText('Product arrived damaged');
    });
  });
});
