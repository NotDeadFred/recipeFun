"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import { useAsync } from "@/lib/hooks";
import type { RecipeSource } from "@/lib/types";

const FILTERS: Array<[RecipeSource | "all" | "shared", string]> = [
  ["all", "All"],
  ["manual", "Mine"],
  ["imported", "Imported"],
  ["claude", "Claude"],
  ["shared", "Shared with me"],
];

export default function LibraryPage() {
  const { repo, profile } = useApp();
  const { data: recipes, loading, error } = useAsync(() => repo.listRecipes(), [repo]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (recipes ?? []).filter((r) => {
      if (filter === "shared" && r.ownerId === profile.id) return false;
      if (filter !== "all" && filter !== "shared" && r.sourceType !== filter) return false;
      if (!q) return true;
      return [r.title, r.description, r.cuisine, ...r.tags, ...r.ingredients.map((i) => i.name)]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q));
    });
  }, [recipes, query, filter, profile.id]);

  return (
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Your recipes</h1>
          <p className="text-muted">Hi {profile.displayName}, what are we cooking?</p>
        </div>
        <div className="flex gap-2">
          <Link href="/recipes/new" className="btn">
            ✍️ Write a recipe
          </Link>
          <Link href="/claude" className="btn-primary">
            ✨ Cook with Claude
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          className="input sm:max-w-sm"
          placeholder="Search recipes, ingredients, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search recipes"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter recipes">
          {FILTERS.map(([value, label]) => (
            <button key={value} className="chip" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-6 text-danger">{error}</p>}
      {loading && !recipes ? (
        <p className="mt-10 text-center text-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <p className="text-lg font-medium">{recipes?.length ? "No recipes match." : "Your recipe box is empty."}</p>
          <p className="mt-1 text-muted">Import one from a website, write your own, or ask Claude for ideas.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/import" className="btn">
              Import from a link
            </Link>
            <Link href="/claude" className="btn-primary">
              Cook with Claude
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="recipe-grid">
          {visible.map((r) => (
            <RecipeCard key={r.id} recipe={r} shared={r.ownerId !== profile.id} />
          ))}
        </div>
      )}
    </div>
  );
}
