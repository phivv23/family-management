import * as React from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, variant="default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "outline" }) {
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";
  const v = variant === "outline" ? "border border-slate-300 text-slate-700" : "bg-slate-900 text-white";
  return <span className={cn(base, v, className)} {...props} />;
}
