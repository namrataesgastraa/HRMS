"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

export interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

/** Circular avatar; falls back to gradient initials when no image loads. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white",
        !showImage && "bg-gradient-primary",
        sizes[size],
        className,
      )}
      aria-label={name ?? "User"}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? "User avatar"}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
