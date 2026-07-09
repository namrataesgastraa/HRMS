import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldShell, controlClass, controlBorder } from "./Field";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      hint,
      error,
      required,
      options,
      placeholder,
      id,
      children,
      ...props
    },
    ref,
  ) => {
    const autoId = useId();
    const selectId = id ?? autoId;

    return (
      <FieldShell
        label={label}
        hint={hint}
        error={error}
        required={required}
        htmlFor={selectId}
      >
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={!!error}
            className={cn(
              controlClass,
              controlBorder(!!error),
              "h-11 cursor-pointer appearance-none pr-10",
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
        </div>
      </FieldShell>
    );
  },
);
Select.displayName = "Select";
