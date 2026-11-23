import { describe, expect, it, vi } from "vitest";
import { handleGenerate, handleImport, handleStructure, type HandlerDeps } from "./handlers";
import { FetchPageError, isPrivateAddress, fetchPublicPage } from "./safeFetch";
import { ClaudeRecipeError, ClaudeUnavailableError, buildGeneratePrompt, generateRecipe, GenerateRequestSchema } from "./claude";
import { UnauthorizedError } from "./auth";
import { buildRecipeDraft } from "../recipeBuilder";

const sampleDraft = buildRecipeDraft({
  title: "Test Soup",
  sourceType: "claude",
  ingredients: ["1 onion"],
  steps: ["Chop the onion."],
});

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    fetchPage: vi.fn(),
    generate: vi.fn().mockResolvedValue(sampleDraft),
    structure: vi.fn().mockResolvedValue({ ...sampleDraft, sourceType: "imported" }),
    claudeConfigured: () => false,
    authorize: vi.fn().mockResolvedValue({ userId: null }),
    ...overrides,
  };
}

const post = (body: unknown) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const recipePage = `<script type="application/ld+json">${JSON.stringify({
  "@type": "Recipe",
  name: "Page Pie",
  recipeIngredient: ["2 apples"],
  recipeInstructions: ["Slice the apples."],
})}</script>`;

describe("handleImport", () => {
  it("returns structured data when the page has it", async () => {
    const d = deps({ fetchPage: vi.fn().mockResolvedValue({ html: recipePage, finalUrl: "https://pie.example/p" }) });
    const res = await handleImport(post({ url: "https://pie.example/p" }), d);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method).toBe("structured-data");
    expect(body.recipe.title).toBe("Page Pie");
    expect(d.structure).not.toHaveBeenCalled();
  });

  it("falls back to Claude when there is no structured data", async () => {
    const d = deps({
      claudeConfigured: () => true,
      fetchPage: vi.fn().mockResolvedValue({ html: "<p>Grandma's soup: chop an onion</p>", finalUrl: "https://s.example" }),
    });
    const res = await handleImport(post({ url: "https://s.example" }), d);
    expect(res.status).toBe(200);
    expect((await res.json()).method).toBe("claude");
    expect(d.structure).toHaveBeenCalledWith(expect.stringContaining("Grandma"), "https://s.example");
  });

  it("returns 422 with a hint when there is no recipe and no Claude", async () => {
    const d = deps({ fetchPage: vi.fn().mockResolvedValue({ html: "<p>hi</p>", finalUrl: "https://x.example" }) });
    const res = await handleImport(post({ url: "https://x.example" }), d);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/pasting/i);
  });

  it("passes through fetch errors with their status", async () => {
    const d = deps({ fetchPage: vi.fn().mockRejectedValue(new FetchPageError("That address is not a public website.")) });
    const res = await handleImport(post({ url: "http://127.0.0.1" }), d);
    expect(res.status).toBe(400);
  });

  it("rejects bad bodies", async () => {
    expect((await handleImport(post("not json"), deps())).status).toBe(400);
    expect((await handleImport(post({}), deps())).status).toBe(400);
  });

  it("requires auth when the authorizer says so", async () => {
    const d = deps({ authorize: vi.fn().mockRejectedValue(new UnauthorizedError()) });
    expect((await handleImport(post({ url: "https://x.example" }), d)).status).toBe(401);
  });
});

describe("handleGenerate", () => {
  it("validates and forwards the request", async () => {
    const d = deps();
    const res = await handleGenerate(post({ ingredients: ["chicken"], flavors: ["smoky"], cuisine: "Mexican" }), d);
    expect(res.status).toBe(200);
    expect((await res.json()).recipe.title).toBe("Test Soup");
    expect(d.generate).toHaveBeenCalledWith(expect.objectContaining({ ingredients: ["chicken"], dietary: [] }));
  });

  it("returns 503 when Claude is not configured", async () => {
    const d = deps({ generate: vi.fn().mockRejectedValue(new ClaudeUnavailableError()) });
    expect((await handleGenerate(post({}), d)).status).toBe(503);
  });

  it("returns 422 for a refusal", async () => {
    const d = deps({ generate: vi.fn().mockRejectedValue(new ClaudeRecipeError("declined")) });
    expect((await handleGenerate(post({}), d)).status).toBe(422);
  });

  it("rejects invalid fields", async () => {
    expect((await handleGenerate(post({ skill: "wizard" }), deps())).status).toBe(400);
  });
});

