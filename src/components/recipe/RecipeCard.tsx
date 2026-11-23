import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { formatMinutes } from "@/lib/timers";
import { SOURCE_LABEL } from "./RecipeView";
import { recipePhotos } from "@/lib/recipeBuilder";

const SOURCE_ICON: Record<string, string> = { imported: "🌐", manual: "🍳", claude: "✨" };

export function RecipeCard({ recipe, shared }: { recipe: Recipe; shared?: boolean }) {
  const cover = recipePhotos(recipe)[0];
  const label = recipe.cuisine ?? recipe.tags[0] ?? SOURCE_LABEL[recipe.sourceType];
  return (
    <Link href={`/recipes/${recipe.id}`} className="group flex flex-col focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
      <div className="relative overflow-hidden rounded-md bg-surface-2">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary recipe sites and uploads
          <img
            src={cover}
            alt=""
            className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-brand-soft text-brand" aria-hidden>
            <span className="text-5xl">{SOURCE_ICON[recipe.sourceType]}</span>
            <span className="text-xs font-bold tracking-[0.12em] uppercase opacity-70">No photo yet</span>
          </div>
        )}
        {recipe.sourceType === "claude" && (
          <span className="absolute top-2 left-2 rounded-sm bg-surface/95 px-2 py-1 text-[11px] font-bold tracking-wide text-brand uppercase">
            ✨ Claude
          </span>
        )}
        {shared && (
          <span className="absolute top-2 right-2 rounded-sm bg-surface/95 px-2 py-1 text-[11px] font-bold tracking-wide uppercase">
            Shared
          </span>
        )}
      </div>
      <p className="eyebrow mt-3">{label}</p>
      <h3 className="mt-1 text-lg leading-snug font-extrabold group-hover:underline group-hover:decoration-brand group-hover:decoration-2 group-hover:underline-offset-4">
        {recipe.title}
      </h3>
      <p className="mt-1 text-sm text-muted">
        {[formatMinutes(recipe.totalMinutes), `${recipe.ingredients.length} ingredients`, `Serves ${recipe.servings}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </Link>
  );
}
