'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginInput } from '@shared/types/user';
import { useAuth } from '@/hooks/use-auth';
import { ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Loader2, Ticket, MessagesSquare, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const features = [
  { icon: Ticket, text: 'Smart ticketing system' },
  { icon: MessagesSquare, text: 'Real-time conversations' },
  { icon: BarChart3, text: 'Team insights & analytics' },
];

export default function LoginPage() {
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginInput) {
    try {
      await login(data);
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.body.error);
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    }
  }

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
          <h2 className="text-3xl font-semibold tracking-tight">
            Welcome back
          </h2>
          <p className="text-base text-muted-foreground">
            Sign in to manage tickets, track issues, and support your customers.
          </p>
        </div>

        <div className="relative mt-4 flex flex-col gap-4">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
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

        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your account to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isSubmitting}
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              Register
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
