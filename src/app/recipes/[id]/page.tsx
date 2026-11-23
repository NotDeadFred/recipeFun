"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp, withApp } from "@/components/AppProvider";
import { RecipeView } from "@/components/recipe/RecipeView";
import { AddToCookbook } from "@/components/recipe/AddToCookbook";
import { useAsync } from "@/lib/hooks";
import { addToShoppingList } from "@/lib/shoppingList";
import type { UnitSystem } from "@/lib/types";

function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { repo, profile } = useApp();
  const { data: recipe, loading } = useAsync(() => repo.getRecipe(id), [repo, id]);
  const [servings, setServings] = useState<number | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem | null>(profile.unitSystem === "metric" ? "metric" : null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <p className="page text-muted">Loading…</p>;
  if (!recipe) {
    return (
      <div className="page text-center">
        <p className="text-lg">Recipe not found.</p>
        <Link href="/" className="btn mt-4">
          Back to recipes
        </Link>
      </div>
    );
  }

  const currentServings = servings ?? recipe.servings;
  const isOwner = recipe.ownerId === profile.id;
  const cookParams = new URLSearchParams({ servings: String(currentServings) });
  if (unitSystem) cookParams.set("units", unitSystem);

  async function addToList() {
    const list = await repo.getShoppingList();
    await repo.saveShoppingList(addToShoppingList(list, recipe!.ingredients, recipe!.id, currentServings / recipe!.servings));
    setMessage("Added to your shopping list.");
  }

  async function remove() {
    if (!confirm(`Delete “${recipe!.title}”? This can't be undone.`)) return;
    await repo.deleteRecipe(recipe!.id);
    router.push("/");
  }

  return (
    <div className="page">
      <RecipeView
        recipe={recipe}
        servings={currentServings}
        onServingsChange={setServings}
        unitSystem={unitSystem}
        onUnitSystemChange={setUnitSystem}
        actions={
          <>
            <Link href={`/recipes/${recipe.id}/cook?${cookParams}`} className="btn-primary">
              👩‍🍳 Start cooking
            </Link>
            <AddToCookbook recipeId={recipe.id} />
            <button className="btn" onClick={addToList}>
              🛒 Add to shopping list
            </button>
            {isOwner && (
              <>
                <Link href={`/recipes/${recipe.id}/edit`} className="btn">
                  Edit
                </Link>
                <button className="btn text-danger" onClick={remove}>
                  Delete
                </button>
              </>
            )}
          </>
        }
      />
      {message && (
        <p className="fixed inset-x-0 bottom-20 mx-auto w-fit rounded-full bg-foreground px-4 py-2 text-background shadow-lg md:bottom-6" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

export default withApp(RecipePage);
