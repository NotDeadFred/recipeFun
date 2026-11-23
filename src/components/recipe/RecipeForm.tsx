"use client";

import { useState, type FormEvent } from "react";
import type { Recipe, RecipeDraft } from "@/lib/types";
import { buildRecipeDraft, parseSectionedText, toSectionedText } from "@/lib/recipeBuilder";

interface Props {
  initial?: Recipe | RecipeDraft | null;
  submitLabel?: string;
  onSubmit: (draft: RecipeDraft) => Promise<void> | void;
  onCancel?: () => void;
}

const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v)));

export function RecipeForm({ initial, submitLabel = "Save recipe", onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [servings, setServings] = useState(String(initial?.servings ?? 4));
  const [prep, setPrep] = useState(initial?.prepMinutes?.toString() ?? "");
  const [cook, setCook] = useState(initial?.cookMinutes?.toString() ?? "");
  const [cuisine, setCuisine] = useState(initial?.cuisine ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [ingredients, setIngredients] = useState(
    initial ? toSectionedText(initial.ingredients.map((i) => ({ text: i.raw || i.name, group: i.group }))) : "",
  );
  const [steps, setSteps] = useState(initial ? toSectionedText(initial.steps) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ingredientItems = parseSectionedText(ingredients, "ingredients");
    const stepItems = parseSectionedText(steps, "steps");
    if (!title.trim()) return setError("Give your recipe a name.");
    if (stepItems.length === 0) return setError("Add at least one step.");
    setError(null);
    setSaving(true);
    try {
      const draft = buildRecipeDraft({
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        sourceType: initial?.sourceType ?? "manual",
        sourceUrl: initial?.sourceUrl ?? null,
        sourceName: initial?.sourceName ?? null,
        servings: num(servings) ?? 4,
        prepMinutes: num(prep),
        cookMinutes: num(cook),
        // Recalculate total from prep/cook when they change; otherwise keep the original.
        totalMinutes:
          initial && num(prep) === (initial.prepMinutes ?? null) && num(cook) === (initial.cookMinutes ?? null)
            ? initial.totalMinutes
            : null,
        cuisine: cuisine || null,
        tags: tags.split(","),
        ingredients: ingredientItems,
        steps: stepItems.map((s) => ({ text: s.line, group: s.group })),
        notes: notes || null,
      });
      await onSubmit(initial?.id ? { ...draft, id: initial.id } : draft);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-label="Recipe form">
      <label className="field">
        <span>Recipe name</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Grandma's lasagna" required />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="field">
          <span>Servings</span>
          <input type="number" min={1} inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} />
        </label>
        <label className="field">
          <span>Prep (min)</span>
          <input type="number" min={0} inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} />
        </label>
        <label className="field">
          <span>Cook (min)</span>
          <input type="number" min={0} inputMode="numeric" value={cook} onChange={(e) => setCook(e.target.value)} />
        </label>
        <label className="field">
          <span>Cuisine</span>
          <input value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Italian" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Tags (comma separated)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="dinner, freezer-friendly" />
        </label>
        <label className="field">
          <span>Photo URL</span>
          <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span>Ingredients — one per line</span>
          <textarea
            rows={12}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder={"2 cups flour\n1 tsp salt\n\n# For the sauce\n1 can crushed tomatoes"}
            className="font-mono text-sm"
          />
          <span className="text-xs font-normal text-muted">Start a line with # to make a section.</span>
        </label>
        <label className="field">
          <span>Steps — one per line</span>
          <textarea
            rows={12}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder={"Preheat the oven to 375°F.\nMix the flour and salt.\nBake for 25 minutes."}
          />
          <span className="text-xs font-normal text-muted">Times like “10 minutes” become timers in cook mode.</span>
        </label>
      </div>
      <label className="field">
        <span>Notes</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && (
        <p className="text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
