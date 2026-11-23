"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "./AppProvider";

const NAV = [
  { href: "/", label: "Recipes", icon: "📖" },
  { href: "/import", label: "Add", icon: "➕" },
  { href: "/claude", label: "Claude", icon: "✨" },
  { href: "/cookbooks", label: "Cookbooks", icon: "📚" },
  { href: "/shopping", label: "Shopping", icon: "🛒" },
];

const MORE = [
  { href: "/groups", label: "Groups" },
  { href: "/discover", label: "Sites" },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/recipes") : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profile, mode } = useApp();

  // Cook mode takes over the whole screen.
  if (/^\/recipes\/[^/]+\/cook/.test(pathname)) return <>{children}</>;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="mr-2 text-xl font-bold text-brand">
            RecipeFun
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
            {[...NAV, ...MORE].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {mode === "local" && (
              <span className="hidden rounded-full bg-surface-2 px-2 py-1 text-xs text-muted sm:inline" title="Data is stored on this device only">
                Local mode
              </span>
            )}
            <Link href="/profile" className="btn-ghost md:hidden" aria-label="Profile">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </Link>
            <Link href="/groups" className="btn-ghost md:hidden" aria-label="Groups">
              👥
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-6">{children}</main>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden"
        aria-label="Main"
      >
        <div className="grid grid-cols-5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className="flex min-h-14 flex-col items-center justify-center text-xs text-muted aria-[current=page]:font-semibold aria-[current=page]:text-brand"
            >
              <span aria-hidden className="text-lg">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
