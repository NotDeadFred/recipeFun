"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { RecipeDraft, UnitSystem } from "@/lib/types";
import { setPendingDraft } from "@/lib/draftStore";
import { useApp } from "../AppProvider";
import { RecipeView } from "./RecipeView";

/** Preview an imported or generated recipe before saving it. */
export function DraftPreview({ draft, onDiscard, extraActions }: { draft: RecipeDraft; onDiscard: () => void; extraActions?: ReactNode }) {
  const router = useRouter();
  const { repo, profile } = useApp();
  const [servings, setServings] = useState(draft.servings);
  const [unitSystem, setUnitSystem] = useState<UnitSystem | null>(profile.unitSystem === "metric" ? "metric" : null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const saved = await repo.saveRecipe(draft);
    router.push(`/recipes/${saved.id}`);
  }

  return (
    <div className="card mt-6 p-4 sm:p-6" data-testid="draft-preview">
      <RecipeView
        recipe={draft}
        servings={servings}
        onServingsChange={setServings}
        unitSystem={unitSystem}
        onUnitSystemChange={setUnitSystem}
        actions={
          <>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save to my recipes"}
            </button>
            <button
              className="btn"
              onClick={() => {
                setPendingDraft(draft);
                router.push("/recipes/new");
              }}
            >
              Edit before saving
            </button>
            {extraActions}
            <button className="btn-ghost" onClick={onDiscard}>
              Discard
            </button>
          </>
        }
      />
    </div>
  );
}
