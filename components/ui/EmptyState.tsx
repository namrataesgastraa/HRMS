import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Reusable "nothing here yet" placeholder for empty tables/lists/screens. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-electric-violet/10 text-electric-violet">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="font-semibold text-dark-base">{title}</p>
        {message && (
          <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
            {message}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
