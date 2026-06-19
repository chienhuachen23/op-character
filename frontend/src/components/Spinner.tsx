import clsx from 'clsx';

export function Spinner({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-10 h-10 border-[3px]' };
  return (
    <span
      className={clsx(
        'inline-block rounded-full border-straw/30 border-t-straw animate-spin',
        sizes[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <Spinner size="lg" />
      {message && <p className="text-parchment/70">{message}</p>}
    </div>
  );
}
