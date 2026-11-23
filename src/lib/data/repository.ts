import type {
  Cookbook,
  Group,
  Profile,
  Recipe,
  RecipeDraft,
  SavedSite,
  ShoppingItem,
} from "../types";

/**
 * Everything the UI needs from storage. Two implementations:
 * - LocalRepository: browser storage, single user, no setup (demo/offline).
 * - SupabaseRepository: real accounts, groups and shared cookbooks.
 */
export interface Repository {
  readonly mode: "local" | "supabase";

  getProfile(): Promise<Profile>;
  updateProfile(changes: Partial<Pick<Profile, "displayName" | "unitSystem">>): Promise<Profile>;

  /** Your recipes plus recipes in cookbooks shared with your groups. */
  listRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | null>;
  saveRecipe(recipe: RecipeDraft | Recipe): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;
  /** Store a (already resized) photo and return a URL that can be shown in <img>. */
  uploadPhoto(photo: Blob): Promise<string>;

  listCookbooks(): Promise<Cookbook[]>;
  getCookbook(id: string): Promise<Cookbook | null>;
  saveCookbook(cookbook: Pick<Cookbook, "name"> & Partial<Cookbook>): Promise<Cookbook>;
  deleteCookbook(id: string): Promise<void>;
  addRecipeToCookbook(cookbookId: string, recipeId: string): Promise<void>;
  removeRecipeFromCookbook(cookbookId: string, recipeId: string): Promise<void>;

  listGroups(): Promise<Group[]>;
  getGroup(id: string): Promise<Group | null>;
  createGroup(name: string): Promise<Group>;
  joinGroup(inviteCode: string): Promise<Group>;
  leaveGroup(groupId: string): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;

  listSites(): Promise<SavedSite[]>;
  saveSite(site: Omit<SavedSite, "id"> & Partial<Pick<SavedSite, "id">>): Promise<SavedSite>;
  deleteSite(id: string): Promise<void>;

  getShoppingList(): Promise<ShoppingItem[]>;
  saveShoppingList(items: ShoppingItem[]): Promise<void>;
}

export const DEFAULT_SITES: Omit<SavedSite, "id">[] = [
  { name: "Allrecipes", url: "https://www.allrecipes.com", searchUrl: "https://www.allrecipes.com/search?q={query}" },
  { name: "Serious Eats", url: "https://www.seriouseats.com", searchUrl: "https://www.seriouseats.com/search?q={query}" },
  { name: "BBC Good Food", url: "https://www.bbcgoodfood.com", searchUrl: "https://www.bbcgoodfood.com/search?q={query}" },
  { name: "Food Network", url: "https://www.foodnetwork.com", searchUrl: "https://www.foodnetwork.com/search/{query}-" },
  { name: "Budget Bytes", url: "https://www.budgetbytes.com", searchUrl: "https://www.budgetbytes.com/?s={query}" },
];
