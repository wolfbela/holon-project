"use client";

import {
  Ticket,
  MessagesSquare,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { AnimatedWrapper } from "./animated-wrapper";

const features = [
  {
    icon: Ticket,
    title: "Smart Ticketing",
    description:
      "Customers create tickets directly from product pages. Every issue gets a trackable ID and automatic prioritization so nothing falls through the cracks.",
    accent: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: MessagesSquare,
    title: "Live Conversations",
    description:
      "Messages appear instantly for both sides — no refreshing, no waiting. Threaded replies keep context clear even across long conversations.",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: BarChart3,
    title: "Team Insights",
    description:
      "See open tickets, response times, and priority breakdowns at a glance. Charts and KPIs help you spot bottlenecks before they become problems.",
    accent: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: ShieldCheck,
    title: "Built-in Roles",
    description:
      "Customers see their tickets. Agents see everything. Role-based access keeps the right people focused on the right work with no configuration needed.",
    accent: "text-violet-600 dark:text-violet-400",
  },
];

export function FeaturesSection() {
  return (
    <section className="border-t px-4 pt-20 pb-24">
      <div className="mx-auto max-w-5xl">
        <AnimatedWrapper>
          <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            What you get
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything to run support well
          </h2>
        </AnimatedWrapper>

        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {features.map((feature, index) => (
            <AnimatedWrapper
              key={feature.title}
              delay={index * 0.1}
              className="group"
            >
              <feature.icon
                className={`size-5 ${feature.accent}`}
              />
              <h3 className="mt-3 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </AnimatedWrapper>
          ))}
        </div>
      </div>
    </section>
  );
}
