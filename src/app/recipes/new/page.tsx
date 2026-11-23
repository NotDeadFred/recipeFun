"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { RecipeForm } from "@/components/recipe/RecipeForm";
import { takePendingDraft } from "@/lib/draftStore";

export default function NewRecipePage() {
  // Pages stay mounted between visits; start a fresh form on each new visit.
  const { bfcacheId } = useRouter();
  return <NewRecipe key={bfcacheId} />;
}

function NewRecipe() {
  const router = useRouter();
  const { repo } = useApp();
  // A draft handed over from import or Claude ("Edit before saving").
  const [initial] = useState(() => (typeof window === "undefined" ? null : takePendingDraft()));

  return (
    <div className="page max-w-4xl">
      <h1 className="page-title mb-1">{initial ? "Review recipe" : "Write a recipe"}</h1>
      <p className="mb-6 text-muted">
        {initial ? "Make any changes, then save it to your recipes." : "Type or paste your recipe. Steps become a guided walkthrough."}
      </p>
      <RecipeForm
        initial={initial}
        onCancel={() => router.back()}
        onSubmit={async (draft) => {
          const saved = await repo.saveRecipe(draft);
          router.push(`/recipes/${saved.id}`);
        }}
      />
    </div>
  );
}