describe("handleStructure", () => {
  it("rejects text that is too short", async () => {
    expect((await handleStructure(post({ text: "hi" }), deps())).status).toBe(400);
  });

  it("structures pasted text", async () => {
    const d = deps();
    const res = await handleStructure(post({ text: "Chop one onion and fry it in butter until golden." }), d);
    expect(res.status).toBe(200);
  });
});

describe("generateRecipe with a mocked Claude client", () => {
  const parsed = {
    title: "Smoky Chicken Tacos",
    description: "Quick tacos.",
    cuisine: "Mexican",
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 15,
    tags: ["Tacos"],
    ingredients: [
      { line: "1 lb chicken thighs", group: null },
      { line: "8 corn tortillas", group: null },
    ],
    steps: [
      { text: "Season the chicken.", group: null },
      { text: "Grill the chicken for 12 minutes.", group: null },
      { text: "Warm the tortillas.", group: null },
    ],
    notes: null,
  };

  it("sends the model, fallbacks and schema, and builds a draft", async () => {
    const parse = vi.fn().mockResolvedValue({ stop_reason: "end_turn", parsed_output: parsed });
    const draft = await generateRecipe(GenerateRequestSchema.parse({ ingredients: ["chicken"] }), { parse } as never);
    const params = parse.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.output_config.format).toBeDefined();
    expect(draft.sourceType).toBe("claude");
    expect(draft.steps[1].timerSeconds).toBe(720);
    expect(draft.steps[1].ingredientIds).toEqual([draft.ingredients[0].id]);
    expect(draft.tags).toEqual(["tacos"]);
  });

  it("turns a refusal into a friendly error", async () => {
    const parse = vi.fn().mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    await expect(generateRecipe(GenerateRequestSchema.parse({}), { parse } as never)).rejects.toBeInstanceOf(ClaudeRecipeError);
  });

  it("builds a prompt from preferences", () => {
    const prompt = buildGeneratePrompt(
      GenerateRequestSchema.parse({
        ingredients: ["kale", "feta"],
        useOnlyListed: true,
        dietary: ["vegetarian"],
        maxMinutes: 30,
      }),
    );
    expect(prompt).toContain("Use only these ingredients");
    expect(prompt).toContain("kale, feta");
    expect(prompt).toContain("vegetarian");
    expect(prompt).toContain("30 minutes");
  });

  it("asks for a surprise when no preferences are given", () => {
    expect(buildGeneratePrompt(GenerateRequestSchema.parse({}))).toMatch(/surprise/i);
  });
});

describe("safeFetch", () => {
  it.each(["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"])(
    "treats %s as private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it.each(["8.8.8.8", "151.101.1.1", "2606:4700::1111"])("treats %s as public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it("refuses non-http links and private hosts", async () => {
    await expect(fetchPublicPage("file:///etc/passwd")).rejects.toThrow(/http/);
    await expect(fetchPublicPage("http://127.0.0.1:3000/")).rejects.toThrow(/public/);
    await expect(fetchPublicPage("not a url")).rejects.toThrow(/valid/);
  });

  it("follows redirects and re-checks each hop", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "http://10.0.0.1/" } }));
    await expect(fetchPublicPage("http://8.8.8.8/", fetchImpl)).rejects.toThrow(/public/);
  });

  it("returns html from a public page", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>ok</html>", { status: 200 }));
    await expect(fetchPublicPage("http://8.8.8.8/r", fetchImpl)).resolves.toEqual({
      html: "<html>ok</html>",
      finalUrl: "http://8.8.8.8/r",
    });
  });

  it("explains when a site blocks bots", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("no", { status: 403 }));
    await expect(fetchPublicPage("http://8.8.8.8/r", fetchImpl)).rejects.toThrow(/Paste/);
  });
});
