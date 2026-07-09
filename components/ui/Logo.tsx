import Image from "next/image";
import { cn } from "@/lib/utils";

/** ESG Astraa wordmark. Size via className height (e.g. "h-9"), width auto. */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="ESG Astraa"
      width={175}
      height={50}
      priority
      className={cn("h-9 w-auto", className)}
    />
  );
}
