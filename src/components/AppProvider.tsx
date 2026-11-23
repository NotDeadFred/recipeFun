"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
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

  if (error) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Couldn&apos;t load your data</h1>
        <p className="mt-2 text-muted">{error}</p>
        <button className="btn-primary mt-4" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  if (supabase && authReady && !session) return <SignInScreen supabase={supabase} />;
  if (!repo || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted" role="status">
        Loading your kitchen…
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        repo,
        profile,
        refreshProfile,
        mode: repo.mode,
        claudeEnabled,
        apiFetch,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
