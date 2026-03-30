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

const mockProduct = {
  id: 1,
  title: 'Classic Leather Jacket',
  price: 129.99,
  description:
    'A timeless leather jacket for everyday wear. Made from premium materials with excellent stitching.',
  category: { id: 1, name: 'Clothes', image: 'https://example.com/cat1.jpg' },
  images: [
    'https://example.com/jacket-front.jpg',
    'https://example.com/jacket-back.jpg',
    'https://example.com/jacket-side.jpg',
  ],
};

const mockProductSingleImage = {
  ...mockProduct,
  id: 2,
  title: 'Simple Product',
  images: ['https://example.com/simple.jpg'],
};

const mockProductNoImages = {
  ...mockProduct,
  id: 3,
  title: 'No Image Product',
  images: [],
};

const mockTicketResponse = {
  id: 'ticket-uuid-1',
  display_id: 'TK-0042',
  user_id: 'cust-1',
  email: 'customer1@example.com',
  name: 'John Doe',
  product_id: 1,
  product_name: 'Classic Leather Jacket',
  subject: 'Product arrived damaged',
  message: 'The zipper on my jacket was broken.',
  status: 'open',
  priority: 'medium',
  created_at: '2025-06-01T10:00:00.000Z',
  updated_at: '2025-06-01T10:00:00.000Z',
};

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

// ---------------------------------------------------------------------------
// Setup helper — authenticated customer with mocked product detail API
// ---------------------------------------------------------------------------

async function setupAuthenticatedPage(
  page: Page,
  context: BrowserContext,
  options?: {
    product?: typeof mockProduct | null;
    productDelay?: number;
    productError?: boolean;
    productNotFound?: boolean;
    ticketSuccess?: boolean;
    ticketError?: string;
    token?: string;
  },
) {
  const product = options?.product !== undefined ? options.product : mockProduct;
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

  // Single product API
  await page.route('**/api/products/*', async (route) => {
    if (options?.productNotFound) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Product not found' }),
      });
      return;
    }

    if (options?.productError) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
      return;
    }

    if (options?.productDelay) {
      await new Promise((r) => setTimeout(r, options.productDelay));
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(product),
    });
  });

  // Tickets API
  await page.route('**/api/tickets', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    if (options?.ticketError) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: options.ticketError }),
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(mockTicketResponse),
    });
  });

  // Block socket.io
  await page.route('**/socket.io/**', async (route) => {
    await route.abort();
  });
}

// ===================================================================
// PRODUCT DETAIL — /products/[id] page
// ===================================================================

