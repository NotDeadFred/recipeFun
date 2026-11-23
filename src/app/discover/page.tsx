"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useApp } from "@/components/AppProvider";
import { useAsync } from "@/lib/hooks";
import { buildSearchUrl } from "@/lib/sites";

export default function DiscoverPage() {
  const { repo } = useApp();
  const { data: sites, reload } = useAsync(() => repo.listSites(), [repo]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addSite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const parsed = new URL(url);
      if (searchUrl && !searchUrl.includes("{query}")) throw new Error("The search link needs {query} where the search words go.");
      await repo.saveSite({ name: name.trim() || parsed.hostname.replace(/^www\./, ""), url: parsed.origin, searchUrl: searchUrl || null });
      setName("");
      setUrl("");
      setSearchUrl("");
      await reload();
    } catch (err) {
      setError(err instanceof TypeError ? "Enter a full web address, like https://www.example.com" : (err as Error).message);
    }
  }

  return (
    <div className="page max-w-4xl">
      <h1 className="page-title">Recipe sites</h1>
      <p className="mt-1 text-muted">
        Search your favorite recipe sites. Open a result, copy its link, and{" "}
        <Link href="/import" className="text-brand underline">
          import it
        </Link>{" "}
        — or use the one-tap bookmark from the Add page.
      </p>

      <input
        type="search"
        className="input mt-6"
        placeholder="What do you want to cook? e.g. chicken enchiladas"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search recipe sites"
      />

      <ul className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Saved sites">
        {sites?.map((site) => (
          <li key={site.id} className="card flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{site.name}</p>
              <p className="truncate text-sm text-muted">{site.url.replace(/^https?:\/\//, "")}</p>
            </div>
            {site.searchUrl && query.trim() ? (
              <a className="btn-primary" href={buildSearchUrl(site.searchUrl, query)} target="_blank" rel="noreferrer">
                Search
              </a>
            ) : (
              <a className="btn" href={site.url} target="_blank" rel="noreferrer">
                Open
              </a>
            )}
            <button
              className="btn-ghost text-danger"
              aria-label={`Remove ${site.name}`}
              onClick={async () => {
                await repo.deleteSite(site.id);
                await reload();
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={addSite} className="card mt-8 space-y-3 p-5">
        <h2 className="font-semibold">Add a recipe site</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Smitten Kitchen" />
          </label>
          <label className="field">
            <span>Web address</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://smittenkitchen.com" required />
          </label>
        </div>
        <label className="field">
          <span>Search link (optional)</span>
          <input value={searchUrl} onChange={(e) => setSearchUrl(e.target.value)} placeholder="https://smittenkitchen.com/?s={query}" />
          <span className="text-xs font-normal text-muted">Search the site for “test”, copy the address, and replace “test” with {"{query}"}.</span>
        </label>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button className="btn-primary">Add site</button>
      </form>
    </div>
  );
}
