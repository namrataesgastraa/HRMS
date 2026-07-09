"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-violet/40 focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-60 select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-primary text-white shadow-soft hover:brightness-105 active:brightness-95",
  secondary:
    "border border-gray-200 bg-white text-dark-base hover:border-electric-violet/40 hover:bg-gray-50 active:bg-gray-100",
  destructive:
    "bg-red-500 text-white shadow-soft hover:bg-red-600 active:bg-red-700",
  ghost:
    "bg-transparent text-dark-base hover:bg-gray-100 active:bg-gray-200",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? <Spinner /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);
Button.displayName = "Button";
