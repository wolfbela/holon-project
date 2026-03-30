"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  Ticket,
  MessagesSquare,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pt-24 pb-16 sm:pt-32 sm:pb-24">
      {/* Decorative grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "4rem 4rem",
        }}
      />

      {/* Accent line */}
      <div className="pointer-events-none absolute top-0 left-1/4 h-px w-1/2 bg-gradient-to-r from-transparent via-blue-600/40 to-transparent dark:via-blue-400/40" />

      <div className="relative z-10 mx-auto grid max-w-5xl items-start gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
        {/* Left: Text content */}
        <div className="max-w-2xl">
          <motion.p
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.5 }}
            className="text-sm font-medium tracking-widest text-blue-600 uppercase dark:text-blue-400"
          >
            Customer Support Platform
          </motion.p>

          <motion.h1
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
          >
            Resolve faster.
            <br />
            <span className="text-muted-foreground">Keep everyone in the loop.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
          >
            Agilite connects your customers with your support team through a
            ticketing system built for speed and clarity. Real-time
            conversations, smart prioritization, and insights that help you
            improve.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "gap-2 px-5"
              )}
            >
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" })
              )}
            >
              Sign in
            </Link>
          </motion.div>
        </div>

        {/* Right: Visual element — floating stat cards */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="hidden lg:flex lg:flex-col lg:gap-3 lg:pt-8"
        >
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex size-9 items-center justify-center rounded-md bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400">
              <Ticket className="size-4" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">2,847</p>
              <p className="text-xs text-muted-foreground">Tickets resolved this month</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm translate-x-6">
            <div className="flex size-9 items-center justify-center rounded-md bg-emerald-600/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
              <MessagesSquare className="size-4" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{"< 2min"}</p>
              <p className="text-xs text-muted-foreground">Average first response</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex size-9 items-center justify-center rounded-md bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
              <BarChart3 className="size-4" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">98.5%</p>
              <p className="text-xs text-muted-foreground">Customer satisfaction</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
