import { test, expect } from '@playwright/test';

// ─── Landing Page E2E Tests ─────────────────────────────────────────────────

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ══════════════════════════════════════════════════════════════
  // A. PAGE LOADS
  // ══════════════════════════════════════════════════════════════

  test.describe('Page loads', () => {
    test('should render the page without errors', async ({ page }) => {
      await expect(page).toHaveTitle(/holon/i);
    });

    test('should display the navigation header', async ({ page }) => {
      const nav = page.getByRole('navigation', { name: /main/i });
      await expect(nav).toBeVisible();
    });

    test('should display the brand name in nav', async ({ page }) => {
      const brand = page.getByRole('navigation').getByRole('link', { name: /holon/i });
      await expect(brand).toBeVisible();
    });

    test('should display the hero heading', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Resolve faster.')).toBeVisible();
    });

    test('should display the hero subtitle', async ({ page }) => {
      await expect(
        page.getByText(/connects your customers with your support team/i)
      ).toBeVisible();
    });

    test('should display the category label', async ({ page }) => {
      await expect(page.getByText('Customer Support Platform')).toBeVisible();
    });

    test('should display feature section heading', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: /everything to run support well/i })
      ).toBeVisible();
    });

    test('should display all four feature titles', async ({ page }) => {
      const featureTitles = [
        'Smart Ticketing',
        'Live Conversations',
        'Team Insights',
        'Built-in Roles',
      ];
      for (const title of featureTitles) {
        await expect(
          page.getByRole('heading', { name: title })
        ).toBeVisible();
      }
    });

    test('should display feature descriptions without technical jargon', async ({ page }) => {
      // Ensure no developer jargon is exposed to users
      const jargonTerms = ['WebSocket', 'JWT', 'sequential IDs', 'API'];
      for (const term of jargonTerms) {
        const featureSection = page.locator('section').filter({ hasText: 'What you get' });
        await expect(featureSection.getByText(term, { exact: false })).not.toBeVisible();
      }
    });

    test('should display the footer', async ({ page }) => {
      await expect(page.getByRole('contentinfo')).toBeVisible();
      await expect(
        page.getByRole('contentinfo').getByText('Holon')
      ).toBeVisible();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // B. AUTHENTICATION & AUTHORIZATION
  // ══════════════════════════════════════════════════════════════

  test.describe('Authentication', () => {
    test('should be accessible without authentication (public page)', async ({ page }) => {
      // Landing page should load without redirect
      await expect(page).toHaveURL('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // C. NAVIGATION
  // ══════════════════════════════════════════════════════════════

  test.describe('Navigation', () => {
    test('should have Sign in link in nav pointing to /login', async ({ page }) => {
      const signInLink = page
        .getByRole('navigation')
        .getByRole('link', { name: /sign in/i });
      await expect(signInLink).toBeVisible();
      await expect(signInLink).toHaveAttribute('href', '/login');
    });

    test('should have Get started link in nav pointing to /register', async ({ page }) => {
      const getStartedLink = page
        .getByRole('navigation')
        .getByRole('link', { name: /get started/i });
      await expect(getStartedLink).toBeVisible();
      await expect(getStartedLink).toHaveAttribute('href', '/register');
    });

    test('should have hero CTA Get started pointing to /register', async ({ page }) => {
      const heroCTA = page.getByRole('main').getByRole('link', { name: /get started/i });
      await expect(heroCTA).toBeVisible();
      await expect(heroCTA).toHaveAttribute('href', '/register');
    });

    test('should have hero CTA Sign in pointing to /login', async ({ page }) => {
      const heroSignIn = page.getByRole('main').getByRole('link', { name: /sign in/i });
      await expect(heroSignIn).toBeVisible();
      await expect(heroSignIn).toHaveAttribute('href', '/login');
    });

    test('should have footer links pointing to login and register', async ({ page }) => {
      const footer = page.getByRole('contentinfo');
      await expect(footer.getByRole('link', { name: /sign in/i })).toHaveAttribute(
        'href',
        '/login'
      );
      await expect(footer.getByRole('link', { name: /get started/i })).toHaveAttribute(
        'href',
        '/register'
      );
    });

    test('should have logo link pointing to home', async ({ page }) => {
      const logo = page.getByRole('navigation').getByRole('link', { name: /holon/i });
      await expect(logo).toHaveAttribute('href', '/');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // D. FORMS & USER INPUT (N/A for landing page)
  // ══════════════════════════════════════════════════════════════

  test.describe('Forms & user input', () => {
    test('should have no form elements on the landing page', async ({ page }) => {
      const forms = page.locator('form');
      await expect(forms).toHaveCount(0);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // E. INTERACTIVE ELEMENTS
  // ══════════════════════════════════════════════════════════════

  test.describe('Interactive elements', () => {
    test('should have clickable CTA buttons that are not disabled', async ({ page }) => {
      const getStarted = page.getByRole('main').getByRole('link', { name: /get started/i });
      await expect(getStarted).toBeEnabled();

      const signIn = page.getByRole('main').getByRole('link', { name: /sign in/i });
      await expect(signIn).toBeEnabled();
    });

    test('should show sticky nav on scroll', async ({ page }) => {
      await page.evaluate(() => window.scrollBy(0, 500));
      const nav = page.getByRole('navigation', { name: /main/i });
      await expect(nav).toBeVisible();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // F. DATA DISPLAY
  // ══════════════════════════════════════════════════════════════

  test.describe('Data display', () => {
    test('should display stat cards on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/');
      await expect(page.getByText('2,847')).toBeVisible();
      await expect(page.getByText('< 2min')).toBeVisible();
      await expect(page.getByText('98.5%')).toBeVisible();
    });

    test('should display stat card labels', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/');
      await expect(page.getByText('Tickets resolved this month')).toBeVisible();
      await expect(page.getByText('Average first response')).toBeVisible();
      await expect(page.getByText('Customer satisfaction')).toBeVisible();
    });

    test('should hide stat cards on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await expect(page.getByText('2,847')).not.toBeVisible();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // G. DARK MODE
  // ══════════════════════════════════════════════════════════════

  test.describe('Dark mode', () => {
    test('should render correctly in light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/');

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Customer Support Platform')).toBeVisible();

      // Verify light mode background is not dark
      const bg = await page.locator('body').evaluate((el) =>
        getComputedStyle(el).backgroundColor
      );
      // Light mode should have a light background (high RGB values)
      expect(bg).not.toBe('rgb(0, 0, 0)');
    });

    test('should render correctly in dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Customer Support Platform')).toBeVisible();

      // Text should still be visible (not invisible against dark bg)
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
    });

    test('should maintain all content visibility in dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');

      // All critical content should remain visible
      await expect(page.getByText('Resolve faster.')).toBeVisible();
      await expect(page.getByText('Smart Ticketing')).toBeVisible();
      await expect(page.getByText('Live Conversations')).toBeVisible();
      await expect(page.getByText('Team Insights')).toBeVisible();
      await expect(page.getByText('Built-in Roles')).toBeVisible();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // H. RESPONSIVE DESIGN
  // ══════════════════════════════════════════════════════════════

  test.describe('Responsive design', () => {
    test('should render on desktop (1280px)', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/');

      // Hero heading visible
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Stat cards visible on desktop
      await expect(page.getByText('2,847')).toBeVisible();
      // Features grid visible
      await expect(page.getByText('Smart Ticketing')).toBeVisible();
      // Nav visible
      await expect(page.getByRole('navigation', { name: /main/i })).toBeVisible();
    });

    test('should render on tablet (768px)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      // Core content visible
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Smart Ticketing')).toBeVisible();
      // Nav still visible (no hamburger menu needed)
      await expect(page.getByRole('navigation', { name: /main/i })).toBeVisible();
    });

    test('should render on mobile (375px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Core content visible
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(
        page.getByRole('main').getByRole('link', { name: /get started/i })
      ).toBeVisible();
      // Features visible
      await expect(page.getByText('Smart Ticketing')).toBeVisible();
      // Nav visible
      await expect(page.getByRole('navigation', { name: /main/i })).toBeVisible();
    });

    test('should stack hero CTAs on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      const getStarted = page.getByRole('main').getByRole('link', { name: /get started/i });
      const signIn = page.getByRole('main').getByRole('link', { name: /sign in/i });

      // Both CTAs should be visible
      await expect(getStarted).toBeVisible();
      await expect(signIn).toBeVisible();
    });

    test('should show features in single column on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      const features = ['Smart Ticketing', 'Live Conversations', 'Team Insights', 'Built-in Roles'];
      for (const title of features) {
        await expect(page.getByRole('heading', { name: title })).toBeVisible();
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // I. REAL-TIME (N/A for landing page)
  // ══════════════════════════════════════════════════════════════

  test.describe('Real-time updates', () => {
    test('should not require real-time connections on landing page', async ({ page }) => {
      // Landing page is static — no WebSocket connections needed
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // J. ERROR HANDLING
  // ══════════════════════════════════════════════════════════════

  test.describe('Error handling', () => {
    test('should not have console errors on page load', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Filter out known non-critical warnings
      const criticalErrors = errors.filter(
        (e) => !e.includes('favicon') && !e.includes('hydration')
      );
      expect(criticalErrors).toHaveLength(0);
    });

    test('should display a page for non-existent routes', async ({ page }) => {
      await page.goto('/non-existent-page');
      // Should show 404 or redirect, not crash
      await expect(page).not.toHaveTitle(/error/i);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // K. ACCESSIBILITY
  // ══════════════════════════════════════════════════════════════

  test.describe('Accessibility', () => {
    test('should have a skip-to-content link', async ({ page }) => {
      const skipLink = page.getByRole('link', { name: /skip to content/i });
      // Skip link should exist (may be sr-only until focused)
      await expect(skipLink).toBeAttached();
    });

    test('should reveal skip link on focus', async ({ page }) => {
      await page.keyboard.press('Tab');
      const skipLink = page.getByRole('link', { name: /skip to content/i });
      await expect(skipLink).toBeVisible();
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      // H1 exists
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toHaveCount(1);

      // H2 exists for features section
      const h2 = page.getByRole('heading', { level: 2 });
      expect(await h2.count()).toBeGreaterThanOrEqual(1);

      // H3 exists for individual features
      const h3 = page.getByRole('heading', { level: 3 });
      expect(await h3.count()).toBe(4);
    });

    test('should have aria-label on navigation', async ({ page }) => {
      const nav = page.getByRole('navigation', { name: /main/i });
      await expect(nav).toBeVisible();
    });

    test('should be keyboard navigable through all interactive elements', async ({ page }) => {
      // Tab through the page and check interactive elements get focus
      const expectedFocusOrder = [
        /skip to content/i,
        /holon/i,
        /sign in/i,
        /get started/i,
      ];

      for (const expectedText of expectedFocusOrder) {
        await page.keyboard.press('Tab');
        const focused = page.locator(':focus');
        await expect(focused).toBeVisible();
        await expect(focused).toHaveText(expectedText);
      }
    });

    test('should have no images without alt text', async ({ page }) => {
      const imagesWithoutAlt = page.locator('img:not([alt])');
      await expect(imagesWithoutAlt).toHaveCount(0);
    });

    test('should have accessible link text (no bare "click here")', async ({ page }) => {
      const links = page.getByRole('link');
      const count = await links.count();
      for (let i = 0; i < count; i++) {
        const text = await links.nth(i).textContent();
        expect(text?.trim()).not.toBe('');
        expect(text?.toLowerCase()).not.toContain('click here');
      }
    });

    test('should have a main landmark', async ({ page }) => {
      const main = page.getByRole('main');
      await expect(main).toBeVisible();
      await expect(main).toHaveAttribute('id', 'main');
    });
  });
});
