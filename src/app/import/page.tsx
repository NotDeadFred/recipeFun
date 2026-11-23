"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useApp } from "@/components/AppProvider";
import { DraftPreview } from "@/components/recipe/DraftPreview";
import type { RecipeDraft } from "@/lib/types";

function ImportInner() {
  const { apiFetch, claudeEnabled } = useApp();
  const search = useSearchParams();
  const [tab, setTab] = useState<"link" | "paste">("link");
  const [url, setUrl] = useState(search.get("url") ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const autoImported = useRef(false);

  async function run(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    setDraft(null);
    try {
      const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setDraft(data.recipe);
      setMethod(data.method ?? "claude");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Arriving from the bookmarklet or share link (?url=...) imports straight away.
  useEffect(() => {
    const incoming = search.get("url");
    if (incoming && !autoImported.current) {
      autoImported.current = true;
      void run("/api/import", { url: incoming });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const importLink = (e: FormEvent) => {
    e.preventDefault();
    void run("/api/import", { url });
  };
  const structureText = (e: FormEvent) => {
    e.preventDefault();
    void run("/api/structure", { text });
  };

  const bookmarklet =
    typeof window === "undefined"
      ? "#"
      : `javascript:location.href='${location.origin}/import?url='+encodeURIComponent(location.href)`;

  return (
    <div className="page max-w-5xl">
      <h1 className="page-title">Add a recipe</h1>
      <p className="mt-1 text-muted">
        Import from a recipe website, paste recipe text, or{" "}
        <Link href="/recipes/new" className="text-brand underline">
          type one in yourself
        </Link>
        .
      </p>

      <div className="mt-6 flex gap-1 rounded-xl bg-surface-2 p-1 sm:w-fit" role="tablist">
        {(
          [
            ["link", "From a link"],
            ["paste", "Paste text"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className="min-h-10 flex-1 rounded-lg px-4 text-sm aria-selected:bg-surface aria-selected:font-semibold aria-selected:shadow-sm"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "link" ? (
        <form onSubmit={importLink} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            required
            className="input flex-1"
            placeholder="https://www.allrecipes.com/recipe/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Recipe link"
          />
          <button className="btn-primary" disabled={busy}>
            {busy ? "Importing…" : "Import"}
          </button>
        </form>
      ) : (
        <form onSubmit={structureText} className="mt-4 space-y-2">
          <textarea
            className="input min-h-48"
            placeholder="Paste a recipe from anywhere — a website, an email, a note…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Recipe text"
          />
          {!claudeEnabled && (
            <p className="text-sm text-muted">
              Turning pasted text into a recipe uses Claude, which isn&apos;t set up on this server. You can still{" "}
              <Link href="/recipes/new" className="text-brand underline">
                enter it manually
              </Link>
              .
            </p>
          )}
          <button className="btn-primary" disabled={busy || !claudeEnabled || text.trim().length < 20}>
            {busy ? "Reading recipe…" : "Turn into a recipe"}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-danger/10 p-3 text-danger" role="alert">
          {error}
        </p>
      )}
      {draft && (
        <>
          {method === "claude" && (
            <p className="mt-4 text-sm text-muted">This page had no recipe data, so Claude read it. Double-check the details.</p>
          )}
          <DraftPreview draft={draft} onDiscard={() => setDraft(null)} />
        </>
      )}

      {!draft && (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <h2 className="font-semibold">Save from any site with one tap</h2>
            <p className="mt-1 text-sm text-muted">
              Drag this button to your bookmarks bar (on iPad: bookmark any page, then edit the bookmark and paste this link as its
              address). Tap it on a recipe page to import it.
            </p>
            <a href={bookmarklet} className="btn mt-3" onClick={(e) => e.preventDefault()}>
              📌 Save to RecipeFun
            </a>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">Find recipes on your favorite sites</h2>
            <p className="mt-1 text-sm text-muted">Search the recipe sites you&apos;ve saved, then import what you like.</p>
            <Link href="/discover" className="btn mt-3">
              🔎 Search my sites
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function KeyedImport() {
  const { bfcacheId } = useRouter();
  return <ImportInner key={bfcacheId} />;
}

export default function ImportPage() {
  return (
    <Suspense fallback={<p className="page text-muted">Loading…</p>}>
      <KeyedImport />
    </Suspense>
  );
}
