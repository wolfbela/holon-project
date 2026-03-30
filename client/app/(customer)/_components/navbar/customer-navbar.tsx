'use client';

import Link from 'next/link';
import { NavLinks } from './nav-links';
import { NotificationBell } from '@/components/notifications';
import { UserMenu } from '@/components/user-menu';
import { MobileMenu } from './mobile-menu';

export function CustomerNavbar() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <nav
          aria-label="Customer navigation"
          className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4"
        >
          <div className="flex items-center gap-6">
            <Link
              href="/products"
              className="text-base font-bold tracking-tight"
            >
              Agilite
            </Link>
            <NavLinks />
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu />
            <MobileMenu />
          </div>
        </nav>
      </header>
    </>
  );
}
