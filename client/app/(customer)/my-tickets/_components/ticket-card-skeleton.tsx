import { Skeleton } from '@/components/ui/skeleton';

export function TicketCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border-l-[3px] border-l-muted-foreground/10 p-4 ring-1 ring-foreground/5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="mt-2 h-5 w-3/4" />
        <Skeleton className="mt-1.5 h-4 w-1/2" />
        <div className="mt-3 flex items-center gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton className="size-4 shrink-0 rounded" />
    </div>
  );
}
