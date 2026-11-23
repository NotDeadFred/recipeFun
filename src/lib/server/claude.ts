import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { RecipeDraft } from "../types";
import { buildRecipeDraft } from "../recipeBuilder";

export const CLAUDE_MODEL = "claude-opus-5-5";

export class ClaudeUnavailableError extends Error {
  constructor() {
    super("Cooking with Claude isn't set up yet. Add ANTHROPIC_API_KEY to the server environment.");
    this.name = "ClaudeUnavailableError";
  }
}

export class ClaudeRecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeRecipeError";
  }
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** The shape Claude returns. Kept flat and simple so it works with structured outputs. */
export const GeneratedRecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  cuisine: z.string().nullable(),
  servings: z.number(),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  tags: z.array(z.string()),
  ingredients: z.array(
    z.object({
      line: z.string().describe('One ingredient as a cook writes it, quantity first, e.g. "1 1/2 cups whole milk, warmed"'),
      group: z.string().nullable().describe('Section heading such as "For the sauce", or null'),
    }),
  ),
  steps: z.array(
    z.object({
      text: z.string().describe("One action per step. Include times and temperatures in the text."),
      group: z.string().nullable(),
    }),
  ),
  notes: z.string().nullable(),
});
export type GeneratedRecipe = z.infer<typeof GeneratedRecipeSchema>;

export const GenerateRequestSchema = z.object({
  ingredients: z.array(z.string().max(100)).max(40).default([]),
  useOnlyListed: z.boolean().default(false),
  flavors: z.array(z.string().max(60)).max(20).default([]),
  cuisine: z.string().max(80).optional().nullable(),
  mealType: z.string().max(60).optional().nullable(),
  dietary: z.array(z.string().max(60)).max(20).default([]),
  maxMinutes: z.number().int().positive().max(24 * 60).optional().nullable(),
  servings: z.number().int().positive().max(50).optional().nullable(),
  skill: z.enum(["easy", "intermediate", "advanced"]).optional().nullable(),
  equipment: z.array(z.string().max(60)).max(20).default([]),
  notes: z.string().max(1000).optional().nullable(),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

const SYSTEM_PROMPT = `You are a creative, practical home-cooking chef inside a recipe app called RecipeFun.
You write recipes that a home cook can follow step by step on an iPad while cooking.

Write each step as one clear action (or a tightly related pair), in the order the cook does them.
Put prep (chopping, measuring) where it is needed, or in an early "mise en place" step.
Mention ingredients by the same name used in the ingredient list, so the app can highlight them.
Spell out times ("simmer for 10 minutes") and temperatures (both °F and °C) inside the step text, so the app can offer timers.
Give quantities in US units unless the request asks for metric.
Respect dietary restrictions strictly. If the request is contradictory or unsafe to eat, adapt it into the closest safe recipe and explain the change in notes.`;

export function buildGeneratePrompt(req: GenerateRequest): string {
  const lines: string[] = ["Create one original recipe for me."];
  if (req.ingredients.length) {
    lines.push(
      req.useOnlyListed
        ? `Use only these ingredients (plus water, salt, pepper and cooking oil): ${req.ingredients.join(", ")}.`
        : `Build it around these ingredients I have: ${req.ingredients.join(", ")}. You may add common pantry items.`,
    );
  }
  if (req.flavors.length) lines.push(`Flavor profile: ${req.flavors.join(", ")}.`);
  if (req.cuisine) lines.push(`Cuisine: ${req.cuisine}.`);
  if (req.mealType) lines.push(`Meal type: ${req.mealType}.`);
  if (req.dietary.length) lines.push(`Dietary requirements (must follow): ${req.dietary.join(", ")}.`);
  if (req.maxMinutes) lines.push(`Total time must be ${req.maxMinutes} minutes or less.`);
  if (req.servings) lines.push(`Servings: ${req.servings}.`);
  if (req.skill) lines.push(`Skill level: ${req.skill}.`);
  if (req.equipment.length) lines.push(`Equipment available: ${req.equipment.join(", ")}.`);
  if (req.notes) lines.push(`Other notes from me: ${req.notes}`);
  if (lines.length === 1) lines.push("Surprise me with something seasonal and approachable.");
  return lines.join("\n");
}

type MessagesClient = Pick<Anthropic["beta"]["messages"], "parse">;

function defaultClient(): MessagesClient {
  if (!isClaudeConfigured()) throw new ClaudeUnavailableError();
  return new Anthropic().beta.messages;
}

async function askForRecipe(
  userContent: string,
  system: string,
  client: MessagesClient,
): Promise<GeneratedRecipe> {
  const response = await client.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: userContent }],
    output_config: { effort: "medium", format: betaZodOutputFormat(GeneratedRecipeSchema) },
    // If a safety classifier declines, let the API retry on a suitable fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  if (response.stop_reason === "refusal") {
    throw new ClaudeRecipeError("Claude declined that request. Try rewording it.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new ClaudeRecipeError("The recipe came back incomplete. Please try again.");
  }
  if (!response.parsed_output) {
    throw new ClaudeRecipeError("Claude's reply couldn't be read as a recipe. Please try again.");
  }
  return response.parsed_output;
}

function toDraft(g: GeneratedRecipe, extra: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    ...buildRecipeDraft({
      title: g.title,
      description: g.description,
      cuisine: g.cuisine,
      servings: g.servings,
      prepMinutes: g.prepMinutes,
      cookMinutes: g.cookMinutes,
      tags: g.tags,
      ingredients: g.ingredients,
      steps: g.steps,
      notes: g.notes,
      sourceType: "claude",
      sourceName: "Cooking with Claude",
    }),
    ...extra,
  };
}

/** Create a brand-new recipe from the cook's preferences. */
export async function generateRecipe(req: GenerateRequest, client: MessagesClient = defaultClient()): Promise<RecipeDraft> {
  const recipe = await askForRecipe(buildGeneratePrompt(req), SYSTEM_PROMPT, client);
  return toDraft(recipe);
}

const STRUCTURE_PROMPT = `You convert recipe text into structured data for a recipe app.
Copy the recipe faithfully: keep the author's ingredients, quantities, and steps. Do not invent or improve anything.
Split run-on instructions into one action per step. Ignore ads, life stories, comments and navigation text.
If the text contains no recipe, return a recipe titled "No recipe found" with empty ingredients and steps.`;

/** Turn pasted or scraped text into a recipe (used when a site has no structured data). */
export async function structureRecipeText(
  text: string,
  sourceUrl: string | null,
  client: MessagesClient = defaultClient(),
): Promise<RecipeDraft> {
  const recipe = await askForRecipe(
    `<recipe_text${sourceUrl ? ` source="${sourceUrl}"` : ""}>\n${text.slice(0, 40000)}\n</recipe_text>`,
    STRUCTURE_PROMPT,
    client,
  );
  if (recipe.ingredients.length === 0 && recipe.steps.length === 0) {
    throw new ClaudeRecipeError("No recipe was found in that text.");
  }
  let sourceName: string | null = null;
  if (sourceUrl) {
    try {
      sourceName = new URL(sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
  }
  return toDraft(recipe, {
    sourceType: sourceUrl ? "imported" : "manual",
    sourceUrl,
    sourceName,
  });
}
