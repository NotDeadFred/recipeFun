import type { RecipeDraft } from "../types";
import { buildRecipeDraft } from "../recipeBuilder";

/** Starter recipes so a new library isn't empty. */
export const SAMPLE_RECIPES: RecipeDraft[] = [
  buildRecipeDraft({
    title: "Weeknight Garlic Butter Pasta",
    description: "A pantry pasta that comes together in the time it takes to boil water.",
    sourceType: "manual",
    servings: 4,
    prepMinutes: 5,
    cookMinutes: 15,
    cuisine: "Italian",
    tags: ["pasta", "quick", "vegetarian"],
    ingredients: [
      "1 lb spaghetti",
      "6 tbsp unsalted butter",
      "6 cloves garlic, thinly sliced",
      "1/2 tsp red pepper flakes",
      "1 cup grated parmesan",
      "1/4 cup chopped parsley",
      "Salt and black pepper to taste",
    ],
    steps: [
      "Bring a large pot of well-salted water to a boil and cook the spaghetti for 9 minutes, until just shy of al dente.",
      "While the pasta cooks, melt the butter in a large skillet over medium-low heat.",
      "Add the garlic and red pepper flakes and cook gently for 3 minutes, until the garlic is pale golden.",
      "Reserve 1 cup of pasta water, then drain the spaghetti and add it to the skillet.",
      "Toss with the parmesan and a splash of pasta water until glossy. Season with salt and pepper.",
      "Top with parsley and serve right away.",
    ],
  }),
  buildRecipeDraft({
    title: "Sheet-Pan Lemon Herb Chicken",
    description: "Crispy chicken thighs and potatoes roasted together on one pan.",
    sourceType: "manual",
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 40,
    cuisine: "Mediterranean",
    tags: ["chicken", "sheet pan", "gluten-free"],
    ingredients: [
      "6 bone-in chicken thighs",
      "1 1/2 lb baby potatoes, halved",
      "3 tbsp olive oil",
      "1 lemon, zested and juiced",
      "4 cloves garlic, minced",
      "1 tbsp dried oregano",
      "1 tsp kosher salt",
      "1/2 tsp black pepper",
    ],
    steps: [
      "Heat the oven to 425°F (220°C).",
      "Toss the potatoes with 1 tbsp olive oil and half the salt on a sheet pan.",
      "Mix the remaining olive oil with the lemon zest, lemon juice, garlic, oregano, salt and pepper.",
      "Rub the chicken thighs all over with the lemon mixture and nestle them skin-side up among the potatoes.",
      "Roast for 40 minutes, until the chicken skin is crisp and the potatoes are tender.",
      "Rest for 5 minutes, then serve with the pan juices spooned over.",
    ],
  }),
];
