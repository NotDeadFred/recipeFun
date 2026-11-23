import type { Ingredient } from "./types";
import { newId } from "./ids";

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅐": 1 / 7,
  "⅑": 1 / 9,
  "⅒": 0.1,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

/** Canonical unit name -> spellings that map to it. */
const UNIT_ALIASES: Record<string, string[]> = {
  cup: ["cup", "cups", "c"],
  tbsp: ["tablespoon", "tablespoons", "tbsp", "tbsps", "tbs", "tbl", "T"],
  tsp: ["teaspoon", "teaspoons", "tsp", "tsps", "t"],
  oz: ["ounce", "ounces", "oz"],
  "fl oz": ["fluid ounce", "fluid ounces", "fl oz", "fl. oz."],
  lb: ["pound", "pounds", "lb", "lbs"],
  g: ["gram", "grams", "g", "gr"],
  kg: ["kilogram", "kilograms", "kg", "kgs"],
  ml: ["milliliter", "milliliters", "millilitre", "millilitres", "ml", "mL"],
  l: ["liter", "liters", "litre", "litres", "l", "L"],
  pint: ["pint", "pints", "pt"],
  quart: ["quart", "quarts", "qt"],
  gallon: ["gallon", "gallons", "gal"],
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
  clove: ["clove", "cloves"],
  can: ["can", "cans"],
  package: ["package", "packages", "pkg"],
  stick: ["stick", "sticks"],
  slice: ["slice", "slices"],
  bunch: ["bunch", "bunches"],
  sprig: ["sprig", "sprigs"],
  piece: ["piece", "pieces"],
  head: ["head", "heads"],
};

const UNIT_LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(UNIT_ALIASES)) {
  for (const alias of aliases) {
    // Single-letter "T"/"t" are case-sensitive (tablespoon vs teaspoon).
    UNIT_LOOKUP.set(alias.length === 1 ? alias : alias.toLowerCase(), canonical);
  }
}

export function normalizeUnit(word: string): string | null {
  const cleaned = word.replace(/\.$/, "");
  if (cleaned.length === 1) return UNIT_LOOKUP.get(cleaned) ?? null;
  return UNIT_LOOKUP.get(cleaned.toLowerCase()) ?? null;
}

function replaceUnicodeFractions(text: string): string {
  return text.replace(/(\d)?\s*([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (_m, whole, frac) => {
    const value = (whole ? Number(whole) : 0) + UNICODE_FRACTIONS[frac];
    return ` ${Number(value.toFixed(4))}`;
  });
}

/** Parse "1", "1.5", "1/2", "1 1/2" into a number. */
export function parseNumber(token: string): number | null {
  const t = token.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  const dec = t.match(/^\d*\.?\d+$/);
  if (dec) return Number(t);
  return null;
}

const NUMBER_PATTERN = String.raw`\d+\s+\d+/\d+|\d+/\d+|\d*\.?\d+`;
const QUANTITY_RE = new RegExp(
  String.raw`^\s*(${NUMBER_PATTERN})(?:\s*(?:-|–|to)\s*(${NUMBER_PATTERN}))?\s*`,
);

/**
 * Parse a free-text ingredient line into structured parts.
 * Unparseable lines are kept intact as the name, so nothing is lost.
 */
export function parseIngredientLine(line: string, group: string | null = null): Ingredient {
  const raw = line.trim().replace(/\s+/g, " ");
  let rest = replaceUnicodeFractions(raw).trim();

  let quantity: number | null = null;
  let quantityMax: number | null = null;
  const q = rest.match(QUANTITY_RE);
  if (q) {
    quantity = parseNumber(q[1]);
    quantityMax = q[2] ? parseNumber(q[2]) : null;
    rest = rest.slice(q[0].length);
  }

  // Parenthetical size right after the quantity, e.g. "1 (14 oz) can tomatoes".
  let sizeNote: string | null = null;
  const paren = rest.match(/^\(([^)]*)\)\s*/);
  if (paren && quantity !== null) {
    sizeNote = paren[1];
    rest = rest.slice(paren[0].length);
  }

  let unit: string | null = null;
  // Try two-word units first ("fl oz", "fluid ounces").
  const twoWords = rest.match(/^(\S+\s+\S+?)(?=[\s,]|$)/);
  if (twoWords && normalizeUnit(twoWords[1])) {
    unit = normalizeUnit(twoWords[1]);
    rest = rest.slice(twoWords[0].length);
  } else {
    const oneWord = rest.match(/^([A-Za-z.]+)(?=[\s,]|$)/);
    if (oneWord) {
      const candidate = normalizeUnit(oneWord[1]);
      // Single-letter units only count when a quantity came first ("2 t salt").
      if (candidate && (oneWord[1].replace(".", "").length > 1 || quantity !== null)) {
        unit = candidate;
        rest = rest.slice(oneWord[0].length);
      }
    }
  }
  rest = rest.replace(/^\s*of\s+/i, "").trim();

  let name = rest;
  let note: string | null = null;
  const comma = rest.indexOf(",");
  if (comma > 0) {
    name = rest.slice(0, comma).trim();
    note = rest.slice(comma + 1).trim() || null;
  }
  const trailingParen = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (trailingParen && trailingParen[1]) {
    name = trailingParen[1].trim();
    note = [trailingParen[2], note].filter(Boolean).join(", ");
  }
  if (sizeNote) note = [sizeNote, note].filter(Boolean).join(", ");

  return {
    id: newId(),
    raw,
    quantity,
    quantityMax,
    unit,
    name: name || raw,
    note: note || null,
    group,
  };
}

/**
 * Parse a block of text (one ingredient per line). Lines ending in ":" or
 * written like "For the sauce" become group headings.
 */
export function parseIngredientBlock(text: string): Ingredient[] {
  const result: Ingredient[] = [];
  let group: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/^[-*•\s]+/, "").trim();
    if (!trimmed) continue;
    if (/:$/.test(trimmed) || /^for the\b/i.test(trimmed)) {
      group = trimmed.replace(/:$/, "");
      continue;
    }
    result.push(parseIngredientLine(trimmed, group));
  }
  return result;
}

const STOP_WORDS = new Set([
  "fresh", "large", "small", "medium", "chopped", "diced", "minced", "sliced",
  "ground", "whole", "boneless", "skinless", "unsalted", "salted", "extra",
  "virgin", "finely", "roughly", "and", "or", "to", "taste", "of", "the", "a",
  "dried", "frozen", "packed", "light", "dark", "optional", "plus", "more",
  "for", "serving", "room", "temperature", "cold", "warm", "hot", "cut", "into",
]);

/** Words that identify an ingredient when searching step text. */
export function ingredientKeywords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function wordMatches(text: string, word: string): boolean {
  const stem = word.replace(/(es|s)$/, "");
  const re = new RegExp(String.raw`\b${stem.replace(/[-]/g, "\\-")}(es|s)?\b`, "i");
  return re.test(text);
}

/**
 * Work out which ingredients each step mentions. The last keyword of a name is
 * usually the noun ("all-purpose flour" -> "flour"), so it is enough on its own.
 */
export function linkIngredientsToStep(stepText: string, ingredients: Ingredient[]): string[] {
  const ids: string[] = [];
  for (const ing of ingredients) {
    const words = ingredientKeywords(ing.name);
    if (words.length === 0) continue;
    const head = words[words.length - 1];
    if (wordMatches(stepText, head) || words.some((w) => w.length > 4 && wordMatches(stepText, w))) {
      ids.push(ing.id);
    }
  }
  return ids;
}
