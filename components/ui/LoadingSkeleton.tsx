import { cn } from "@/lib/utils";

/**
 * Base shimmer block. Compose these to build skeletons; a few common presets
 * are exported below for cards, table rows, and text lines.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-gray-200/70",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

/** A few text lines of shimmer, last one shorter. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Card-shaped skeleton (dashboard tiles, list rows). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-100 bg-white p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="mb-2 h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText className="mt-4" lines={2} />
    </div>
  );
}

/** A table row's worth of shimmer cells. */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-gray-100 px-4 py-3.5">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === 0 ? "w-1/4" : "flex-1")} />
      ))}
    </div>
  );
}
