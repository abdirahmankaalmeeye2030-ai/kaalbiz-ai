"use client";

import { BookOpen, CalendarDays, LayoutDashboard, PenLine } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { HealthStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Record", icon: PenLine },
  { href: "/ledger", label: "Ledger", icon: BookOpen },
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/summary", label: "Summary", icon: CalendarDays },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: HealthStatus | null) => {
        if (active) setHealth(data);
      })
      .catch(() => {
        if (active) setHealth(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-[#e7e0d2]">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-serif text-lg text-primary-foreground">
              K
            </span>
            <span>
              <span className="block font-serif text-lg leading-none tracking-tight">KaalBiz</span>
              <span className="mt-1 block text-xs text-muted-foreground">Kampala shop notes</span>
            </span>
          </Link>
          <StatusPill health={health} />
        </header>
        <main className="flex-1 px-4 pb-28 pt-5">{children}</main>
        <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-lg -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur">
          <ul className="grid grid-cols-4">
            {LINKS.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function StatusPill({ health }: { health: HealthStatus | null }) {
  if (!health) {
    return (
      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        Checking…
      </span>
    );
  }

  if (health.aiConfigured) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
        title={`Text ${health.model}. Receipts ${health.visionModel}.`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        AI ready
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-semibold text-warning"
      title="OPENROUTER_API_KEY is not set on the server."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
      Demo mode
    </span>
  );
}
