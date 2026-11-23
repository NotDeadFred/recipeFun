import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cookbook, Group, GroupMember, Profile, Recipe, RecipeDraft, SavedSite, ShoppingItem } from "../types";
import { DEFAULT_SITES, type Repository } from "./repository";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function rowToRecipe(r: any): Recipe {
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    description: r.description,
    imageUrl: r.image_url,
    photos: r.photos ?? (r.image_url ? [r.image_url] : []),
    sourceType: r.source_type,
    sourceUrl: r.source_url,
    sourceName: r.source_name,
    servings: r.servings,
    prepMinutes: r.prep_minutes,
    cookMinutes: r.cook_minutes,
    totalMinutes: r.total_minutes,
    cuisine: r.cuisine,
    tags: r.tags ?? [],
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function recipeToRow(r: RecipeDraft | Recipe) {
  return {
    title: r.title,
    description: r.description ?? null,
    image_url: r.photos?.[0] ?? r.imageUrl ?? null,
    photos: r.photos ?? (r.imageUrl ? [r.imageUrl] : []),
    source_type: r.sourceType,
    source_url: r.sourceUrl ?? null,
    source_name: r.sourceName ?? null,
    servings: r.servings,
    prep_minutes: r.prepMinutes ?? null,
    cook_minutes: r.cookMinutes ?? null,
    total_minutes: r.totalMinutes ?? null,
    cuisine: r.cuisine ?? null,
    tags: r.tags,
    ingredients: r.ingredients,
    steps: r.steps,
    notes: r.notes ?? null,
    updated_at: new Date().toISOString(),
  };
}

function rowToCookbook(c: any): Cookbook {
  return {
    id: c.id,
    ownerId: c.owner_id,
    name: c.name,
    description: c.description,
    groupId: c.group_id,
    recipeIds: (c.cookbook_recipes ?? []).map((cr: any) => cr.recipe_id),
    createdAt: c.created_at,
  };
}

/** Shared, multi-user storage. Access rules are enforced by row-level security in the database. */
export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;

  constructor(
    private db: SupabaseClient,
    private userId: string,
    private email: string | null,
  ) {}

  async getProfile(): Promise<Profile> {
    const p = check(await this.db.from("profiles").select("*").eq("id", this.userId).single());
    return { id: p.id, displayName: p.display_name, unitSystem: p.unit_system, email: this.email };
  }

  async updateProfile(changes: Partial<Pick<Profile, "displayName" | "unitSystem">>) {
    const row: Record<string, unknown> = {};
    if (changes.displayName !== undefined) row.display_name = changes.displayName;
    if (changes.unitSystem !== undefined) row.unit_system = changes.unitSystem;
    check(await this.db.from("profiles").update(row).eq("id", this.userId));
    return this.getProfile();
  }

  async listRecipes() {
    const rows = check(await this.db.from("recipes").select("*").order("updated_at", { ascending: false }));
    return (rows ?? []).map(rowToRecipe);
  }

  async getRecipe(id: string) {
    const row = check(await this.db.from("recipes").select("*").eq("id", id).maybeSingle());
    return row ? rowToRecipe(row) : null;
  }

  async saveRecipe(input: RecipeDraft | Recipe) {
    const row = recipeToRow(input);
    if (input.id) {
      const existing = check(await this.db.from("recipes").select("id").eq("id", input.id).maybeSingle());
      if (existing) {
        return rowToRecipe(check(await this.db.from("recipes").update(row).eq("id", input.id).select().single()));
      }
    }
    return rowToRecipe(check(await this.db.from("recipes").insert({ ...row, owner_id: this.userId }).select().single()));
  }

  async deleteRecipe(id: string) {
    check(await this.db.from("recipes").delete().eq("id", id));
  }

  async uploadPhoto(photo: Blob): Promise<string> {
    const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const path = `${this.userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.db.storage
      .from("recipe-photos")
      .upload(path, photo, { contentType: photo.type || "image/jpeg", cacheControl: "31536000" });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    return this.db.storage.from("recipe-photos").getPublicUrl(path).data.publicUrl;
  }

  async listCookbooks() {
    const rows = check(await this.db.from("cookbooks").select("*, cookbook_recipes(recipe_id)").order("created_at"));
    return (rows ?? []).map(rowToCookbook);
  }

  async getCookbook(id: string) {
    const row = check(await this.db.from("cookbooks").select("*, cookbook_recipes(recipe_id)").eq("id", id).maybeSingle());
    return row ? rowToCookbook(row) : null;
  }

  async saveCookbook(input: Pick<Cookbook, "name"> & Partial<Cookbook>) {
    const row = { name: input.name, description: input.description ?? null, group_id: input.groupId ?? null };
    const saved = input.id
      ? check(await this.db.from("cookbooks").update(row).eq("id", input.id).select("*, cookbook_recipes(recipe_id)").single())
      : check(
          await this.db
            .from("cookbooks")
            .insert({ ...row, owner_id: this.userId })
            .select("*, cookbook_recipes(recipe_id)")
            .single(),
        );
    return rowToCookbook(saved);
  }

  async deleteCookbook(id: string) {
    check(await this.db.from("cookbooks").delete().eq("id", id));
  }

  async addRecipeToCookbook(cookbookId: string, recipeId: string) {
    check(
      await this.db
        .from("cookbook_recipes")
        .upsert({ cookbook_id: cookbookId, recipe_id: recipeId, added_by: this.userId }, { ignoreDuplicates: true }),
    );
  }

  async removeRecipeFromCookbook(cookbookId: string, recipeId: string) {
    check(await this.db.from("cookbook_recipes").delete().eq("cookbook_id", cookbookId).eq("recipe_id", recipeId));
  }

  private async withMembers(groups: any[]): Promise<Group[]> {
    if (groups.length === 0) return [];
    const ids = groups.map((g) => g.id);
    const members = check(await this.db.from("group_members").select("group_id, user_id, role").in("group_id", ids)) ?? [];
    const userIds = Array.from(new Set(members.map((m: any) => m.user_id)));
    const profiles = userIds.length
      ? (check(await this.db.from("profiles").select("id, display_name").in("id", userIds)) ?? [])
      : [];
    const names = new Map(profiles.map((p: any) => [p.id, p.display_name]));
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      ownerId: g.owner_id,
      inviteCode: g.invite_code,
      createdAt: g.created_at,
      members: members
        .filter((m: any) => m.group_id === g.id)
        .map(
          (m: any): GroupMember => ({
            userId: m.user_id,
            role: m.role,
            displayName: (names.get(m.user_id) as string) ?? "Member",
          }),
        ),
    }));
  }

  async listGroups() {
    return this.withMembers(check(await this.db.from("groups").select("*").order("created_at")) ?? []);
  }

  async getGroup(id: string) {
    const row = check(await this.db.from("groups").select("*").eq("id", id).maybeSingle());
    return row ? (await this.withMembers([row]))[0] : null;
  }

  async createGroup(name: string) {
    const row = check(await this.db.from("groups").insert({ name: name.trim(), owner_id: this.userId }).select().single());
    return (await this.withMembers([row]))[0];
  }

  async joinGroup(inviteCode: string) {
    const gid = check(await this.db.rpc("join_group", { code: inviteCode }));
    const group = await this.getGroup(gid as string);
    if (!group) throw new Error("Joined, but couldn't load the group.");
    return group;
  }

  async leaveGroup(groupId: string) {
    check(await this.db.from("group_members").delete().eq("group_id", groupId).eq("user_id", this.userId));
  }

  async deleteGroup(groupId: string) {
    check(await this.db.from("groups").delete().eq("id", groupId));
  }

  async listSites(): Promise<SavedSite[]> {
    let rows = check(await this.db.from("saved_sites").select("*").order("created_at")) ?? [];
    if (rows.length === 0) {
      rows =
        check(
          await this.db
            .from("saved_sites")
            .insert(DEFAULT_SITES.map((s) => ({ name: s.name, url: s.url, search_url: s.searchUrl, owner_id: this.userId })))
            .select(),
        ) ?? [];
    }
    return rows.map((s: any) => ({ id: s.id, name: s.name, url: s.url, searchUrl: s.search_url }));
  }

  async saveSite(input: Omit<SavedSite, "id"> & Partial<Pick<SavedSite, "id">>) {
    const row = { name: input.name, url: input.url, search_url: input.searchUrl ?? null };
    const s = input.id
      ? check(await this.db.from("saved_sites").update(row).eq("id", input.id).select().single())
      : check(await this.db.from("saved_sites").insert({ ...row, owner_id: this.userId }).select().single());
    return { id: s.id, name: s.name, url: s.url, searchUrl: s.search_url };
  }

  async deleteSite(id: string) {
    check(await this.db.from("saved_sites").delete().eq("id", id));
  }

  async getShoppingList(): Promise<ShoppingItem[]> {
    const row = check(await this.db.from("shopping_lists").select("items").eq("owner_id", this.userId).maybeSingle());
    return (row?.items as ShoppingItem[]) ?? [];
  }

  async saveShoppingList(items: ShoppingItem[]) {
    check(
      await this.db
        .from("shopping_lists")
        .upsert({ owner_id: this.userId, items, updated_at: new Date().toISOString() }),
    );
  }
}
