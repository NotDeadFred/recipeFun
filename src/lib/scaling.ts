import type { Ingredient, UnitSystem } from "./types";

const NICE_FRACTIONS: Array<[number, string]> = [
  [0, ""],
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
  [1, ""],
];

/** Format a quantity the way a cook reads it: 1.5 -> "1½", 0.333 -> "⅓". */
export function formatQuantity(value: number | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  // Metric weights/volumes read better as decimals.
  if (unit && ["g", "kg", "ml", "l"].includes(unit)) {
    if (unit === "g" || unit === "ml") return String(Math.round(value));
    return String(Number(value.toFixed(2)));
  }
  if (value >= 10) return String(Math.round(value));
  const whole = Math.floor(value);
  const frac = value - whole;
  let best = NICE_FRACTIONS[0];
  for (const candidate of NICE_FRACTIONS) {
    if (Math.abs(candidate[0] - frac) < Math.abs(best[0] - frac)) best = candidate;
  }
  if (Math.abs(best[0] - frac) > 0.07) {
    return String(Number(value.toFixed(2)));
  }
  const w = best[0] === 1 ? whole + 1 : whole;
  if (!best[1]) return String(w);
  return w > 0 ? `${w}${best[1]}` : best[1];
}

export function scaleIngredient(ing: Ingredient, factor: number): Ingredient {
  if (factor === 1) return ing;
  return {
    ...ing,
    quantity: ing.quantity === null ? null : ing.quantity * factor,
    quantityMax:
      ing.quantityMax === null || ing.quantityMax === undefined ? ing.quantityMax : ing.quantityMax * factor,
  };
}

// Conversion factors to a base unit: millilitres for volume, grams for weight.
const VOLUME_ML: Record<string, number> = {
  tsp: 4.92892,
  tbsp: 14.7868,
  "fl oz": 29.5735,
  cup: 236.588,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,
  ml: 1,
  l: 1000,
};
const WEIGHT_G: Record<string, number> = {
  oz: 28.3495,
  lb: 453.592,
  g: 1,
  kg: 1000,
};

/** How many ml (volume) or g (weight) one of this unit is; null for count units. */
export function unitBase(unit: string | null): { base: "ml" | "g"; factor: number } | null {
  if (!unit) return null;
  if (unit in VOLUME_ML) return { base: "ml", factor: VOLUME_ML[unit] };
  if (unit in WEIGHT_G) return { base: "g", factor: WEIGHT_G[unit] };
  return null;
}

const US_VOLUME = ["tsp", "tbsp", "cup", "quart", "gallon"];
const US_WEIGHT = ["oz", "lb"];

function pickUsVolume(ml: number): { quantity: number; unit: string } {
  if (ml < 14) return { quantity: ml / VOLUME_ML.tsp, unit: "tsp" };
  if (ml < 59) return { quantity: ml / VOLUME_ML.tbsp, unit: "tbsp" };
  if (ml < 946) return { quantity: ml / VOLUME_ML.cup, unit: "cup" };
  if (ml < 3785) return { quantity: ml / VOLUME_ML.quart, unit: "quart" };
  return { quantity: ml / VOLUME_ML.gallon, unit: "gallon" };
}

/**
 * Convert a quantity between US and metric. Units with no counterpart
 * (cloves, cans, pinches) are returned unchanged.
 */
export function convertQuantity(
  quantity: number | null,
  unit: string | null,
  target: UnitSystem,
): { quantity: number | null; unit: string | null } {
  if (quantity === null || !unit) return { quantity, unit };
  if (unit in VOLUME_ML) {
    const ml = quantity * VOLUME_ML[unit];
    if (target === "metric") {
      return ml >= 1000 ? { quantity: ml / 1000, unit: "l" } : { quantity: ml, unit: "ml" };
    }
    if (US_VOLUME.includes(unit) || unit === "fl oz" || unit === "pint") return { quantity, unit };
    return pickUsVolume(ml);
  }
  if (unit in WEIGHT_G) {
    const g = quantity * WEIGHT_G[unit];
    if (target === "metric") {
      return g >= 1000 ? { quantity: g / 1000, unit: "kg" } : { quantity: g, unit: "g" };
    }
    if (US_WEIGHT.includes(unit)) return { quantity, unit };
    return g >= 453.592 ? { quantity: g / WEIGHT_G.lb, unit: "lb" } : { quantity: g / WEIGHT_G.oz, unit: "oz" };
  }
  return { quantity, unit };
}

export function convertIngredient(ing: Ingredient, target: UnitSystem): Ingredient {
  const main = convertQuantity(ing.quantity, ing.unit, target);
  const max =
    ing.quantityMax !== null && ing.quantityMax !== undefined
      ? convertQuantity(ing.quantityMax, ing.unit, target).quantity
      : ing.quantityMax;
  return { ...ing, quantity: main.quantity, unit: main.unit, quantityMax: max };
}

/** Scale then (optionally) convert — the order cook mode and the detail page use. */
export function adjustIngredients(
  ingredients: Ingredient[],
  factor: number,
  unitSystem: UnitSystem | null,
): Ingredient[] {
  return ingredients.map((ing) => {
    const scaled = scaleIngredient(ing, factor);
    return unitSystem ? convertIngredient(scaled, unitSystem) : scaled;
  });
}

const UNIT_LABELS: Record<string, [string, string]> = {
  cup: ["cup", "cups"],
  quart: ["quart", "quarts"],
  gallon: ["gallon", "gallons"],
  pint: ["pint", "pints"],
  clove: ["clove", "cloves"],
  can: ["can", "cans"],
  package: ["package", "packages"],
  stick: ["stick", "sticks"],
  slice: ["slice", "slices"],
  bunch: ["bunch", "bunches"],
  sprig: ["sprig", "sprigs"],
  piece: ["piece", "pieces"],
  head: ["head", "heads"],
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
};

export function formatUnit(unit: string | null, quantity: number | null): string {
  if (!unit) return "";
  const labels = UNIT_LABELS[unit];
  if (!labels) return unit;
  return quantity !== null && quantity > 1 ? labels[1] : labels[0];
}

/** "1½ cups flour (sifted)" */
export function formatIngredient(ing: Ingredient): string {
  // Unparsed lines (no quantity, no unit) show as originally written.
  if (ing.quantity === null && !ing.unit) return ing.raw || ing.name;
  const qty = formatQuantity(ing.quantity, ing.unit);
  const qtyMax =
    ing.quantityMax !== null && ing.quantityMax !== undefined
      ? `–${formatQuantity(ing.quantityMax, ing.unit)}`
      : "";
  const unit = formatUnit(ing.unit, ing.quantityMax ?? ing.quantity);
  const note = ing.note ? ` (${ing.note})` : "";
  return [`${qty}${qtyMax}`, unit, ing.name].filter(Boolean).join(" ") + note;
}
