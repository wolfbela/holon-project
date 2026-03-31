'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Calendar, Package, User } from 'lucide-react';
import type { Ticket } from '@shared/types/ticket';
import type { Product } from '@shared/types/product';
import { StatusBadge, PriorityBadge } from '@/components/ticket-badges';
import { formatDate } from '@/lib/format';
import { cleanImageUrl } from '@/lib/images';

interface TicketHeaderProps {
  ticket: Ticket;
  product: Product | null;
  backHref: string;
  backLabel: string;
  actions?: React.ReactNode;
  showCustomerInfo?: boolean;
}

export function TicketHeader({
  ticket,
  product,
  backHref,
  backLabel,
  actions,
  showCustomerInfo,
}: TicketHeaderProps) {
  const [imgError, setImgError] = useState(false);
  const productImage =
    product?.images?.[0] && !imgError
      ? cleanImageUrl(product.images[0])
      : null;

  return (
    <div>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {backLabel}
      </Link>

      <div className="mt-4 space-y-3">
        <p className="font-mono text-sm text-muted-foreground">
          {ticket.display_id}
        </p>

        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {ticket.subject}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>

        {actions && <div className="pt-1">{actions}</div>}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {showCustomerInfo && (
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5" />
              {ticket.name}
            </span>
          )}

          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {formatDate(ticket.created_at)}
          </span>

          <span className="inline-flex items-center gap-1.5">
            {productImage ? (
              <img
                src={productImage}
                alt={ticket.product_name}
                className="size-5 rounded object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <Package className="size-3.5" />
            )}
            {ticket.product_name}
          </span>
        </div>
      </div>

      {/* Original message */}
      <div className="mt-6 rounded-xl border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">
          {ticket.name} opened this ticket
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
          {ticket.message}
        </p>
      </div>
    </div>
  );
}
