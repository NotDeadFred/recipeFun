import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { RecipeView } from "./RecipeView";
import { RecipeForm } from "./RecipeForm";
import { ClaudeRequestForm } from "../claude/ClaudeRequestForm";
import { makeRecipe } from "@/test/fixtures";
import type { UnitSystem } from "@/lib/types";

function ViewHarness() {
  const recipe = makeRecipe();
  const [servings, setServings] = useState(recipe.servings);
  const [units, setUnits] = useState<UnitSystem | null>(null);
  return (
    <RecipeView recipe={recipe} servings={servings} onServingsChange={setServings} unitSystem={units} onUnitSystemChange={setUnits} />
  );
}

describe("RecipeView", () => {
  it("shows ingredients and steps side by side", () => {
    render(<ViewHarness />);
    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /steps/i })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(4);
  });

  it("highlights a step's ingredients when the step is tapped", async () => {
    const user = userEvent.setup();
    render(<ViewHarness />);
    await user.click(screen.getByRole("button", { name: /beat the eggs and milk/i }));
    const highlighted = Array.from(document.querySelectorAll('[data-highlighted="true"]')).map((e) => e.textContent);
    expect(highlighted).toEqual(["2 eggs", "1½ cups milk"]);
  });

  it("scales servings", async () => {
    const user = userEvent.setup();
    render(<ViewHarness />);
    await user.click(screen.getByRole("button", { name: "More servings" }));
    expect(screen.getByText("5 servings")).toBeInTheDocument();
    expect(screen.getByText("2½ cups flour")).toBeInTheDocument();
  });

  it("switches to metric", async () => {
    const user = userEvent.setup();
    render(<ViewHarness />);
    await user.click(screen.getByRole("button", { name: "Metric" }));
    expect(screen.getByText("30 ml butter")).toBeInTheDocument();
  });
});

describe("RecipeForm", () => {
  it("builds a recipe from typed text, with sections and timers", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RecipeForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Recipe name"), "Tomato Soup");
    await user.type(screen.getByLabelText(/ingredients — one per line/i), "2 tbsp olive oil{enter}# Soup{enter}1 can tomatoes");
    await user.type(screen.getByLabelText(/steps — one per line/i), "1. Heat the oil.{enter}2. Simmer the tomatoes for 20 minutes.");
    await user.click(screen.getByRole("button", { name: "Save recipe" }));

    const draft = onSubmit.mock.calls[0][0];
    expect(draft.title).toBe("Tomato Soup");
    expect(draft.sourceType).toBe("manual");
    expect(draft.ingredients.map((i: { name: string; group: string | null }) => [i.name, i.group])).toEqual([
      ["olive oil", null],
      ["tomatoes", "Soup"],
    ]);
    expect(draft.steps.map((s: { text: string }) => s.text)).toEqual(["Heat the oil.", "Simmer the tomatoes for 20 minutes."]);
    expect(draft.steps[1].timerSeconds).toBe(1200);
  });

  it("requires a name and at least one step", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RecipeForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Recipe name"), "Empty");
    await user.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/at least one step/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pre-fills when editing and keeps the id", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RecipeForm initial={makeRecipe()} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("Recipe name")).toHaveValue("Test Pancakes");
    expect(screen.getByLabelText(/ingredients — one per line/i)).toHaveValue("2 cups flour\n2 eggs\n1 1/2 cups milk\n2 tbsp butter");
    await user.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(onSubmit.mock.calls[0][0].id).toBe("recipe-1");
  });
});

describe("ClaudeRequestForm", () => {
  it("collects ingredients, flavors, cuisine and limits", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ClaudeRequestForm busy={false} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/ingredients you have/i), "chicken, lemons{enter}");
    await user.click(screen.getByRole("button", { name: "Smoky" }));
    await user.click(screen.getByRole("button", { name: "Mexican" }));
    await user.click(screen.getByRole("button", { name: "Gluten-free" }));
    await user.type(screen.getByLabelText(/max total time/i), "30");
    await user.click(screen.getByRole("button", { name: /create my recipe/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: ["chicken", "lemons"],
        flavors: ["Smoky"],
        cuisine: "Mexican",
        dietary: ["Gluten-free"],
        maxMinutes: 30,
        servings: 4,
      }),
    );
  });

  it("lets you remove an ingredient and pick only one cuisine", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ClaudeRequestForm busy={false} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/ingredients you have/i), "kale{enter}");
    await user.click(screen.getByRole("button", { name: "Remove kale" }));
    await user.click(screen.getByRole("button", { name: "Thai" }));
    await user.click(screen.getByRole("button", { name: "Indian" }));
    await user.click(screen.getByRole("button", { name: /create my recipe/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ingredients: [], cuisine: "Indian" }));
  });
});
