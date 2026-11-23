"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { useAppMaybe } from "./AppProvider";
import { ThemeToggle } from "./ThemeToggle";

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
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" || pathname.startsWith("/recipes") : pathname.startsWith(href);
}

type NavItem = { href: string; label: string; icon?: string };

/**
 * Links that highlight the current page. Reading the URL (usePathname) has to
 * happen inside <Suspense> so the rest of the page can still be prerendered;
 * the fallback renders the same links without a highlight.
 */
function TopLinks({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className="relative px-3 py-2 text-sm font-bold tracking-wide text-foreground/80 uppercase hover:text-brand aria-[current=page]:text-brand after:absolute after:inset-x-3 after:-bottom-[13px] after:h-[3px] after:bg-brand after:opacity-0 aria-[current=page]:after:opacity-100"
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

function BottomLinks({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className="flex min-h-14 flex-col items-center justify-center text-[11px] font-semibold text-muted aria-[current=page]:text-brand"
        >
          <span aria-hidden className="text-lg">
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </>
  );
}

function WithPathname({ render }: { render: (pathname: string | null) => ReactNode }) {
  return <>{render(usePathname())}</>;
}

function CurrentAware({ render }: { render: (pathname: string | null) => ReactNode }) {
  return (
    <Suspense fallback={render(null)}>
      <WithPathname render={render} />
    </Suspense>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const app = useAppMaybe();
  const initial = app?.profile.displayName.slice(0, 1).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="RecipeFun home">
            {/* eslint-disable-next-line @next/next/no-img-element -- small static icon */}
            <img src="/icons/icon.svg" alt="" className="size-8 rounded-md" />
            <span className="text-2xl font-black tracking-tight text-brand">
              Recipe<span className="text-foreground">Fun</span>
            </span>
          </Link>
          <nav className="ml-4 hidden flex-1 items-center lg:flex" aria-label="Main">
            <CurrentAware render={(p) => <TopLinks items={[...NAV, ...MORE]} pathname={p} />} />
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {app?.mode === "local" && (
              <span
                className="mr-1 hidden rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold tracking-wide text-muted uppercase sm:inline"
                title="Your data is stored on this device only"
              >
                Local mode
              </span>
            )}
            <ThemeToggle />
            <Link
              href="/groups"
              className="inline-flex size-11 items-center justify-center rounded-md text-lg hover:bg-surface-2 lg:hidden"
              aria-label="Groups"
            >
              👥
            </Link>
            <Link
              href="/profile"
              className="ml-1 inline-flex size-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand"
              aria-label="Profile"
            >
              {initial ?? <span aria-hidden>👤</span>}
            </Link>
          </div>
        </div>
        {/* Tablet-width second row: iPad portrait gets full nav without the bottom bar */}
        <nav className="hidden border-t border-border md:block lg:hidden" aria-label="Sections">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-2 py-2">
            <CurrentAware render={(p) => <TopLinks items={[...NAV, ...MORE]} pathname={p} />} />
          </div>
        </nav>
      </header>

      <main className="flex-1 pb-20 md:pb-10">{children}</main>

      <footer className="hidden border-t border-border md:block">
        <div className="mx-auto flex max-w-6xl justify-between px-6 py-6 text-xs text-muted">
          <span>RecipeFun — your recipes, your people.</span>
          <Link href="/profile" className="hover:text-brand">
            Profile &amp; settings
          </Link>
        </div>
      </footer>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden" aria-label="Main">
        <div className="grid grid-cols-5">
          <CurrentAware render={(p) => <BottomLinks items={NAV} pathname={p} />} />
        </div>
      </nav>
    </>
  );
}
