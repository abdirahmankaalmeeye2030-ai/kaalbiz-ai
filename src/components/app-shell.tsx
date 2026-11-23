"use client";

import { BookOpen, CalendarDays, LayoutDashboard, Moon, PenLine, Sun, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AccountMenu } from "@/components/account-menu";
import { CloudBridge } from "@/components/cloud-bridge";
import type { HealthStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Record", icon: PenLine },
  { href: "/ledger", label: "Ledger", icon: BookOpen },
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/summary", label: "Summary", icon: CalendarDays },
];

const DESKTOP_LINKS = [...LINKS, { href: "/who-owes", label: "Who owes", icon: Users }];

const THEME_KEY = "kaalbiz.theme";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const dark = useSyncExternalStore(subscribeTheme, readDark, () => false);
  const wide = pathname === "/ledger" || pathname === "/dashboard";

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

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(THEME_KEY, next);
  }

  return (
    <div className="h-dvh overflow-hidden bg-shell">
      <div className="mx-auto flex h-dvh w-full max-w-lg flex-col bg-background md:max-w-3xl lg:max-w-none lg:flex-row">
        <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-card lg:px-4 lg:py-6">
          <Brand />
          <ul className="mt-8 space-y-1">
            {DESKTOP_LINKS.map((link) => (
              <NavItem key={link.href} link={link} pathname={pathname} layout="side" />
            ))}
          </ul>
          <div className="mt-auto pt-6">
            <AccountMenu layout="side" />
          </div>
        </aside>
        <div className="flex h-dvh min-h-0 min-w-0 flex-1 flex-col">
          <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:px-8">
            <div className="lg:hidden">
              <Brand />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-foreground"
              >
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <StatusPill health={health} />
            </div>
          </header>
          <nav className="hidden border-b border-border bg-card md:block lg:hidden">
            <ul className="flex gap-1 overflow-x-auto px-4 py-2">
              {DESKTOP_LINKS.map((link) => (
                <NavItem key={link.href} link={link} pathname={pathname} layout="top" />
              ))}
            </ul>
          </nav>
          <CloudBridge />
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-8">
            <div className={cn("mx-auto w-full", wide ? "max-w-6xl" : "max-w-lg md:max-w-3xl")}>{children}</div>
          </main>
          <footer className="shrink-0 border-t border-border bg-card lg:hidden">
            <div className="px-3 py-2">
              <AccountMenu layout="dock" />
            </div>
            <nav className="md:hidden">
              <ul className="grid grid-cols-4">
                {LINKS.map((link) => (
                  <NavItem key={link.href} link={link} pathname={pathname} layout="bottom" />
                ))}
              </ul>
            </nav>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-serif text-lg text-primary-foreground">
        K
      </span>
      <span>
        <span className="block font-serif text-lg leading-none tracking-tight">KaalBiz</span>
        <span className="mt-1 block text-xs text-muted-foreground">Kampala shop notes</span>
      </span>
    </Link>
  );
}

function NavItem({
  link,
  pathname,
  layout,
}: {
  link: (typeof DESKTOP_LINKS)[number];
  pathname: string;
  layout: "bottom" | "top" | "side";
}) {
  const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
  const Icon = link.icon;
  return (
    <li>
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "font-semibold",
          layout === "bottom" && "flex h-16 flex-col items-center justify-center gap-1 text-xs",
          layout === "top" && "flex h-11 items-center gap-2 rounded-xl px-3 text-sm whitespace-nowrap",
          layout === "side" && "flex h-11 items-center gap-3 rounded-xl px-3 text-sm",
          active ? "text-primary" : "text-muted-foreground",
          active && layout !== "bottom" && "bg-primary/10",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
        {link.label}
      </Link>
    </li>
  );
}

function readDark() {
  return document.documentElement.classList.contains("dark");
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
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
