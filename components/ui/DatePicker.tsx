import { forwardRef, useId } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldShell, controlClass, controlBorder } from "./Field";

export interface DatePickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  hint?: string;
  error?: string;
}

/**
 * Native `<input type="date">` styled to match the design system. Native is the
 * most reliable choice for a mobile-first app (real device date UI) and works
 * directly with react-hook-form via {...register()}.
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, label, hint, error, required, id, ...props }, ref) => {
    const autoId = useId();
    const dateId = id ?? autoId;

    return (
      <FieldShell
        label={label}
        hint={hint}
        error={error}
        required={required}
        htmlFor={dateId}
      >
        <div className="relative">
          <input
            ref={ref}
            id={dateId}
            type="date"
            aria-invalid={!!error}
            className={cn(
              controlClass,
              controlBorder(!!error),
              "h-11 pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0",
              className,
            )}
            {...props}
          />
          <Calendar
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
        </div>
      </FieldShell>
    );
  },
);
DatePicker.displayName = "DatePicker";
