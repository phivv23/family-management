import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost";
type Size = "default" | "sm";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; asChild?: boolean };

export function Button({ className, variant="default", size="default", asChild, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<Variant,string> = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-300 bg-white hover:bg-slate-50",
    ghost: "bg-transparent hover:bg-slate-100"
  };
  const sizes: Record<Size,string> = { default: "h-10 px-4 py-2", sm: "h-9 px-3" };
  if (asChild) {
    // minimal asChild support: render children element with className
    const child = props.children;
    if (!React.isValidElement(child)) return null;
    return React.cloneElement(child as React.ReactElement<any>, { className: cn(base, variants[variant], sizes[size], (child.props as { className?: string }).className, className) });
  }
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
