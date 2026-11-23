import { describe, expect, it } from "vitest";
import { cookReducer, initCookState, isFinished, progressPercent } from "./cookSession";
import { parseVoiceCommand } from "./voiceCommands";
import { addToShoppingList, clearChecked, toggleItem } from "./shoppingList";
import { parseIngredientLine } from "./ingredients";
import { buildRecipeDraft } from "./recipeBuilder";

describe("cookReducer", () => {
  it("moves forward, marks steps done and stops at the last step", () => {
    let s = initCookState(3);
    s = cookReducer(s, { type: "next" });
    expect(s.stepIndex).toBe(1);
    expect(s.completed).toEqual([true, false, false]);
    s = cookReducer(s, { type: "next" });
    s = cookReducer(s, { type: "next" });
    expect(s.stepIndex).toBe(2);
    expect(isFinished(s)).toBe(true);
    expect(progressPercent(s)).toBe(100);
  });

  it("does not go before the first step", () => {
    expect(cookReducer(initCookState(3), { type: "previous" }).stepIndex).toBe(0);
  });

  it("clamps goto", () => {
    expect(cookReducer(initCookState(3), { type: "goto", index: 10 }).stepIndex).toBe(2);
    expect(cookReducer(initCookState(3), { type: "goto", index: -1 }).stepIndex).toBe(0);
  });

  it("toggles ingredients", () => {
    let s = cookReducer(initCookState(2), { type: "toggle-ingredient", id: "a" });
    expect(s.checkedIngredients).toEqual(["a"]);
    s = cookReducer(s, { type: "toggle-ingredient", id: "a" });
    expect(s.checkedIngredients).toEqual([]);
  });

  it("resets", () => {
    const s = cookReducer(cookReducer(initCookState(2), { type: "next" }), { type: "reset" });
    expect(s).toEqual(initCookState(2));
  });

  it("handles a recipe with no steps", () => {
    const s = initCookState(0);
    expect(cookReducer(s, { type: "next" }).stepIndex).toBe(0);
    expect(isFinished(s)).toBe(false);
    expect(progressPercent(s)).toBe(0);
  });
});

describe("parseVoiceCommand", () => {
  it.each([
    ["next", "next"],
    ["okay, next step please", "next"],
    ["go back", "previous"],
    ["previous step", "previous"],
    ["repeat that", "repeat"],
    ["what was that", "repeat"],
    ["start the timer", "start-timer"],
    ["stop timer", "stop-timer"],
    ["what ingredients do I need", "ingredients"],
    ["stop listening", "stop-listening"],
  ])("%s -> %s", (phrase, type) => {
    expect(parseVoiceCommand(phrase)?.type).toBe(type);
  });

  it("parses go to step with digits and words", () => {
    expect(parseVoiceCommand("go to step 4")).toEqual({ type: "goto", step: 4 });
    expect(parseVoiceCommand("step three")).toEqual({ type: "goto", step: 3 });
  });

  it("ignores unrelated speech", () => {
    expect(parseVoiceCommand("this smells amazing")).toBeNull();
    expect(parseVoiceCommand("")).toBeNull();
  });
});

describe("shopping list", () => {
  it("merges same ingredient and unit across recipes", () => {
    let list = addToShoppingList([], [parseIngredientLine("1 cup milk")], "r1");
    list = addToShoppingList(list, [parseIngredientLine("2 cups milk")], "r2");
    expect(list).toHaveLength(1);
    expect(list[0].quantity).toBe(3);
    expect(list[0].recipeIds).toEqual(["r1", "r2"]);
  });

  it("merges compatible units into the existing unit", () => {
    let list = addToShoppingList([], [parseIngredientLine("1 cup milk")], "r1");
    list = addToShoppingList(list, [parseIngredientLine("8 tbsp milk")], "r2");
    expect(list).toHaveLength(1);
    expect(list[0].unit).toBe("cup");
    expect(list[0].quantity).toBeCloseTo(1.5, 2);
  });

  it("keeps incompatible units separate", () => {
    let list = addToShoppingList([], [parseIngredientLine("2 cloves garlic")], "r1");
    list = addToShoppingList(list, [parseIngredientLine("1 head garlic")], "r2");
    expect(list).toHaveLength(2);
  });

  it("applies a scaling factor", () => {
    expect(addToShoppingList([], [parseIngredientLine("2 eggs")], "r1", 2)[0].quantity).toBe(4);
  });

  it("does not merge into checked items and can clear them", () => {
    let list = addToShoppingList([], [parseIngredientLine("1 cup milk")], "r1");
    list = toggleItem(list, list[0].id);
    list = addToShoppingList(list, [parseIngredientLine("1 cup milk")], "r2");
    expect(list).toHaveLength(2);
    expect(clearChecked(list)).toHaveLength(1);
  });
});

describe("buildRecipeDraft", () => {
  it("builds steps with timers and ingredient links, and computes total time", () => {
    const draft = buildRecipeDraft({
      title: "  Garlic Pasta ",
      sourceType: "manual",
      prepMinutes: 10,
      cookMinutes: 15,
      tags: ["Quick", "quick", " Pasta "],
      ingredients: ["8 oz spaghetti", "4 cloves garlic", ""],
      steps: ["Boil the spaghetti for 10 minutes.", "  ", "Fry the garlic in oil."],
    });
    expect(draft.title).toBe("Garlic Pasta");
    expect(draft.totalMinutes).toBe(25);
    expect(draft.servings).toBe(4);
    expect(draft.tags).toEqual(["quick", "pasta"]);
    expect(draft.ingredients).toHaveLength(2);
    expect(draft.steps).toHaveLength(2);
    expect(draft.steps[0].timerSeconds).toBe(600);
    expect(draft.steps[0].ingredientIds).toEqual([draft.ingredients[0].id]);
    expect(draft.steps[1].ingredientIds).toEqual([draft.ingredients[1].id]);
  });
});
