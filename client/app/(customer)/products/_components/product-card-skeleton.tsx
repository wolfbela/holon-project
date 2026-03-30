import { Skeleton } from '@/components/ui/skeleton';

export function ProductCardSkeleton() {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl ring-1 ring-foreground/5">
      <Skeleton className="absolute inset-0 rounded-xl" />
      <div className="absolute top-3 left-3">
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="absolute right-0 bottom-0 left-0 space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  );
}
