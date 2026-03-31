import { Skeleton } from '@/components/ui/skeleton';

export function TicketDetailSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-8"
      aria-busy="true"
      aria-label="Loading ticket details"
    >
      {/* Back link */}
      <Skeleton className="h-4 w-32" />

      {/* Header */}
      <div className="mt-6 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>

      {/* Original message */}
      <div className="mt-6 rounded-xl border p-4 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Conversation bubbles */}
      <div className="mt-8 space-y-4">
        <Skeleton className="h-4 w-24" />

        {/* Agent bubble - left */}
        <div className="flex justify-start">
          <div className="space-y-1.5 max-w-[80%]">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-16 w-64 rounded-2xl rounded-bl-md" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>

        {/* Customer bubble - right */}
        <div className="flex justify-end">
          <div className="space-y-1.5 max-w-[80%]">
            <Skeleton className="ml-auto h-3 w-10" />
            <Skeleton className="h-12 w-48 rounded-2xl rounded-br-md" />
            <Skeleton className="ml-auto h-3 w-12" />
          </div>
        </div>

        {/* Agent bubble - left */}
        <div className="flex justify-start">
          <div className="space-y-1.5 max-w-[80%]">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-20 w-72 rounded-2xl rounded-bl-md" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </div>

      {/* Reply input */}
      <div className="mt-8 space-y-3">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}
