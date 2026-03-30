'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cleanImageUrl } from '@/lib/images';

interface ProductImageGalleryProps {
  images: string[];
  title: string;
}

export function ProductImageGallery({
  images,
  title,
}: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [errorIndexes, setErrorIndexes] = useState<Set<number>>(new Set());

  const cleanedImages = images.map(cleanImageUrl).filter(Boolean);
  const currentImage = cleanedImages[selectedIndex];
  const hasCurrentImage = !!currentImage && !errorIndexes.has(selectedIndex);

  function handleImageError(index: number) {
    setErrorIndexes((prev) => new Set(prev).add(index));
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
        {hasCurrentImage ? (
          <img
            key={selectedIndex}
            src={currentImage}
            alt={title}
            className="h-full w-full object-cover animate-in fade-in-0 duration-300"
            onError={() => handleImageError(selectedIndex)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="size-16 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {cleanedImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {cleanedImages.map((url, i) => {
            const hasError = errorIndexes.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  'relative size-20 overflow-hidden rounded-lg ring-1 transition-all duration-200',
                  i === selectedIndex
                    ? 'ring-2 ring-primary'
                    : 'ring-foreground/10 hover:ring-foreground/30',
                )}
              >
                {!hasError ? (
                  <img
                    src={url}
                    alt={`${title} - image ${i + 1}`}
                    className="h-full w-full object-cover"
                    onError={() => handleImageError(i)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <ImageIcon className="size-4 text-muted-foreground/30" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
