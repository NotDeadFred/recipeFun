"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { GenerateRequest } from "@/lib/server/claude";

const FLAVORS = ["Spicy", "Smoky", "Savory", "Sweet", "Tangy", "Herby", "Garlicky", "Rich & creamy", "Fresh & light", "Umami", "Citrusy", "Comforting"];
const CUISINES = ["Italian", "Mexican", "Thai", "Indian", "Japanese", "Chinese", "Korean", "Mediterranean", "French", "Middle Eastern", "American", "Vietnamese"];
const DIETARY = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Low-carb", "High-protein", "Pescatarian"];
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Side dish"];

function ChipGroup({
  label,
  options,
  selected,
  onChange,
  single,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  single?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              type="button"
              key={o}
              className="chip"
              aria-pressed={on}
              onClick={() => onChange(single ? (on ? [] : [o]) : on ? selected.filter((s) => s !== o) : [...selected, o])}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export type ClaudeFormValues = Omit<GenerateRequest, "useOnlyListed" | "ingredients" | "flavors" | "dietary" | "equipment"> & {
  useOnlyListed: boolean;
  ingredients: string[];
  flavors: string[];
  dietary: string[];
  equipment: string[];
};

export function ClaudeRequestForm({ busy, onSubmit }: { busy: boolean; onSubmit: (req: ClaudeFormValues) => void }) {
  const [ingredientInput, setIngredientInput] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [useOnlyListed, setUseOnlyListed] = useState(false);
  const [flavors, setFlavors] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState<string[]>([]);
  const [customCuisine, setCustomCuisine] = useState("");
  const [meal, setMeal] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [maxMinutes, setMaxMinutes] = useState("");
  const [servings, setServings] = useState("4");
  const [skill, setSkill] = useState<"" | "easy" | "intermediate" | "advanced">("");
  const [notes, setNotes] = useState("");

  function addIngredients() {
    const items = ingredientInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !ingredients.includes(s));
    if (items.length) setIngredients([...ingredients, ...items]);
    setIngredientInput("");
  }

  function onIngredientKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addIngredients();
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const pending = ingredientInput.trim() ? [...ingredients, ...ingredientInput.split(",").map((s) => s.trim()).filter(Boolean)] : ingredients;
    onSubmit({
      ingredients: pending,
      useOnlyListed,
      flavors,
      cuisine: customCuisine.trim() || cuisine[0] || null,
      mealType: meal[0] ?? null,
      dietary,
      maxMinutes: maxMinutes ? Number(maxMinutes) : null,
      servings: servings ? Number(servings) : null,
      skill: skill || null,
      equipment: [],
      notes: notes.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" aria-label="Cooking with Claude">
      <div>
        <label htmlFor="claude-ingredients" className="mb-2 block text-sm font-medium">
          Ingredients you have or want to use
        </label>
        <div className="flex gap-2">
          <input
            id="claude-ingredients"
            className="input"
            placeholder="e.g. chicken thighs, lemons, spinach"
            value={ingredientInput}
            onChange={(e) => setIngredientInput(e.target.value)}
            onKeyDown={onIngredientKey}
          />
          <button type="button" className="btn" onClick={addIngredients}>
            Add
          </button>
        </div>
        {ingredients.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Chosen ingredients">
            {ingredients.map((i) => (
              <li key={i} className="chip bg-brand-soft">
                {i}
                <button type="button" aria-label={`Remove ${i}`} onClick={() => setIngredients(ingredients.filter((x) => x !== i))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-brand" checked={useOnlyListed} onChange={(e) => setUseOnlyListed(e.target.checked)} />
          Only use these (plus basic pantry staples)
        </label>
      </div>

      <ChipGroup label="Flavor profile" options={FLAVORS} selected={flavors} onChange={setFlavors} />
      <div>
        <ChipGroup label="Cuisine" options={CUISINES} selected={cuisine} onChange={setCuisine} single />
        <input
          className="input mt-2 sm:max-w-xs"
          placeholder="Or type any cuisine…"
          value={customCuisine}
          onChange={(e) => setCustomCuisine(e.target.value)}
          aria-label="Custom cuisine"
        />
      </div>
      <ChipGroup label="Meal" options={MEALS} selected={meal} onChange={setMeal} single />
      <ChipGroup label="Dietary needs" options={DIETARY} selected={dietary} onChange={setDietary} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="field">
          <span>Max total time (min)</span>
          <input type="number" min={5} inputMode="numeric" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value)} placeholder="Any" />
        </label>
        <label className="field">
          <span>Servings</span>
          <input type="number" min={1} max={50} inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} />
        </label>
        <label className="field">
          <span>Skill level</span>
          <select value={skill} onChange={(e) => setSkill(e.target.value as typeof skill)}>
            <option value="">Any</option>
            <option value="easy">Easy</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>Anything else?</span>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Kid-friendly, one-pot, use up leftover rice, date-night special…"
        />
      </label>

      <button className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? "Claude is cooking up a recipe…" : "✨ Create my recipe"}
      </button>
    </form>
  );
}
