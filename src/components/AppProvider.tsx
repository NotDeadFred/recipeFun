"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { Repository } from "@/lib/data/repository";
import { LocalRepository } from "@/lib/data/localRepository";
import { SupabaseRepository } from "@/lib/data/supabaseRepository";
import type { Profile } from "@/lib/types";
import { SignInScreen } from "./SignInScreen";

interface AppContextValue {
  repo: Repository;
  profile: Profile;
  refreshProfile: () => Promise<void>;
  mode: "local" | "supabase";
  claudeEnabled: boolean;
  /** fetch() that adds the signed-in user's token for our API routes. */
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  signOut: () => Promise<void>;
}

interface AppState {
  /** Set once storage and the profile are loaded. */
  app: AppContextValue | null;
  /** What to show in place of page content until then (loading, sign-in, error). */
  gate: ReactNode;
}

const AppContext = createContext<AppState>({ app: null, gate: null });

/** For page content wrapped in <AppReady> / withApp(): storage and profile are ready. */
export function useApp(): AppContextValue {
  const { app } = useContext(AppContext);
  if (!app) throw new Error("useApp must be used inside <AppReady> (or a page wrapped with withApp)");
  return app;
}

/** For UI that also renders before the app is ready (the header and nav). */
export function useAppMaybe(): AppContextValue | null {
  return useContext(AppContext).app;
}

/**
 * Renders its children once the app is ready, and the loading / sign-in /
 * error screen until then. Pages render this themselves (via withApp) rather
 * than the layout swapping pages out, so every page segment is always
 * rendered — which Next.js needs to validate instant navigation.
 */
export function AppReady({ children }: { children: ReactNode }) {
  const { app, gate } = useContext(AppContext);
  return <>{app ? children : gate}</>;
}

const LOADING = (
  <div className="flex min-h-[60vh] items-center justify-center text-muted" role="status">
    Loading your kitchen…
  </div>
);

/**
 * Wrap a page component so its content waits for the app to be ready.
 * The Suspense boundary lets pages read URL data (useParams/useSearchParams)
 * while the rest of the layout is still prerendered.
 */
export function withApp<P extends object>(Page: ComponentType<P>) {
  function AppPage(props: P) {
    return (
      <Suspense fallback={LOADING}>
        <AppReady>
          <Page {...props} />
        </AppReady>
      </Suspense>
    );
  }
  AppPage.displayName = `withApp(${Page.displayName ?? Page.name})`;
  return AppPage;
}

let browserClient: SupabaseClient | null = null;
function getBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  browserClient ??= createClient(url, key);
  return browserClient;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => (typeof window === "undefined" ? null : getBrowserSupabase()), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  // Remember which repository a profile was loaded from, so switching accounts never shows a stale one.
  const [profileState, setProfileState] = useState<{ repo: Repository; profile: Profile } | null>(null);
  const [claudeEnabled, setClaudeEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => setClaudeEnabled(Boolean(s.claude)))
      .catch(() => setClaudeEnabled(false));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const repo = useMemo<Repository | null>(() => {
    if (typeof window === "undefined") return null;
    if (!supabase) return new LocalRepository();
    if (!session) return null;
    return new SupabaseRepository(supabase, session.user.id, session.user.email ?? null);
  }, [supabase, session]);

  const profile = repo && profileState?.repo === repo ? profileState.profile : null;

  const refreshProfile = useCallback(async () => {
    if (!repo) return;
    try {
      setProfileState({ repo, profile: await repo.getProfile() });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [repo]);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    repo
      .getProfile()
      .then((p) => !cancelled && setProfileState({ repo, profile: p }))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
      if (session?.access_token) headers.set("authorization", `Bearer ${session.access_token}`);
      return fetch(path, { ...init, headers });
    },
    [session],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, [supabase]);

  let gate: ReactNode = LOADING;
  if (error) {
    gate = (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Couldn&apos;t load your data</h1>
        <p className="mt-2 text-muted">{error}</p>
        <button className="btn-primary mt-4" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  } else if (supabase && authReady && !session) {
    gate = <SignInScreen supabase={supabase} />;
  }

  const app: AppContextValue | null =
    repo && profile && !error
      ? { repo, profile, refreshProfile, mode: repo.mode, claudeEnabled, apiFetch, signOut }
      : null;

  // Always render children (the layout and page); pages show `gate` until ready.
  return <AppContext.Provider value={{ app, gate }}>{children}</AppContext.Provider>;
}
