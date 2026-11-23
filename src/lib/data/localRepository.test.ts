import { beforeEach, describe, expect, it } from "vitest";
import { LocalRepository } from "./localRepository";
import { buildRecipeDraft } from "../recipeBuilder";

describe("LocalRepository", () => {
  let repo: LocalRepository;
  beforeEach(() => {
    localStorage.clear();
    repo = new LocalRepository(localStorage);
  });

  it("seeds sample recipes and default sites on first use", async () => {
    expect((await repo.listRecipes()).length).toBeGreaterThan(0);
    expect((await repo.listSites()).map((s) => s.name)).toContain("Allrecipes");
  });

  it("saves, updates and deletes recipes", async () => {
    const saved = await repo.saveRecipe(
      buildRecipeDraft({ title: "Toast", sourceType: "manual", ingredients: ["1 slice bread"], steps: ["Toast it."] }),
    );
    expect(saved.id).toBeTruthy();
    const updated = await repo.saveRecipe({ ...saved, title: "Better Toast" });
    expect(updated.id).toBe(saved.id);
    expect((await repo.getRecipe(saved.id))?.title).toBe("Better Toast");
    await repo.deleteRecipe(saved.id);
    expect(await repo.getRecipe(saved.id)).toBeNull();
  });

  it("persists across instances", async () => {
    await repo.updateProfile({ displayName: "Fred" });
    expect((await new LocalRepository(localStorage).getProfile()).displayName).toBe("Fred");
  });

  it("manages cookbooks and removes deleted recipes from them", async () => {
    const [recipe] = await repo.listRecipes();
    const book = await repo.saveCookbook({ name: "Weeknights" });
    await repo.addRecipeToCookbook(book.id, recipe.id);
    await repo.addRecipeToCookbook(book.id, recipe.id);
    expect((await repo.getCookbook(book.id))?.recipeIds).toEqual([recipe.id]);
    await repo.deleteRecipe(recipe.id);
    expect((await repo.getCookbook(book.id))?.recipeIds).toEqual([]);
  });

  it("creates groups with the owner as a member and unshares cookbooks on delete", async () => {
    const group = await repo.createGroup("Family");
    expect(group.inviteCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(group.members[0].role).toBe("owner");
    const book = await repo.saveCookbook({ name: "Family Favorites", groupId: group.id });
    await repo.deleteGroup(group.id);
    expect((await repo.getCookbook(book.id))?.groupId).toBeNull();
  });

  it("explains that joining others' groups needs an account", async () => {
    await expect(repo.joinGroup("NOPE1234")).rejects.toThrow(/account/);
  });

  it("recovers from corrupted storage", async () => {
    localStorage.setItem("recipefun:v1", "{broken");
    expect((await new LocalRepository(localStorage).listRecipes()).length).toBeGreaterThan(0);
  });
});

describe("LocalRepository photos", () => {
  it("stores photos inline as data URLs", async () => {
    const repo = new LocalRepository(localStorage);
    const url = await repo.uploadPhoto(new Blob(["fake"], { type: "image/jpeg" }));
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("explains when device storage is full", async () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    } as unknown as Storage;
    await expect(new LocalRepository(full).listRecipes()).rejects.toThrow(/storage is full/);
  });
});
