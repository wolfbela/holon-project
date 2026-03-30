"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroSection } from "./_components/landing/hero-section";
import { FeaturesSection } from "./_components/landing/features-section";
import { FooterSection } from "./_components/landing/footer-section";

// TODO: When auth is implemented, add middleware.ts to redirect
// authenticated users to /products (customer) or /dashboard (admin)

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Skip to content */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <nav
          aria-label="Main"
          className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4"
        >
          <Link href="/" className="text-sm font-bold tracking-tight">
            Holon
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main id="main" className="flex-1">
        <HeroSection />
        <FeaturesSection />
      </main>

      <FooterSection />
    </div>
  );
}
