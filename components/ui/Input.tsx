import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { FieldShell, controlClass, controlBorder } from "./Field";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, required, leftIcon, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <FieldShell
        label={label}
        hint={hint}
        error={error}
        required={required}
        htmlFor={inputId}
      >
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            className={cn(
              controlClass,
              controlBorder(!!error),
              "h-11",
              leftIcon && "pl-10",
              className,
            )}
            {...props}
          />
        </div>
      </FieldShell>
    );
  },
);
Input.displayName = "Input";
