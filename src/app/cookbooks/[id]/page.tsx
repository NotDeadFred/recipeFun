"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import { useAsync } from "@/lib/hooks";

export default function CookbookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { repo, profile } = useApp();
  const { data, loading, reload } = useAsync(async () => {
    const [cookbook, recipes, groups] = await Promise.all([repo.getCookbook(id), repo.listRecipes(), repo.listGroups()]);
    return { cookbook, recipes, groups };
  }, [repo, id]);

  if (loading && !data) return <p className="page text-muted">Loading…</p>;
  const cookbook = data?.cookbook;
  if (!cookbook) return <p className="page">Cookbook not found.</p>;

  const isOwner = cookbook.ownerId === profile.id;
  const recipes = data!.recipes.filter((r) => cookbook.recipeIds.includes(r.id));

  async function share(groupId: string) {
    await repo.saveCookbook({ ...cookbook!, groupId: groupId || null });
    await reload();
  }

  async function remove() {
    if (!confirm(`Delete the cookbook “${cookbook!.name}”? The recipes themselves are kept.`)) return;
    await repo.deleteCookbook(cookbook!.id);
    router.push("/cookbooks");
  }

  return (
    <div className="page">
      <Link href="/cookbooks" className="text-sm text-brand">
        ← Cookbooks
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title">📚 {cookbook.name}</h1>
        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              Shared with
              <select className="input w-auto" value={cookbook.groupId ?? ""} onChange={(e) => share(e.target.value)} aria-label="Share with group">
                <option value="">Just me</option>
                {data!.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn text-danger" onClick={remove}>
              Delete cookbook
            </button>
          </div>
        )}
      </div>

      {recipes.length === 0 ? (
        <p className="mt-8 text-center text-muted">No recipes yet. Open a recipe and choose “Add to cookbook”.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <li key={r.id} className="relative">
              <RecipeCard recipe={r} shared={r.ownerId !== profile.id} />
              <button
                className="absolute top-2 right-2 rounded-full bg-surface/90 px-3 py-1 text-sm shadow"
                onClick={async () => {
                  await repo.removeRecipeFromCookbook(cookbook.id, r.id);
                  await reload();
                }}
                aria-label={`Remove ${r.title} from cookbook`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
