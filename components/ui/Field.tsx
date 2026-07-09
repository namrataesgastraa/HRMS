import { cn } from "@/lib/utils";

export interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/** Shared label + hint + error layout for all form primitives. */
export function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-sm font-semibold text-dark-base"
        >
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}

/** Shared input/control styling so text, select, date fields look identical. */
export const controlClass =
  "w-full rounded-xl border bg-white px-3.5 text-sm text-dark-base transition-colors " +
  "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-electric-violet/30 " +
  "focus:border-electric-violet disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

export const controlBorder = (hasError?: boolean) =>
  hasError ? "border-red-400 focus:ring-red-200 focus:border-red-400" : "border-gray-200";
