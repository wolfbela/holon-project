import { Skeleton } from '@/components/ui/skeleton';

export function ProductDetailSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl px-4 py-8"
      aria-busy="true"
      aria-label="Loading product details"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image column */}
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="size-20 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Info column */}
        <div className="flex flex-col">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-5 h-5 w-24 rounded-full" />
          <Skeleton className="mt-3 h-8 w-3/4" />
          <Skeleton className="mt-2 h-10 w-32" />
          <div className="mt-6 border-t border-border" />
          <div className="mt-6 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="mt-8 h-11 w-full sm:w-48" />
        </div>
      </div>
    </div>
  );
}
