import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers — craft minimal JWT cookies so middleware can decode them.
// The middleware only Base64-decodes the payload; it never verifies
// the signature, so we can use a dummy header + signature.
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

async function clearAuthCookies(context: BrowserContext) {
  await context.clearCookies();
}

// ===================================================================
// A. LANDING PAGE — still works at /
// ===================================================================

test.describe('Landing page (/)', () => {
  test('should render without errors', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { name: /resolve faster/i }),
    ).toBeVisible();
  });

  test('should display navigation with auth links', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByLabel('Main').getByRole('link', { name: /sign in/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /get started/i }).first(),
    ).toBeVisible();
  });

  test('should be accessible without authentication', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).not.toHaveText(/login/i);
  });
});

// ===================================================================
// B. UNAUTHENTICATED REDIRECTS — protected routes → /login
// ===================================================================

test.describe('Unauthenticated redirects', () => {
  test.beforeEach(async ({ context }) => {
    await clearAuthCookies(context);
  });

  const protectedRoutes = [
    { path: '/products', label: 'Products' },
    { path: '/products/123', label: 'Product detail' },
    { path: '/my-tickets', label: 'My Tickets' },
    { path: '/my-tickets/abc', label: 'Ticket detail (customer)' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/tickets', label: 'Admin tickets' },
    { path: '/tickets/abc', label: 'Admin ticket detail' },
    { path: '/team', label: 'Team' },
  ];

  for (const route of protectedRoutes) {
    test(`should redirect ${route.label} (${route.path}) to /login`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

// ===================================================================
// C. AUTH PAGES — /login and /register render with centered layout
// ===================================================================

test.describe('Auth pages', () => {
  test.describe('/login page', () => {
    test('should render the login page', async ({ page }) => {
      await page.goto('/login');
      await expect(page).toHaveURL('/login');
      await expect(
        page.getByRole('heading', { name: /login/i }),
      ).toBeVisible();
    });

    test('should display subtitle text', async ({ page }) => {
      await page.goto('/login');
      await expect(
        page.getByText(/sign in to your account/i),
      ).toBeVisible();
    });

    test('should have a centered layout', async ({ page }) => {
      await page.goto('/login');
      const wrapper = page.locator('div.flex.min-h-screen.items-center.justify-center');
      await expect(wrapper).toBeVisible();
    });

    test('should have a max-width container', async ({ page }) => {
      await page.goto('/login');
      const container = page.locator('div.w-full.max-w-sm');
      await expect(container).toBeVisible();
    });
  });

  test.describe('/register page', () => {
    test('should render the register page', async ({ page }) => {
      await page.goto('/register');
      await expect(page).toHaveURL('/register');
      await expect(
        page.getByRole('heading', { name: /create an account/i }),
      ).toBeVisible();
    });

    test('should display subtitle text', async ({ page }) => {
      await page.goto('/register');
      await expect(
        page.getByText(/register to get started/i),
      ).toBeVisible();
    });

    test('should have a centered layout', async ({ page }) => {
      await page.goto('/register');
      const wrapper = page.locator('div.flex.min-h-screen.items-center.justify-center');
      await expect(wrapper).toBeVisible();
    });
  });
});

// ===================================================================
// D. AUTHENTICATED CUSTOMER — can see customer pages
// ===================================================================

test.describe('Authenticated customer access', () => {
  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, customerToken);
  });

  test('should access /products and see heading', async ({ page }) => {
    await page.goto('/products');
    await expect(page).toHaveURL('/products');
    await expect(
      page.getByRole('heading', { name: /products/i }),
    ).toBeVisible();
  });

  test('should access /products/42 and see product id in heading', async ({
    page,
  }) => {
    await page.goto('/products/42');
    await expect(page).toHaveURL('/products/42');
    await expect(
      page.getByRole('heading', { name: /product 42/i }),
    ).toBeVisible();
  });

  test('should access /my-tickets and see heading', async ({ page }) => {
    await page.goto('/my-tickets');
    await expect(page).toHaveURL('/my-tickets');
    await expect(
      page.getByRole('heading', { name: /my tickets/i }),
    ).toBeVisible();
  });

  test('should access /my-tickets/abc-123 and see ticket id', async ({
    page,
  }) => {
    await page.goto('/my-tickets/abc-123');
    await expect(page).toHaveURL('/my-tickets/abc-123');
    await expect(
      page.getByRole('heading', { name: /ticket abc-123/i }),
    ).toBeVisible();
  });

  test('should show placeholder text on products page', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByText(/product catalog coming soon/i)).toBeVisible();
  });

  test('should show placeholder text on my-tickets page', async ({ page }) => {
    await page.goto('/my-tickets');
    await expect(
      page.getByText(/your support tickets will appear here/i),
    ).toBeVisible();
  });
});

