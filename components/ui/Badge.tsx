import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "present"
  | "late"
  | "absent"
  | "submitted"
  | "pending"
  | "info";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-gray-100 text-gray-600",
  present: "bg-success/10 text-success",
  late: "bg-amber-100 text-amber-700",
  absent: "bg-red-100 text-red-600",
  submitted: "bg-success/10 text-success",
  pending: "bg-amber-100 text-amber-700",
  info: "bg-cool-blue/10 text-cool-blue",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({
  className,
  variant = "neutral",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  );
}
