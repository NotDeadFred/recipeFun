import type { Cookbook, Group, Profile, Recipe, RecipeDraft, SavedSite, ShoppingItem } from "../types";
import { newId, newInviteCode } from "../ids";
import { DEFAULT_SITES, type Repository } from "./repository";
import { SAMPLE_RECIPES } from "./sampleRecipes";

const KEY = "recipefun:v1";
export const LOCAL_USER_ID = "local-user";

interface LocalDb {
  profile: Profile;
  recipes: Recipe[];
  cookbooks: Cookbook[];
  groups: Group[];
  sites: SavedSite[];
  shopping: ShoppingItem[];
}

function seed(): LocalDb {
  const now = new Date().toISOString();
  return {
    profile: { id: LOCAL_USER_ID, displayName: "Home Cook", unitSystem: "us" },
    recipes: SAMPLE_RECIPES.map((r) => ({ ...r, id: newId(), ownerId: LOCAL_USER_ID, createdAt: now, updatedAt: now })),
    cookbooks: [],
    groups: [],
    sites: DEFAULT_SITES.map((s) => ({ ...s, id: newId() })),
    shopping: [],
  };
}

/** Browser-only storage for demo mode. Groups work locally but aren't shared with anyone. */
export class LocalRepository implements Repository {
  readonly mode = "local" as const;

  constructor(private storage: Storage = window.localStorage) {}

  private load(): LocalDb {
    try {
      const raw = this.storage.getItem(KEY);
      if (raw) return JSON.parse(raw) as LocalDb;
    } catch {
      /* corrupted or unavailable: start fresh */
    }
    const db = seed();
    this.write(db);
    return db;
  }

  private write(db: LocalDb) {
    try {
      this.storage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        throw new Error("This device's storage is full. Remove some photos, or connect Supabase to store photos online.");
      }
      /* private mode: keep working in memory for this call */
    }
  }

  private update<T>(fn: (db: LocalDb) => T): T {
    const db = this.load();
    const result = fn(db);
    this.write(db);
    return result;
  }

  async getProfile() {
    return this.load().profile;
  }

  async updateProfile(changes: Partial<Pick<Profile, "displayName" | "unitSystem">>) {
    return this.update((db) => {
      db.profile = { ...db.profile, ...changes };
      return db.profile;
    });
  }

  async listRecipes() {
    return [...this.load().recipes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getRecipe(id: string) {
    return this.load().recipes.find((r) => r.id === id) ?? null;
  }

  async saveRecipe(input: RecipeDraft | Recipe) {
    return this.update((db) => {
      const now = new Date().toISOString();
      const existing = input.id ? db.recipes.find((r) => r.id === input.id) : undefined;
      if (existing) {
        Object.assign(existing, input, { updatedAt: now });
        return existing;
      }
      const recipe: Recipe = { ...input, id: input.id ?? newId(), ownerId: LOCAL_USER_ID, createdAt: now, updatedAt: now };
      db.recipes.push(recipe);
      return recipe;
    });
  }

  async deleteRecipe(id: string) {
    this.update((db) => {
      db.recipes = db.recipes.filter((r) => r.id !== id);
      db.cookbooks.forEach((c) => (c.recipeIds = c.recipeIds.filter((r) => r !== id)));
    });
  }

  /**
   * Local mode has no file storage, so photos are kept inline as data URLs.
   * Browser storage is limited (about 5 MB), so the form resizes photos small.
   */
  async uploadPhoto(photo: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Couldn't read that photo."));
      reader.readAsDataURL(photo);
    });
  }

  async listCookbooks() {
    return this.load().cookbooks;
  }

  async getCookbook(id: string) {
    return this.load().cookbooks.find((c) => c.id === id) ?? null;
  }

  async saveCookbook(input: Pick<Cookbook, "name"> & Partial<Cookbook>) {
    return this.update((db) => {
      const existing = input.id ? db.cookbooks.find((c) => c.id === input.id) : undefined;
      if (existing) {
        Object.assign(existing, input);
        return existing;
      }
      const cookbook: Cookbook = {
        id: newId(),
        ownerId: LOCAL_USER_ID,
        description: null,
        groupId: null,
        recipeIds: [],
        createdAt: new Date().toISOString(),
        ...input,
      };
      db.cookbooks.push(cookbook);
      return cookbook;
    });
  }

  async deleteCookbook(id: string) {
    this.update((db) => {
      db.cookbooks = db.cookbooks.filter((c) => c.id !== id);
    });
  }

  async addRecipeToCookbook(cookbookId: string, recipeId: string) {
    this.update((db) => {
      const c = db.cookbooks.find((x) => x.id === cookbookId);
      if (c && !c.recipeIds.includes(recipeId)) c.recipeIds.push(recipeId);
    });
  }

  async removeRecipeFromCookbook(cookbookId: string, recipeId: string) {
    this.update((db) => {
      const c = db.cookbooks.find((x) => x.id === cookbookId);
      if (c) c.recipeIds = c.recipeIds.filter((r) => r !== recipeId);
    });
  }

  async listGroups() {
    return this.load().groups;
  }

  async getGroup(id: string) {
    return this.load().groups.find((g) => g.id === id) ?? null;
  }

  async createGroup(name: string) {
    return this.update((db) => {
      const group: Group = {
        id: newId(),
        name: name.trim(),
        ownerId: LOCAL_USER_ID,
        inviteCode: newInviteCode(),
        members: [{ userId: LOCAL_USER_ID, displayName: db.profile.displayName, role: "owner" }],
        createdAt: new Date().toISOString(),
      };
      db.groups.push(group);
      return group;
    });
  }

  async joinGroup(inviteCode: string): Promise<Group> {
    const group = this.load().groups.find((g) => g.inviteCode === inviteCode.trim().toUpperCase());
    if (!group) {
      throw new Error("Invite codes from other people need an account. Set up Supabase to share across devices.");
    }
    return group;
  }

  async leaveGroup(groupId: string) {
    await this.deleteGroup(groupId);
  }

  async deleteGroup(groupId: string) {
    this.update((db) => {
      db.groups = db.groups.filter((g) => g.id !== groupId);
      db.cookbooks.forEach((c) => {
        if (c.groupId === groupId) c.groupId = null;
      });
    });
  }

  async listSites() {
    return this.load().sites;
  }

  async saveSite(input: Omit<SavedSite, "id"> & Partial<Pick<SavedSite, "id">>) {
    return this.update((db) => {
      const existing = input.id ? db.sites.find((s) => s.id === input.id) : undefined;
      if (existing) {
        Object.assign(existing, input);
        return existing;
      }
      const site: SavedSite = { ...input, id: newId() };
      db.sites.push(site);
      return site;
    });
  }

  async deleteSite(id: string) {
    this.update((db) => {
      db.sites = db.sites.filter((s) => s.id !== id);
    });
  }

  async getShoppingList() {
    return this.load().shopping;
  }

  async saveShoppingList(items: ShoppingItem[]) {
    this.update((db) => {
      db.shopping = items;
    });
  }
}
