"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useApp, withApp } from "@/components/AppProvider";
import { CookMode } from "@/components/cook/CookMode";
import { useAsync } from "@/lib/hooks";
import type { UnitSystem } from "@/lib/types";

function CookPageInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const { bfcacheId } = useRouter();
  const { repo } = useApp();
  const { data: recipe, loading } = useAsync(() => repo.getRecipe(id), [repo, id]);

  if (loading) return <p className="page text-muted">Loading…</p>;
  if (!recipe) return <p className="page">Recipe not found.</p>;

  const servings = Number(search.get("servings")) || recipe.servings;
  const units = search.get("units");
  const unitSystem: UnitSystem | null = units === "us" || units === "metric" ? units : null;

  // A fresh cook session per visit; Back/Forward restores the step you were on.
  return <CookMode key={bfcacheId} recipe={recipe} servings={servings} unitSystem={unitSystem} exitHref={`/recipes/${recipe.id}`} />;
}

function CookPage() {
  return (
    <Suspense fallback={<p className="page text-muted">Loading…</p>}>
      <CookPageInner />
    </Suspense>
  );
}

export default withApp(CookPage);
