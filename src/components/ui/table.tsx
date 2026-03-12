import * as React from "react";
import { cn } from "@/lib/utils";
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) { return <table className={cn("w-full text-sm", className)} {...props} />; }
export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) { return <thead className={cn("text-left text-slate-600", className)} {...props} />; }
export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) { return <tbody className={cn("", className)} {...props} />; }
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) { return <tr className={cn("border-b border-slate-100", className)} {...props} />; }
export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) { return <th className={cn("py-2 px-2 font-medium", className)} {...props} />; }
export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) { return <td className={cn("py-2 px-2 align-top", className)} {...props} />; }