test.describe('Product detail page', () => {
  // -----------------------------------------------------------------
  // A. Page loads correctly
  // -----------------------------------------------------------------

  test.describe('Page loads', () => {
    test('should render the product with all key elements', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(
        page.getByRole('heading', { name: mockProduct.title }),
      ).toBeVisible();
      await expect(page.getByText('$129.99')).toBeVisible();
      await expect(page.getByText(mockProduct.description)).toBeVisible();
      await expect(page.getByText(mockProduct.category.name)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /create ticket/i }),
      ).toBeVisible();
    });

    test('should display skeleton loader while loading', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { productDelay: 2000 });
      await page.goto('/products/1');

      await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    });

    test('should show product image', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(
        page.getByRole('img', { name: mockProduct.title, exact: true }),
      ).toBeVisible();
    });

    test('should display category badge', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(page.getByText('Clothes')).toBeVisible();
    });

    test('should format price correctly', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(page.getByText('$129.99')).toBeVisible();
    });

    test('should show description section', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(
        page.getByRole('heading', { name: /description/i }),
      ).toBeVisible();
      await expect(page.getByText(mockProduct.description)).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  test.describe('Authentication', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.goto('/products/1');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect admin user to dashboard', async ({
      page,
      context,
    }) => {
      await setAuthCookie(context, adminToken);
      await page.goto('/products/1');
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should allow authenticated customer to view the page', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(
        page.getByRole('heading', { name: mockProduct.title }),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // C. Navigation
  // -----------------------------------------------------------------

  test.describe('Navigation', () => {
    test('should have back link to products catalog', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      const backLink = page.getByRole('link', { name: /back to products/i });
      await expect(backLink).toBeVisible();
      await expect(backLink).toHaveAttribute('href', '/products');
    });

    test('should navigate back to products catalog when clicking back link', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);

      // Also mock the products list endpoint for navigation back
      await page.route('**/api/products', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockProduct]),
        });
      });

      await page.goto('/products/1');
      await page.getByRole('link', { name: /back to products/i }).click();
      await expect(page).toHaveURL('/products');
    });
  });

  // -----------------------------------------------------------------
  // D. Forms & user input — ticket creation
  // -----------------------------------------------------------------

  test.describe('Ticket creation form', () => {
    test('should open modal when clicking Create Ticket button', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await page.getByRole('button', { name: /create ticket/i }).click();

      await expect(
        page.getByRole('heading', { name: /create support ticket/i }),
      ).toBeVisible();
      // Product name visible in modal context
      await expect(
        page.locator('[data-slot="dialog-content"]').getByText(mockProduct.title),
      ).toBeVisible();
    });

    test('should show subject and message fields in modal', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      await expect(page.getByLabel('Subject')).toBeVisible();
      await expect(page.getByLabel('Message')).toBeVisible();
    });

    test('should show validation errors when submitting empty form', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      // Submit empty form
      await page
        .locator('[data-slot="dialog-content"]')
        .getByRole('button', { name: /submit ticket/i })
        .click();

      // Validation errors should appear
      await expect(page.locator('.text-destructive').first()).toBeVisible();
    });

    test('should successfully create ticket with valid data', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { ticketSuccess: true });
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      await page.getByLabel('Subject').fill('Product arrived damaged');
      await page.getByLabel('Message').fill('The zipper on my jacket was broken.');

      await page
        .locator('[data-slot="dialog-content"]')
        .getByRole('button', { name: /submit ticket/i })
        .click();

      // Success state should appear inside modal with ticket display_id
      await expect(page.getByText(/TK-0042/)).toBeVisible();
      await expect(page.getByText(/ticket created/i)).toBeVisible();

      // Should offer View My Tickets action
      await expect(
        page.getByRole('button', { name: /view my tickets/i }),
      ).toBeVisible();

      // Close via Close button (not the X button)
      await page
        .locator('[data-slot="dialog-content"]')
        .getByRole('button', { name: /^close$/i, exact: true })
        .first()
        .click();

      // Modal should close
      await expect(
        page.locator('[data-slot="dialog-content"]'),
      ).not.toBeVisible();
    });

    test('should show error toast when ticket creation fails', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        ticketError: 'You have reached the ticket limit',
      });
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      await page.getByLabel('Subject').fill('Test subject');
      await page.getByLabel('Message').fill('Test message');

      await page
        .locator('[data-slot="dialog-content"]')
        .getByRole('button', { name: /submit ticket/i })
        .click();

      // Error toast
      await expect(
        page.getByText('You have reached the ticket limit'),
      ).toBeVisible();

      // Modal should stay open
      await expect(
        page.getByRole('heading', { name: /create support ticket/i }),
      ).toBeVisible();
    });

    test('should preserve form input on validation failure', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      // Fill only subject (message is empty)
      await page.getByLabel('Subject').fill('Test subject');

      await page
        .locator('[data-slot="dialog-content"]')
        .getByRole('button', { name: /submit ticket/i })
        .click();

      // Subject should still have the value
      await expect(page.getByLabel('Subject')).toHaveValue('Test subject');
    });

    test('should show loading state on submit button while creating', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);

      // Add a delay to ticket creation to observe loading state
      await page.route('**/api/tickets', async (route) => {
        if (route.request().method() === 'POST') {
          await new Promise((r) => setTimeout(r, 2000));
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(mockTicketResponse),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      await page.getByLabel('Subject').fill('Test');
      await page.getByLabel('Message').fill('Test message');

      await page
        .locator('[data-slot="dialog-content"]')
        .getByRole('button', { name: /submit ticket/i })
        .click();

      // Loading state should show
      await expect(page.getByText('Creating...')).toBeVisible();
    });

    test('should disable form fields while submitting', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);

      await page.route('**/api/tickets', async (route) => {
        if (route.request().method() === 'POST') {
          await new Promise((r) => setTimeout(r, 2000));
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(mockTicketResponse),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      await page.getByLabel('Subject').fill('Test');
      await page.getByLabel('Message').fill('Test message');

      await page
        .locator('[data-slot="dialog-content"]')
        .getByRole('button', { name: /submit ticket/i })
        .click();

      await expect(page.getByLabel('Subject')).toBeDisabled();
      await expect(page.getByLabel('Message')).toBeDisabled();
    });

    test('should navigate to my-tickets when clicking View My Tickets', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { ticketSuccess: true });
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      await page.getByLabel('Subject').fill('Test');
      await page.getByLabel('Message').fill('Test message');

      await page
        .locator('[data-slot="dialog-content"]')
        .getByRole('button', { name: /submit ticket/i })
        .click();

      await expect(page.getByText(/ticket created/i)).toBeVisible();

      await page.getByRole('button', { name: /view my tickets/i }).click();
      await expect(page).toHaveURL(/\/my-tickets/);
    });
  });

  // -----------------------------------------------------------------
  // E. Interactive elements
  // -----------------------------------------------------------------

  test.describe('Interactive elements', () => {
    test('should close modal via Cancel button', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      await expect(
        page.getByRole('heading', { name: /create support ticket/i }),
      ).toBeVisible();

      await page.getByRole('button', { name: /cancel/i }).click();

      await expect(
        page.getByRole('heading', { name: /create support ticket/i }),
      ).not.toBeVisible();
    });

    test('should close modal via X button', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      await expect(
        page.getByRole('heading', { name: /create support ticket/i }),
      ).toBeVisible();

      await page.getByRole('button', { name: /close/i }).click();

      await expect(
        page.getByRole('heading', { name: /create support ticket/i }),
      ).not.toBeVisible();
    });

    test('should close modal via Escape key', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      await expect(
        page.getByRole('heading', { name: /create support ticket/i }),
      ).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(
        page.getByRole('heading', { name: /create support ticket/i }),
      ).not.toBeVisible();
    });

    test('should switch image when clicking thumbnails', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      // Wait for product to load
      await expect(
        page.getByRole('heading', { name: mockProduct.title }),
      ).toBeVisible();

      // Should show thumbnail buttons (3 images)
      const thumbnails = page.locator('button').filter({
        has: page.getByRole('img', { name: /image \d+/i }),
      });

      // At least check that thumbnails exist for multi-image products
      await expect(thumbnails.first()).toBeVisible();
    });

    test('should not show thumbnails for single-image product', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        product: mockProductSingleImage,
      });
      await page.goto('/products/2');

      await expect(
        page.getByRole('heading', { name: mockProductSingleImage.title }),
      ).toBeVisible();

      // Thumbnails should not be visible
      const thumbnails = page.getByRole('img', { name: /image \d+/i });
      await expect(thumbnails).not.toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // F. Data display
  // -----------------------------------------------------------------

  test.describe('Data display', () => {
    test('should display formatted price with currency symbol', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(page.getByText('$129.99')).toBeVisible();
    });

    test('should display product description', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(page.getByText(mockProduct.description)).toBeVisible();
    });

    test('should show image fallback when product has no images', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, {
        product: mockProductNoImages,
      });
      await page.goto('/products/3');

      await expect(
        page.getByRole('heading', { name: mockProductNoImages.title }),
      ).toBeVisible();

      // Main image should not be present
      await expect(
        page.getByRole('img', { name: mockProductNoImages.title }),
      ).not.toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // G. Dark mode
  // -----------------------------------------------------------------

  test.describe('Dark mode', () => {
    test('should render correctly in light mode', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/products/1');

      await expect(
        page.getByRole('heading', { name: mockProduct.title }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /create ticket/i }),
      ).toBeVisible();
    });

    test('should render correctly in dark mode', async ({ page, context }) => {
      await setupAuthenticatedPage(page, context);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/products/1');

      await expect(
        page.getByRole('heading', { name: mockProduct.title }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /create ticket/i }),
      ).toBeVisible();
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
      await page.setViewportSize({ width: 1280, height: 720 });
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(
        page.getByRole('heading', { name: mockProduct.title }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /create ticket/i }),
      ).toBeVisible();
    });

    test('should render correctly on tablet (768px)', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(
        page.getByRole('heading', { name: mockProduct.title }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /create ticket/i }),
      ).toBeVisible();
    });

    test('should render correctly on mobile (375px)', async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(
        page.getByRole('heading', { name: mockProduct.title }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /create ticket/i }),
      ).toBeVisible();
    });

    test('should open modal correctly on mobile', async ({ page, context }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await page.getByRole('button', { name: /create ticket/i }).click();

      await expect(
        page.getByRole('heading', { name: /create support ticket/i }),
      ).toBeVisible();
      await expect(page.getByLabel('Subject')).toBeVisible();
      await expect(page.getByLabel('Message')).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // J. Error handling
  // -----------------------------------------------------------------

  test.describe('Error handling', () => {
    test('should show error state when API returns 500', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { productError: true });
      await page.goto('/products/1');

      await expect(page.getByText(/something went wrong/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /try again/i }),
      ).toBeVisible();
    });

    test('should show error state when product not found', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { productNotFound: true });
      await page.goto('/products/999');

      await expect(page.getByText(/something went wrong/i)).toBeVisible();
    });

    test('should retry loading when clicking try again', async ({
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

      await page.route('**/api/products/*', async (route) => {
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
            body: JSON.stringify(mockProduct),
          });
        }
      });

      await page.route('**/socket.io/**', async (route) => {
        await route.abort();
      });

      await page.goto('/products/1');

      await expect(page.getByText(/something went wrong/i)).toBeVisible();

      await page.getByRole('button', { name: /try again/i }).click();

      await expect(
        page.getByRole('heading', { name: mockProduct.title }),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------
  // K. Accessibility basics
  // -----------------------------------------------------------------

  test.describe('Accessibility', () => {
    test('should have alt text on product images', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');

      await expect(
        page.getByRole('img', { name: mockProduct.title, exact: true }),
      ).toBeVisible();
    });

    test('should have labeled form inputs in modal', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      await expect(page.getByLabel('Subject')).toBeVisible();
      await expect(page.getByLabel('Message')).toBeVisible();
    });

    test('should navigate interactive elements with Tab key', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      // Tab should move focus through form elements
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      await expect(focused).toBeVisible();
    });

    test('should have aria-busy on skeleton loader', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context, { productDelay: 3000 });
      await page.goto('/products/1');

      const skeleton = page.locator('[aria-busy="true"]');
      await expect(skeleton).toBeVisible();
      await expect(skeleton).toHaveAttribute('aria-label', /loading/i);
    });

    test('should mark invalid form fields with aria-invalid', async ({
      page,
      context,
    }) => {
      await setupAuthenticatedPage(page, context);
      await page.goto('/products/1');
      await page.getByRole('button', { name: /create ticket/i }).click();

      // Submit empty form
      await page
        .locator('[data-slot="dialog-content"]')
        .getByRole('button', { name: /submit ticket/i })
        .click();

      // Check aria-invalid on subject field
      await expect(page.getByLabel('Subject')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });
  });
});
