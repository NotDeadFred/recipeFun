import { z } from "zod";
import { extractRecipeFromHtml, htmlToText } from "../schemaOrg";
import { FetchPageError, fetchPublicPage } from "./safeFetch";
import {
  ClaudeRecipeError,
  ClaudeUnavailableError,
  GenerateRequestSchema,
  generateRecipe,
  isClaudeConfigured,
  structureRecipeText,
} from "./claude";
import { UnauthorizedError, requireUser } from "./auth";

/** Dependencies are injectable so the handlers can be tested without network or API calls. */
export interface HandlerDeps {
  fetchPage: typeof fetchPublicPage;
  generate: typeof generateRecipe;
  structure: typeof structureRecipeText;
  claudeConfigured: () => boolean;
  authorize: typeof requireUser;
}

export const defaultDeps: HandlerDeps = {
  fetchPage: fetchPublicPage,
  generate: generateRecipe,
  structure: structureRecipeText,
  claudeConfigured: isClaudeConfigured,
  authorize: requireUser,
};

function errorResponse(err: unknown): Response {
  if (err instanceof UnauthorizedError) return Response.json({ error: err.message }, { status: 401 });
  if (err instanceof FetchPageError) return Response.json({ error: err.message }, { status: err.status });
  if (err instanceof ClaudeUnavailableError) return Response.json({ error: err.message }, { status: 503 });
  if (err instanceof ClaudeRecipeError) return Response.json({ error: err.message }, { status: 422 });
  if (err instanceof z.ZodError) {
    return Response.json({ error: "Invalid request.", issues: err.issues }, { status: 400 });
  }
  console.error(err);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new z.ZodError([{ code: "custom", message: "Body must be JSON", path: [], input: undefined }]);
  }
}

const ImportBody = z.object({ url: z.string().min(1).max(2000) });
const StructureBody = z.object({ text: z.string().min(20).max(60000), sourceUrl: z.string().url().nullable().optional() });

export async function handleImport(request: Request, deps: HandlerDeps = defaultDeps): Promise<Response> {
  try {
    await deps.authorize(request);
    const { url } = ImportBody.parse(await readJson(request));
    const { html, finalUrl } = await deps.fetchPage(url);
    const recipe = extractRecipeFromHtml(html, finalUrl);
    if (recipe) return Response.json({ recipe, method: "structured-data" });

    if (deps.claudeConfigured()) {
      const text = htmlToText(html);
      const structured = await deps.structure(text, finalUrl);
      return Response.json({ recipe: structured, method: "claude" });
    }
    return Response.json(
      { error: "No recipe data found on that page. Try pasting the recipe text instead." },
      { status: 422 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

export async function handleStructure(request: Request, deps: HandlerDeps = defaultDeps): Promise<Response> {
  try {
    await deps.authorize(request);
    const { text, sourceUrl } = StructureBody.parse(await readJson(request));
    const recipe = await deps.structure(text, sourceUrl ?? null);
    return Response.json({ recipe });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function handleGenerate(request: Request, deps: HandlerDeps = defaultDeps): Promise<Response> {
  try {
    await deps.authorize(request);
    const req = GenerateRequestSchema.parse(await readJson(request));
    const recipe = await deps.generate(req);
    return Response.json({ recipe });
  } catch (err) {
    return errorResponse(err);
  }
}
