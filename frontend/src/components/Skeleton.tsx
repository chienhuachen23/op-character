import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-xl bg-parchment/10',
        className
      )}
    />
  );
}

export function GameBoardSkeleton() {
  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto space-y-6">
      <Skeleton className="h-16 w-full" />
      <div className="grid md:grid-cols-3 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-20 w-2/3 mx-auto" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