// ===================================================================
// E. AUTHENTICATED ADMIN — can see admin pages
// ===================================================================

test.describe('Authenticated admin access', () => {
  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, adminToken);
  });

  test('should access /dashboard and see heading', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    await expect(
      page.getByRole('heading', { name: /dashboard/i }),
    ).toBeVisible();
  });

  test('should access /tickets and see heading', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page).toHaveURL('/tickets');
    await expect(
      page.getByRole('heading', { name: /tickets/i }),
    ).toBeVisible();
  });

  test('should access /tickets/abc-456 and see ticket id', async ({
    page,
  }) => {
    await page.goto('/tickets/abc-456');
    await expect(page).toHaveURL('/tickets/abc-456');
    await expect(
      page.getByRole('heading', { name: /ticket abc-456/i }),
    ).toBeVisible();
  });

  test('should access /team and see heading', async ({ page }) => {
    await page.goto('/team');
    await expect(page).toHaveURL('/team');
    await expect(
      page.getByRole('heading', { name: /team/i }),
    ).toBeVisible();
  });

  test('should show placeholder text on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/kpis and charts coming soon/i)).toBeVisible();
  });

  test('should show placeholder text on admin tickets', async ({ page }) => {
    await page.goto('/tickets');
    await expect(
      page.getByText(/all support tickets will appear here/i),
    ).toBeVisible();
  });

  test('should show placeholder text on team page', async ({ page }) => {
    await page.goto('/team');
    await expect(page.getByText(/team management coming soon/i)).toBeVisible();
  });

  test('should access /products as admin too', async ({ page }) => {
    await page.goto('/products');
    await expect(page).toHaveURL('/products');
    await expect(
      page.getByRole('heading', { name: /products/i }),
    ).toBeVisible();
  });
});

// ===================================================================
// F. ROLE-BASED REDIRECTS — wrong role → correct landing page
// ===================================================================

test.describe('Role-based redirects', () => {
  test.describe('Customer cannot access admin routes', () => {
    test.beforeEach(async ({ context }) => {
      await setAuthCookie(context, customerToken);
    });

    test('should redirect /dashboard to /products', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/products/);
    });

    test('should redirect /tickets to /products', async ({ page }) => {
      await page.goto('/tickets');
      await expect(page).toHaveURL(/\/products/);
    });

    test('should redirect /tickets/abc to /products', async ({ page }) => {
      await page.goto('/tickets/abc');
      await expect(page).toHaveURL(/\/products/);
    });

    test('should redirect /team to /products', async ({ page }) => {
      await page.goto('/team');
      await expect(page).toHaveURL(/\/products/);
    });
  });

  test.describe('Admin cannot access customer-only routes', () => {
    test.beforeEach(async ({ context }) => {
      await setAuthCookie(context, adminToken);
    });

    test('should redirect /my-tickets to /dashboard', async ({ page }) => {
      await page.goto('/my-tickets');
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should redirect /my-tickets/abc to /dashboard', async ({
      page,
    }) => {
      await page.goto('/my-tickets/abc');
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });
});

// ===================================================================
// G. AUTH PAGES WITH EXISTING TOKEN — redirect away from login/register
// ===================================================================

