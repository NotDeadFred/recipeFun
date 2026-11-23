export type RecipeSource = "imported" | "manual" | "claude";
export type UnitSystem = "us" | "metric";

export interface Ingredient {
  id: string;
  /** The original line as written, e.g. "1 1/2 cups flour, sifted". */
  raw: string;
  quantity: number | null;
  /** Upper bound when the line gives a range, e.g. "2-3 cloves". */
  quantityMax?: number | null;
  unit: string | null;
  name: string;
  note?: string | null;
  /** Optional section heading, e.g. "For the sauce". */
  group?: string | null;
}

export interface Step {
  id: string;
  text: string;
  /** Ingredients this step uses; drives highlighting in cook mode. */
  ingredientIds: string[];
  /** Timer detected from (or set for) the step, in seconds. */
  timerSeconds?: number | null;
  group?: string | null;
}

export interface Recipe {
  id: string;
  ownerId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  sourceType: RecipeSource;
  sourceUrl?: string | null;
  sourceName?: string | null;
  servings: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  cuisine?: string | null;
  tags: string[];
  ingredients: Ingredient[];
  steps: Step[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A recipe before it has been saved (no id/owner/timestamps yet). */
export type RecipeDraft = Omit<Recipe, "id" | "ownerId" | "createdAt" | "updatedAt"> &
  Partial<Pick<Recipe, "id">>;

export interface Profile {
  id: string;
  displayName: string;
  email?: string | null;
  unitSystem: UnitSystem;
}

export type GroupRole = "owner" | "member";

export interface GroupMember {
  userId: string;
  displayName: string;
  role: GroupRole;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  members: GroupMember[];
  createdAt: string;
}

export interface Cookbook {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  /** When set, everyone in this group can see the cookbook and its recipes. */
  groupId?: string | null;
  recipeIds: string[];
  createdAt: string;
}

export interface SavedSite {
  id: string;
  name: string;
  url: string;
  /** Search URL with a {query} placeholder, e.g. https://site.com/search?q={query} */
  searchUrl?: string | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  recipeIds: string[];
}
