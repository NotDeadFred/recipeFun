"use client";

import { useParams, useRouter } from "next/navigation";
import { useApp, withApp } from "@/components/AppProvider";
import { RecipeForm } from "@/components/recipe/RecipeForm";
import { usePhotoUpload } from "@/components/recipe/usePhotoUpload";
import { useAsync } from "@/lib/hooks";

function EditRecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { bfcacheId } = router;
  const { repo } = useApp();
  const uploadPhoto = usePhotoUpload();
  const { data: recipe, loading } = useAsync(() => repo.getRecipe(id), [repo, id]);

  if (loading) return <p className="page text-muted">Loading…</p>;
  if (!recipe) return <p className="page">Recipe not found.</p>;

  return (
    <div className="page max-w-4xl">
      <h1 className="page-title mb-6">Edit recipe</h1>
      <RecipeForm
        key={`${bfcacheId}-${recipe.updatedAt}`}
        initial={recipe}
        uploadPhoto={uploadPhoto}
        onCancel={() => router.back()}
        onSubmit={async (draft) => {
          const saved = await repo.saveRecipe({ ...recipe, ...draft, id: recipe.id });
          router.push(`/recipes/${saved.id}`);
        }}
      />
    </div>
  );
}

export default withApp(EditRecipePage);
