'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { Product } from '@shared/types/product';
import { cn } from '@/lib/utils';
import { cleanImageUrl } from '@/lib/images';
import { getCategoryColor } from './category-colors';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

interface ProductCardProps {
  product: Product;
  delay?: number;
}

export function ProductCard({ product, delay = 0 }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = product.images?.[0] ? cleanImageUrl(product.images[0]) : '';
  const hasImage = !imgError && !!imageUrl;
  const categoryColor = getCategoryColor(product.category.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={{ y: -6 }}
    >
      <Link href={`/products/${product.id}`} className="block h-full">
        <div className="group relative aspect-[3/4] overflow-hidden rounded-xl ring-1 ring-foreground/10 transition-all duration-300 hover:shadow-xl hover:ring-foreground/20">
          {/* Image or fallback */}
          {hasImage ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <ImageIcon className="size-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Gradient overlay */}
          <div
            className={cn(
              'pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent transition-opacity duration-300',
              hasImage
                ? 'from-black/80 via-black/20 group-hover:from-black/90'
                : 'from-background/90 via-background/30',
            )}
          />

          {/* Category badge — top left */}
          <div className="absolute top-3 left-3 z-10">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-sm',
                categoryColor.bg,
              )}
            >
              {product.category.name}
            </span>
          </div>

          {/* Content — bottom */}
          <div className="absolute right-0 bottom-0 left-0 z-10 p-4">
            <h3
              className={cn(
                'line-clamp-2 text-sm font-medium leading-snug',
                hasImage
                  ? 'text-white drop-shadow-sm'
                  : 'text-foreground',
              )}
            >
              {product.title}
            </h3>
            <div className="mt-2 flex items-center justify-between">
              <p
                className={cn(
                  'text-lg font-bold',
                  hasImage
                    ? 'text-white drop-shadow-sm'
                    : 'text-foreground',
                )}
              >
                {priceFormatter.format(product.price)}
              </p>
              <span
                className={cn(
                  'flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                  hasImage ? 'text-white/80' : 'text-muted-foreground',
                )}
              >
                View <ArrowRight className="size-3" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
