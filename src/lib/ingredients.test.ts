import { describe, expect, it } from "vitest";
import {
  ingredientKeywords,
  linkIngredientsToStep,
  parseIngredientBlock,
  parseIngredientLine,
  parseNumber,
} from "./ingredients";

describe("parseNumber", () => {
  it.each([
    ["2", 2],
    ["1.5", 1.5],
    ["1/2", 0.5],
    ["1 1/2", 1.5],
    [".25", 0.25],
  ])("parses %s", (input, expected) => {
    expect(parseNumber(input)).toBeCloseTo(expected);
  });

  it("rejects divide-by-zero and junk", () => {
    expect(parseNumber("1/0")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
});

describe("parseIngredientLine", () => {
  it("parses quantity, unit, name and note", () => {
    const ing = parseIngredientLine("1 1/2 cups all-purpose flour, sifted");
    expect(ing.quantity).toBeCloseTo(1.5);
    expect(ing.unit).toBe("cup");
    expect(ing.name).toBe("all-purpose flour");
    expect(ing.note).toBe("sifted");
  });

  it("handles unicode fractions", () => {
    const ing = parseIngredientLine("1½ tsp kosher salt");
    expect(ing.quantity).toBeCloseTo(1.5);
    expect(ing.unit).toBe("tsp");
    expect(ing.name).toBe("kosher salt");
  });

  it("handles a lone unicode fraction", () => {
    expect(parseIngredientLine("¾ cup milk").quantity).toBeCloseTo(0.75);
  });

  it("parses ranges", () => {
    const ing = parseIngredientLine("2-3 cloves garlic, minced");
    expect(ing.quantity).toBe(2);
    expect(ing.quantityMax).toBe(3);
    expect(ing.unit).toBe("clove");
    expect(ing.name).toBe("garlic");
  });

  it("keeps a can size as a note", () => {
    const ing = parseIngredientLine("1 (14 oz) can diced tomatoes");
    expect(ing.quantity).toBe(1);
    expect(ing.unit).toBe("can");
    expect(ing.name).toBe("diced tomatoes");
    expect(ing.note).toBe("14 oz");
  });

  it("distinguishes T (tablespoon) and t (teaspoon)", () => {
    expect(parseIngredientLine("2 T butter").unit).toBe("tbsp");
    expect(parseIngredientLine("2 t vanilla").unit).toBe("tsp");
  });

  it("handles two-word units", () => {
    const ing = parseIngredientLine("4 fl oz cream");
    expect(ing.unit).toBe("fl oz");
    expect(ing.name).toBe("cream");
  });

  it("strips 'of'", () => {
    expect(parseIngredientLine("1 pinch of nutmeg").name).toBe("nutmeg");
  });

  it("keeps lines without quantity intact", () => {
    const ing = parseIngredientLine("Salt and pepper to taste");
    expect(ing.quantity).toBeNull();
    expect(ing.unit).toBeNull();
    expect(ing.name).toBe("Salt and pepper to taste");
  });

  it("does not treat a word starting with a unit letter as a unit", () => {
    const ing = parseIngredientLine("3 tomatoes");
    expect(ing.unit).toBeNull();
    expect(ing.name).toBe("tomatoes");
  });

  it("moves a trailing parenthetical to the note", () => {
    const ing = parseIngredientLine("2 eggs (room temperature)");
    expect(ing.name).toBe("eggs");
    expect(ing.note).toBe("room temperature");
  });
});

describe("parseIngredientBlock", () => {
  it("parses lines and group headings, skipping bullets and blanks", () => {
    const result = parseIngredientBlock(`For the dough:
- 2 cups flour
• 1 tsp salt

Sauce:
1 cup tomato sauce`);
    expect(result).toHaveLength(3);
    expect(result[0].group).toBe("For the dough");
    expect(result[1].name).toBe("salt");
    expect(result[2].group).toBe("Sauce");
  });
});

describe("linkIngredientsToStep", () => {
  const ingredients = [
    parseIngredientLine("2 cups all-purpose flour"),
    parseIngredientLine("3 large eggs"),
    parseIngredientLine("1 cup whole milk"),
    parseIngredientLine("2 tbsp unsalted butter"),
  ];

  it("links ingredients mentioned in the step", () => {
    const ids = linkIngredientsToStep("Whisk the eggs and milk together.", ingredients);
    expect(ids).toEqual([ingredients[1].id, ingredients[2].id]);
  });

  it("matches singular and plural forms", () => {
    expect(linkIngredientsToStep("Crack one egg into the bowl.", ingredients)).toEqual([ingredients[1].id]);
  });

  it("returns nothing for unrelated steps", () => {
    expect(linkIngredientsToStep("Preheat the oven to 350°F.", ingredients)).toEqual([]);
  });

  it("ignores descriptive words when building keywords", () => {
    expect(ingredientKeywords("finely chopped fresh parsley")).toEqual(["parsley"]);
  });
});
