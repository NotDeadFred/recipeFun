import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { formatMinutes } from "@/lib/timers";
import { SOURCE_LABEL } from "./RecipeView";

const SOURCE_EMOJI: Record<string, string> = { imported: "🌐", manual: "✍️", claude: "✨" };

export function RecipeCard({ recipe, shared }: { recipe: Recipe; shared?: boolean }) {
  return (
    <Link href={`/recipes/${recipe.id}`} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {recipe.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary recipe sites
        <img src={recipe.imageUrl} alt="" className="aspect-[4/3] w-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-2 text-5xl" aria-hidden>
          {SOURCE_EMOJI[recipe.sourceType]}
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-brand">
          {SOURCE_LABEL[recipe.sourceType]}
          {shared ? " · Shared with you" : ""}
        </p>
        <h3 className="mt-1 font-semibold group-hover:text-brand">{recipe.title}</h3>
        <p className="mt-auto pt-2 text-sm text-muted">
          {[formatMinutes(recipe.totalMinutes), `${recipe.ingredients.length} ingredients`, recipe.cuisine]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
