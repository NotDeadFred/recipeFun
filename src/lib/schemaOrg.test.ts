import { describe, expect, it } from "vitest";
import {
  cleanText,
  extractRecipeFromHtml,
  findRecipeNode,
  flattenInstructions,
  htmlToText,
  parseIsoDuration,
} from "./schemaOrg";

const pageWith = (jsonLd: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body></body></html>`;

describe("parseIsoDuration", () => {
  it.each([
    ["PT30M", 30],
    ["PT1H30M", 90],
    ["PT2H", 120],
    ["P1DT2H", 1560],
    ["PT90S", 2],
  ])("parses %s", (input, expected) => {
    expect(parseIsoDuration(input)).toBe(expected);
  });

  it("returns null for junk", () => {
    expect(parseIsoDuration("30 minutes")).toBeNull();
    expect(parseIsoDuration("PT")).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
  });
});

describe("findRecipeNode", () => {
  it("finds a recipe inside @graph", () => {
    const node = findRecipeNode({ "@graph": [{ "@type": "WebPage" }, { "@type": "Recipe", name: "Soup" }] });
    expect(node?.name).toBe("Soup");
  });

  it("accepts an array @type", () => {
    expect(findRecipeNode([{ "@type": ["Recipe", "NewsArticle"], name: "Pie" }])?.name).toBe("Pie");
  });

  it("returns null when absent", () => {
    expect(findRecipeNode({ "@type": "Article" })).toBeNull();
  });
});

describe("flattenInstructions", () => {
  it("flattens HowToSection groups", () => {
    const steps = flattenInstructions([
      {
        "@type": "HowToSection",
        name: "Make the sauce",
        itemListElement: [
          { "@type": "HowToStep", text: "Melt butter." },
          { "@type": "HowToStep", text: "Whisk in flour." },
        ],
      },
      { "@type": "HowToStep", text: "Serve." },
    ]);
    expect(steps).toEqual([
      { text: "Melt butter.", group: "Make the sauce" },
      { text: "Whisk in flour.", group: "Make the sauce" },
      { text: "Serve.", group: null },
    ]);
  });

  it("splits an HTML string into steps and strips numbering", () => {
    const steps = flattenInstructions("<ol><li>1. Chop onion.</li><li>2. Fry it.</li></ol>");
    expect(steps.map((s) => s.text)).toEqual(["Chop onion.", "Fry it."]);
  });
});

describe("extractRecipeFromHtml", () => {
  it("extracts a full recipe", () => {
    const html = pageWith({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Classic Pancakes",
      description: "Fluffy &amp; light.",
      image: ["https://example.com/small.jpg", "https://example.com/large.jpg"],
      recipeYield: ["4", "4 servings"],
      prepTime: "PT10M",
      cookTime: "PT15M",
      recipeCuisine: "American",
      recipeCategory: "Breakfast",
      keywords: "pancakes, easy",
      publisher: { "@type": "Organization", name: "Example Kitchen" },
      recipeIngredient: ["1 1/2 cups flour", "2 eggs", "1 cup milk"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "Whisk the eggs and milk." },
        { "@type": "HowToStep", text: "Stir in the flour and rest for 5 minutes." },
      ],
    });
    const draft = extractRecipeFromHtml(html, "https://www.example.com/pancakes");
    expect(draft).not.toBeNull();
    expect(draft!.title).toBe("Classic Pancakes");
    expect(draft!.description).toBe("Fluffy & light.");
    expect(draft!.imageUrl).toBe("https://example.com/large.jpg");
    expect(draft!.servings).toBe(4);
    expect(draft!.totalMinutes).toBe(25);
    expect(draft!.cuisine).toBe("American");
    expect(draft!.tags).toEqual(["breakfast", "pancakes", "easy"]);
    expect(draft!.sourceName).toBe("Example Kitchen");
    expect(draft!.sourceType).toBe("imported");
    expect(draft!.ingredients).toHaveLength(3);
    expect(draft!.steps[1].timerSeconds).toBe(300);
    // Step 2 mentions flour, which is ingredient 1.
    expect(draft!.steps[1].ingredientIds).toContain(draft!.ingredients[0].id);
  });

  it("returns null when the page has no recipe", () => {
    expect(extractRecipeFromHtml(pageWith({ "@type": "Article" }), "https://x.com")).toBeNull();
    expect(extractRecipeFromHtml("<html></html>", "https://x.com")).toBeNull();
  });

  it("skips invalid JSON-LD blocks", () => {
    const html =
      '<script type="application/ld+json">{not json</script>' +
      pageWith({ "@type": "Recipe", name: "Toast", recipeIngredient: ["1 slice bread"], recipeInstructions: "Toast it." });
    expect(extractRecipeFromHtml(html, "https://x.com")?.title).toBe("Toast");
  });

  it("falls back to the hostname for source name", () => {
    const html = pageWith({ "@type": "Recipe", name: "Tea", recipeIngredient: ["1 tea bag"], recipeInstructions: "Steep." });
    expect(extractRecipeFromHtml(html, "https://www.tea.example/x")?.sourceName).toBe("tea.example");
  });
});

describe("text helpers", () => {
  it("cleans tags and entities", () => {
    expect(cleanText("<b>Mac</b> &amp; cheese&#39;s")).toBe("Mac & cheese's");
  });

  it("drops scripts and nav from page text", () => {
    const text = htmlToText("<nav>Menu</nav><script>x()</script><h1>Soup</h1><p>Boil water.</p>");
    expect(text).toBe("Soup\nBoil water.");
  });
});
