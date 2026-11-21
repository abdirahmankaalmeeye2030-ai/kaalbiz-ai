import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-4 shadow-[0_1px_0_rgba(28,25,21,0.03)]", className)}
      {...props}
    />
  );
}
