import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { FieldShell, controlClass, controlBorder } from "./Field";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, required, id, rows = 4, ...props }, ref) => {
    const autoId = useId();
    const areaId = id ?? autoId;

    return (
      <FieldShell
        label={label}
        hint={hint}
        error={error}
        required={required}
        htmlFor={areaId}
      >
        <textarea
          ref={ref}
          id={areaId}
          rows={rows}
          aria-invalid={!!error}
          className={cn(
            controlClass,
            controlBorder(!!error),
            "resize-y py-2.5 leading-relaxed",
            className,
          )}
          {...props}
        />
      </FieldShell>
    );
  },
);
Textarea.displayName = "Textarea";
