'use client';

import { Ticket, MessagesSquare, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';

const features = [
  { icon: Ticket, text: 'Smart ticketing system' },
  { icon: MessagesSquare, text: 'Real-time conversations' },
  { icon: BarChart3, text: 'Team insights & analytics' },
];

interface AuthFormLayoutProps {
  headline: string;
  description: string;
  children: React.ReactNode;
}

export function AuthFormLayout({
  headline,
  description,
  children,
}: AuthFormLayoutProps) {
  return (
    <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_auto_1fr] lg:gap-0">
      {/* Branding panel */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative hidden lg:flex lg:flex-col lg:gap-6"
      >
        {/* Grid background */}
        <div
          className="pointer-events-none absolute inset-0 -m-8 rounded-2xl opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(to right, currentColor 1px, transparent 1px)',
            backgroundSize: '4rem 4rem',
          }}
        />

        {/* Accent line */}
        <div className="absolute -top-4 left-0 h-px w-3/4 bg-gradient-to-r from-blue-600/40 via-blue-600/20 to-transparent dark:from-blue-400/40 dark:via-blue-400/20" />

        <Link href="/" className="relative">
          <span className="text-xl font-bold tracking-tight">Agilite</span>
        </Link>

        <div className="relative space-y-3">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Customer Support Platform
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">{headline}</h2>
          <p className="text-base text-muted-foreground">{description}</p>
        </div>

        <div className="relative mt-4 flex flex-col gap-4">
          {features.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 text-sm text-muted-foreground"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-4" />
              </div>
              {text}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Divider */}
      <div className="hidden lg:flex lg:justify-center lg:px-8">
        <div className="h-64 w-px bg-border" />
      </div>

      {/* Form panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        className="w-full max-w-sm justify-self-center lg:justify-self-end"
      >
        {/* Mobile-only branding */}
        <div className="mb-8 flex flex-col items-center gap-1 lg:hidden">
          <Link href="/">
            <span className="text-lg font-bold tracking-tight">Agilite</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Customer Support Platform
          </p>
        </div>

        {children}
      </motion.div>
    </div>
  );
}
