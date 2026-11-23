import { describe, expect, it } from "vitest";
import { fitWithin, isSupportedImage } from "./images";
import { recipePhotos, buildRecipeDraft } from "./recipeBuilder";

describe("fitWithin", () => {
  it("leaves small images alone", () => {
    expect(fitWithin(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });
  it("shrinks landscape and portrait photos to the longest side", () => {
    expect(fitWithin(4032, 3024, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3024, 4032, 1024)).toEqual({ width: 768, height: 1024 });
  });
});

describe("isSupportedImage", () => {
  it("accepts images by type or extension (iPad HEIC included)", () => {
    expect(isSupportedImage(new File([""], "a.jpg", { type: "image/jpeg" }))).toBe(true);
    expect(isSupportedImage(new File([""], "IMG_0001.HEIC", { type: "" }))).toBe(true);
  });
  it("rejects other files", () => {
    expect(isSupportedImage(new File([""], "notes.pdf", { type: "application/pdf" }))).toBe(false);
  });
});

describe("recipePhotos", () => {
  it("uses the photo list when present", () => {
    expect(recipePhotos({ photos: ["a", "b"], imageUrl: "a" })).toEqual(["a", "b"]);
  });
  it("falls back to the cover for older or imported recipes", () => {
    expect(recipePhotos({ imageUrl: "x" })).toEqual(["x"]);
    expect(recipePhotos({ photos: [], imageUrl: null })).toEqual([]);
  });
  it("keeps the cover in sync when building a draft", () => {
    const draft = buildRecipeDraft({ title: "T", sourceType: "manual", ingredients: [], steps: ["Go."], photos: ["p1", "p2"] });
    expect(draft.imageUrl).toBe("p1");
    expect(draft.photos).toEqual(["p1", "p2"]);
    const imported = buildRecipeDraft({ title: "T", sourceType: "imported", ingredients: [], steps: ["Go."], imageUrl: "site.jpg" });
    expect(imported.photos).toEqual(["site.jpg"]);
  });
});
