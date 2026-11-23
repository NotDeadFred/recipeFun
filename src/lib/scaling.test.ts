import { describe, expect, it } from "vitest";
import {
  adjustIngredients,
  convertQuantity,
  formatIngredient,
  formatQuantity,
  scaleIngredient,
} from "./scaling";
import { parseIngredientLine } from "./ingredients";

describe("formatQuantity", () => {
  it.each([
    [1, "1"],
    [1.5, "1½"],
    [0.333, "⅓"],
    [0.25, "¼"],
    [2.75, "2¾"],
    [0.97, "1"],
    [12.4, "12"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatQuantity(value)).toBe(expected);
  });

  it("uses decimals for metric", () => {
    expect(formatQuantity(236.588, "ml")).toBe("237");
    expect(formatQuantity(1.2345, "kg")).toBe("1.23");
  });

  it("returns empty for null", () => {
    expect(formatQuantity(null)).toBe("");
  });
});

describe("scaleIngredient", () => {
  it("scales quantity and range", () => {
    const scaled = scaleIngredient(parseIngredientLine("2-3 cloves garlic"), 2);
    expect(scaled.quantity).toBe(4);
    expect(scaled.quantityMax).toBe(6);
  });

  it("leaves unquantified ingredients alone", () => {
    expect(scaleIngredient(parseIngredientLine("salt to taste"), 3).quantity).toBeNull();
  });
});

describe("convertQuantity", () => {
  it("converts cups to ml", () => {
    const r = convertQuantity(1, "cup", "metric");
    expect(r.unit).toBe("ml");
    expect(r.quantity).toBeCloseTo(236.588);
  });

  it("converts large volumes to litres", () => {
    expect(convertQuantity(5, "cup", "metric").unit).toBe("l");
  });

  it("converts pounds to grams and kilograms", () => {
    expect(convertQuantity(1, "lb", "metric")).toEqual({ quantity: 453.592, unit: "g" });
    expect(convertQuantity(3, "lb", "metric").unit).toBe("kg");
  });

  it("converts ml back to sensible US units", () => {
    expect(convertQuantity(5, "ml", "us").unit).toBe("tsp");
    expect(convertQuantity(30, "ml", "us").unit).toBe("tbsp");
    expect(convertQuantity(500, "ml", "us").unit).toBe("cup");
  });

  it("converts grams to ounces", () => {
    const r = convertQuantity(100, "g", "us");
    expect(r.unit).toBe("oz");
    expect(r.quantity).toBeCloseTo(3.527, 2);
  });

  it("leaves count units unchanged", () => {
    expect(convertQuantity(2, "clove", "metric")).toEqual({ quantity: 2, unit: "clove" });
  });

  it("leaves US units unchanged when target is US", () => {
    expect(convertQuantity(2, "tbsp", "us")).toEqual({ quantity: 2, unit: "tbsp" });
  });
});

describe("formatIngredient", () => {
  it("formats a scaled ingredient with plural unit and note", () => {
    const [ing] = adjustIngredients([parseIngredientLine("1 cup flour, sifted")], 1.5, null);
    expect(formatIngredient(ing)).toBe("1½ cups flour (sifted)");
  });

  it("formats ranges", () => {
    expect(formatIngredient(parseIngredientLine("2-3 cloves garlic"))).toBe("2–3 cloves garlic");
  });

  it("shows unparsed lines as written", () => {
    expect(formatIngredient(parseIngredientLine("Salt and pepper to taste"))).toBe("Salt and pepper to taste");
  });

  it("formats converted metric amounts", () => {
    const [ing] = adjustIngredients([parseIngredientLine("2 cups milk")], 1, "metric");
    expect(formatIngredient(ing)).toBe("473 ml milk");
  });
});
