import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookMode } from "./CookMode";
import { makeRecipe } from "@/test/fixtures";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function currentStep() {
  return document.querySelector('[aria-current="step"]') as HTMLElement;
}

function highlightedIngredients() {
  const aside = screen.getByRole("complementary", { name: "Ingredients" });
  return Array.from(aside.querySelectorAll('[data-highlighted="true"]')).map((el) => el.textContent?.trim());
}

describe("CookMode", () => {
  it("starts on step 1 and highlights the ingredients it uses", () => {
    render(<CookMode recipe={makeRecipe()} exitHref="/recipes/recipe-1" />);
    expect(currentStep()).toHaveTextContent("Whisk the flour");
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(highlightedIngredients()).toEqual(["2 cups flour"]);
  });

  it("walks forward and back with the buttons, updating highlights", async () => {
    const user = userEvent.setup();
    render(<CookMode recipe={makeRecipe()} exitHref="/" />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(currentStep()).toHaveTextContent("Beat the eggs and milk");
    expect(highlightedIngredients()).toEqual(["2 eggs", "1½ cups milk"]);
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(currentStep()).toHaveTextContent("Whisk the flour");
  });

  it("supports keyboard navigation", () => {
    render(<CookMode recipe={makeRecipe()} exitHref="/" />);
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    // Space on a focused button is the button's own click, not an extra step.
    fireEvent.keyDown(screen.getByRole("button", { name: /next/i }), { key: " " });
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
  });

  it("jumps to a step when tapped", async () => {
    const user = userEvent.setup();
    render(<CookMode recipe={makeRecipe()} exitHref="/" />);
    await user.click(screen.getByText("Cook in butter until golden."));
    expect(screen.getByText("Step 4 of 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /finish/i })).toBeInTheDocument();
  });

  it("swipes left to go to the next step", () => {
    render(<CookMode recipe={makeRecipe()} exitHref="/" />);
    const steps = screen.getByRole("region", { name: "Steps" });
    fireEvent.touchStart(steps, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(steps, { changedTouches: [{ clientX: 100, clientY: 110 }] });
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
  });

  it("offers and runs a timer for steps that mention a time", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<CookMode recipe={makeRecipe()} exitHref="/" />);
    act(() => {
      fireEvent.keyDown(document.body, { key: "ArrowRight" });
      fireEvent.keyDown(document.body, { key: "ArrowRight" });
    });
    fireEvent.click(screen.getByRole("button", { name: /start 5:00/i }));
    const timer = screen.getByRole("timer");
    expect(within(timer).getByText(/^[45]:\d\d$/)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 500);
    });
    expect(within(screen.getByRole("timer")).getByText("Done!")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("scales ingredients for the chosen servings", () => {
    render(<CookMode recipe={makeRecipe()} servings={8} exitHref="/" />);
    const aside = screen.getByRole("complementary", { name: "Ingredients" });
    expect(within(aside).getByText("4 cups flour")).toBeInTheDocument();
  });

  it("converts units when asked", () => {
    render(<CookMode recipe={makeRecipe()} unitSystem="metric" exitHref="/" />);
    const aside = screen.getByRole("complementary", { name: "Ingredients" });
    expect(within(aside).getByText("473 ml flour")).toBeInTheDocument();
  });

  it("lets the cook tick off ingredients", async () => {
    const user = userEvent.setup();
    render(<CookMode recipe={makeRecipe()} exitHref="/" />);
    const box = screen.getByRole("checkbox", { name: /mark eggs as done/i });
    await user.click(box);
    expect(box).toBeChecked();
  });

  it("shows a celebration after the last step", async () => {
    const user = userEvent.setup();
    render(<CookMode recipe={makeRecipe()} exitHref="/" />);
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /finish/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Enjoy your meal!");
    await user.click(screen.getByRole("button", { name: /start over/i }));
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("handles a recipe without steps", () => {
    render(<CookMode recipe={makeRecipe({ steps: [] })} exitHref="/" />);
    expect(screen.getByText(/no steps yet/i)).toBeInTheDocument();
  });
});
