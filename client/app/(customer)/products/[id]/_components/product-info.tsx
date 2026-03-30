'use client';

import Link from 'next/link';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import type { Product } from '@shared/types/product';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCategoryColor } from '../../_components/category-colors';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

interface ProductInfoProps {
  product: Product;
  onCreateTicket: () => void;
}

export function ProductInfo({ product, onCreateTicket }: ProductInfoProps) {
  const categoryColor = getCategoryColor(product.category.name);

  return (
    <div className="flex flex-col">
      {/* Back link */}
      <Link
        href="/products"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to products
      </Link>

      {/* Category badge */}
      <span
        className={cn(
          'mt-5 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-white shadow-sm',
          categoryColor.bg,
        )}
      >
        {product.category.name}
      </span>

      {/* Title + Price — tightly grouped */}
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
        {product.title}
      </h1>
      <p className="mt-2 text-3xl font-bold text-primary sm:text-4xl">
        {priceFormatter.format(product.price)}
      </p>

      {/* Separator */}
      <div className="mt-6 border-t border-border" />

      {/* Description */}
      <div className="mt-6 space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Description
        </h2>
        <p className="leading-relaxed text-foreground/80">
          {product.description}
        </p>
      </div>

      {/* Create ticket CTA — pushed down */}
      <Button
        size="lg"
        className="mt-8 w-full gap-2 sm:w-auto"
        onClick={onCreateTicket}
      >
        <LifeBuoy className="size-4" />
        Create Ticket
      </Button>
    </div>
  );
}