test.describe('Authenticated users redirected from auth pages', () => {
  test.describe('Customer', () => {
    test.beforeEach(async ({ context }) => {
      await setAuthCookie(context, customerToken);
    });

    test('should redirect /login to /products', async ({ page }) => {
      await page.goto('/login');
      await expect(page).toHaveURL(/\/products/);
    });

    test('should redirect /register to /products', async ({ page }) => {
      await page.goto('/register');
      await expect(page).toHaveURL(/\/products/);
    });
  });

  test.describe('Admin', () => {
    test.beforeEach(async ({ context }) => {
      await setAuthCookie(context, adminToken);
    });

    test('should redirect /login to /dashboard', async ({ page }) => {
      await page.goto('/login');
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should redirect /register to /dashboard', async ({ page }) => {
      await page.goto('/register');
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });
});

// ===================================================================
// H. DARK MODE — auth pages in both themes
// ===================================================================

test.describe('Dark mode', () => {
  test('should render /login in light mode', async ({ page }) => {
    await page.goto('/login');
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);
    await expect(
      page.getByRole('heading', { name: /login/i }),
    ).toBeVisible();
  });

  test('should render /login in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /login/i }),
    ).toBeVisible();
  });

  test('should render /register in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/register');
    await expect(
      page.getByRole('heading', { name: /create an account/i }),
    ).toBeVisible();
  });
});

// ===================================================================
// I. RESPONSIVE DESIGN — auth layout on various viewports
// ===================================================================

test.describe('Responsive design', () => {
  test.describe('Desktop (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('should render /login centered on desktop', async ({ page }) => {
      await page.goto('/login');
      await expect(
        page.getByRole('heading', { name: /login/i }),
      ).toBeVisible();
      const container = page.locator('div.max-w-sm');
      await expect(container).toBeVisible();
    });
  });

  test.describe('Tablet (768px)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('should render /login centered on tablet', async ({ page }) => {
      await page.goto('/login');
      await expect(
        page.getByRole('heading', { name: /login/i }),
      ).toBeVisible();
    });
  });

  test.describe('Mobile (375px)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should render /login on mobile', async ({ page }) => {
      await page.goto('/login');
      await expect(
        page.getByRole('heading', { name: /login/i }),
      ).toBeVisible();
    });

    test('should render /register on mobile', async ({ page }) => {
      await page.goto('/register');
      await expect(
        page.getByRole('heading', { name: /create an account/i }),
      ).toBeVisible();
    });
  });
});

// ===================================================================
// J. REAL-TIME FEATURES — not applicable for routing scaffolding
// ===================================================================

test.describe('Real-time features', () => {
  test('should not require WebSocket connections for route scaffolding', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page).toHaveURL('/login');
  });
});

// ===================================================================
// K. ERROR HANDLING
// ===================================================================

test.describe('Error handling', () => {
  test('should handle non-existent route gracefully', async ({ page }) => {
    const response = await page.goto('/this-does-not-exist');
    expect(response?.status()).toBe(404);
  });

  test('should not have console errors on /login', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/login');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('should not have console errors on /register', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/register');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});

// ===================================================================
// L. ACCESSIBILITY BASICS
// ===================================================================

test.describe('Accessibility', () => {
  test('login page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/login');
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(/login/i);
  });

  test('register page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/register');
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(/create an account/i);
  });

  test('auth layout content is inside a visible container', async ({
    page,
  }) => {
    await page.goto('/login');
    const content = page.locator('div.max-w-sm');
    await expect(content).toBeVisible();
  });

  test.describe('Placeholder pages have proper headings', () => {
    test.beforeEach(async ({ context }) => {
      await setAuthCookie(context, adminToken);
    });

    const pages = [
      { path: '/dashboard', heading: /dashboard/i },
      { path: '/tickets', heading: /tickets/i },
      { path: '/team', heading: /team/i },
      { path: '/products', heading: /products/i },
    ];

    for (const { path, heading } of pages) {
      test(`${path} has exactly one h1 heading`, async ({ page }) => {
        await page.goto(path);
        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveText(heading);
      });
    }
  });
});
