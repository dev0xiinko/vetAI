import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "success" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-dark disabled:opacity-60 disabled:pointer-events-none",
  secondary:
    "border border-line-strong bg-surface text-muted hover:bg-app disabled:opacity-60",
  ghost: "text-muted hover:bg-app",
  success:
    "bg-success text-white hover:brightness-95 disabled:opacity-60 disabled:pointer-events-none",
  danger:
    "border border-danger/30 bg-surface text-danger hover:bg-danger-soft disabled:opacity-60",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
