import type { RecipeDraft } from "./types";
import { buildRecipeDraft } from "./recipeBuilder";

/** "PT1H30M" -> 90. Returns null for missing or malformed durations. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m || value.trim().toUpperCase() === "P" || value.trim().toUpperCase() === "PT") return null;
  const [, d, h, min, s] = m.map((x) => (x ? Number(x) : 0)) as number[];
  const total = d * 1440 + h * 60 + min + s / 60;
  return total > 0 ? Math.round(total) : null;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°",
  frac12: "½", frac14: "¼", frac34: "¾", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", hellip: "…",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

type Json = Record<string, unknown>;

function isRecipeNode(node: unknown): node is Json {
  if (!node || typeof node !== "object") return false;
  const type = (node as Json)["@type"];
  if (typeof type === "string") return type.toLowerCase() === "recipe";
  if (Array.isArray(type)) return type.some((t) => typeof t === "string" && t.toLowerCase() === "recipe");
  return false;
}

/** Walk any JSON-LD shape (arrays, @graph, nested mainEntity) to find a Recipe node. */
export function findRecipeNode(data: unknown): Json | null {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (isRecipeNode(data)) return data;
  const obj = data as Json;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    if (obj[key]) {
      const found = findRecipeNode(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, "");
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Some sites emit invalid JSON (stray control chars); try once more after stripping them.
      try {
        blocks.push(JSON.parse(raw.replace(/[\u0000-\u001f]+/g, " ")));
      } catch {
        /* skip unparseable block */
      }
    }
  }
  return blocks;
}

function pickImage(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return pickImage(image[image.length - 1] ?? image[0]);
  if (typeof image === "object") {
    const obj = image as Json;
    if (typeof obj.url === "string") return obj.url;
    if (typeof obj["@id"] === "string" && /^https?:/.test(obj["@id"] as string)) return obj["@id"] as string;
  }
  return null;
}

function parseYield(value: unknown): number | null {
  const values = Array.isArray(value) ? value : [value];
  for (const v of values) {
    if (typeof v === "number" && v > 0) return Math.round(v);
    if (typeof v === "string") {
      const m = v.match(/\d+/);
      if (m) return Number(m[0]);
    }
  }
  return null;
}

function toStringList(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(toStringList);
  return [];
}

/** Flatten recipeInstructions: strings, HowToStep, HowToSection, nested lists. */
export function flattenInstructions(
  value: unknown,
  group: string | null = null,
): Array<{ text: string; group: string | null }> {
  if (!value) return [];
  if (typeof value === "string") {
    const cleaned = value.replace(/<\/(p|li)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
    return cleaned
      .split(/\n+/)
      .map((t) => cleanText(t).replace(/^\d+[.)]\s*/, ""))
      .filter(Boolean)
      .map((text) => ({ text, group }));
  }
  if (Array.isArray(value)) return value.flatMap((v) => flattenInstructions(v, group));
  if (typeof value === "object") {
    const obj = value as Json;
    const type = String(obj["@type"] ?? "");
    if (type === "HowToSection") {
      const name = cleanText(obj.name) || group;
      return flattenInstructions(obj.itemListElement ?? obj.steps, name);
    }
    if (obj.itemListElement) return flattenInstructions(obj.itemListElement, group);
    const text = cleanText(obj.text ?? obj.name ?? obj.description);
    return text ? [{ text, group }] : [];
  }
  return [];
}

function siteName(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Convert a schema.org Recipe node to a draft. */
export function recipeNodeToDraft(node: Json, sourceUrl: string): RecipeDraft {
  const ingredients = toStringList(node.recipeIngredient ?? node.ingredients).map(cleanText).filter(Boolean);
  const steps = flattenInstructions(node.recipeInstructions);
  const publisher = node.publisher as Json | undefined;
  return buildRecipeDraft({
    title: cleanText(node.name) || "Imported recipe",
    description: cleanText(node.description) || null,
    imageUrl: pickImage(node.image),
    sourceType: "imported",
    sourceUrl,
    sourceName: cleanText(publisher?.name) || siteName(sourceUrl),
    servings: parseYield(node.recipeYield),
    prepMinutes: parseIsoDuration(node.prepTime),
    cookMinutes: parseIsoDuration(node.cookTime),
    totalMinutes: parseIsoDuration(node.totalTime),
    cuisine: toStringList(node.recipeCuisine)[0] ?? null,
    tags: [...toStringList(node.recipeCategory), ...toStringList(node.keywords)].slice(0, 12),
    ingredients,
    steps,
  });
}

/** Find and convert the first schema.org Recipe in a page. Returns null if none. */
export function extractRecipeFromHtml(html: string, sourceUrl: string): RecipeDraft | null {
  for (const block of extractJsonLdBlocks(html)) {
    const node = findRecipeNode(block);
    if (node) {
      const draft = recipeNodeToDraft(node, sourceUrl);
      if (draft.ingredients.length > 0 || draft.steps.length > 0) return draft;
    }
  }
  return null;
}

/** Readable text of a page, for handing to Claude when there is no structured data. */
export function htmlToText(html: string, maxChars = 40000): string {
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return decodeEntities(body.replace(/<[^>]*>/g, " "))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, maxChars);
}
