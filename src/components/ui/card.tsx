import * as React from "react";
import { cn } from "@/lib/utils";

/** The standard white surface card used across the app. */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-line bg-surface",
        className,
      )}
      {...props}
    />
  );
}
