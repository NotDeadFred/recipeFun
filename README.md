# RecipeFun 🍳

A recipe and cooking app for the web and iPad. Collect recipes from your favorite sites, write your own, have Claude invent new ones, and cook step by step with a split view that highlights the current step and the ingredients it uses.

## Features

- **Recipes from anywhere**
  - **Import from a link.** Most recipe sites (Allrecipes, BBC Good Food, Serious Eats, NYT Cooking, …) publish [schema.org](https://schema.org/Recipe) data, which RecipeFun reads directly. Pages without it fall back to Claude.
  - **Paste text** from an email, note or page; Claude turns it into a structured recipe.
  - **One-tap bookmarklet** to import whatever recipe page you're on.
  - **Saved sites**: keep a list of your favorite recipe sites and search them all from one box.
  - **Write your own** with a simple form (one ingredient/step per line, `# Heading` for sections).
- **✨ Cooking with Claude**: pick ingredients you have, a flavor profile, cuisine, dietary needs, time limit and skill level, and Claude writes an original recipe you can save, edit and cook.
- **Split-view recipe page**: ingredients beside steps. Tap a step to highlight the ingredients it uses. Scale servings and switch between as-written, US and metric units.
- **Cook mode** (step-by-step walkthrough)
  - Current step enlarged and highlighted; its ingredients light up and scroll into view.
  - Big Back/Next buttons, swipe, keyboard arrows/space (works with iPad keyboards and page-turner pedals).
  - **Timers** detected from step text ("simmer 10 minutes"), several at once, with sound and vibration.
  - **Hands-free voice**: say "next", "back", "repeat", "start timer", "what ingredients", "go to step 4".
  - **Read aloud** each step. The screen stays awake while you cook.
- **Profiles, groups and shared cookbooks**: create a group, share its invite code, and share cookbooks with the group so everyone can cook from them.
- **Shopping list** built from recipes, with smart merging (1 cup + 8 tbsp milk → 1½ cups).
- **Installable on iPad** (Add to Home Screen) with offline access to pages you've opened.

## Quick start

Requires Node.js 20.9 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. With no configuration the app runs in **local mode**: everything is saved in your browser, with two sample recipes to start.

To turn on Claude and accounts, copy `.env.example` to `.env.local` and fill in the keys (see below), then restart.

## Configuration

| Variable | What it enables |
| --- | --- |
| `ANTHROPIC_API_KEY` | Cooking with Claude, pasted-text import, and the fallback for sites without recipe data. Server-side only. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accounts, profiles, groups and shared cookbooks, synced across devices. |

### Set up Supabase (accounts, groups, sharing)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/migrations/20261122000000_init.sql`](supabase/migrations/20261122000000_init.sql). Or, with the Supabase CLI: `supabase link` then `supabase db push`.
3. Copy the project URL and anon key (Project Settings → API) into `.env.local`.
4. Under Authentication → URL Configuration, add your site URL (for example `http://localhost:3000`, plus your deployed URL).

Access rules live in the database as row-level security policies:

- You can see and edit your own recipes, cookbooks, saved sites and shopping list.
- Members of a group can see cookbooks shared with that group, and the recipes in them (read-only).
- Any member can add their recipes to a shared cookbook; only the owner can rename, unshare or delete it.
- Groups are joined by invite code, through a database function, so nobody can list other people's groups.

### Set up Claude

Create an API key at [platform.claude.com](https://platform.claude.com/) and set `ANTHROPIC_API_KEY`. The app uses `claude-opus-5-5` with structured outputs, so replies always match the recipe schema. If a request is declined by a safety check, it retries on a fallback model automatically. A typical recipe costs a few cents.

When Supabase is configured, the Claude and import endpoints require a signed-in user, so strangers can't spend your credits.

## Using it on iPad

1. Deploy (see below) or run on your network: `npm run build && npx next start -H 0.0.0.0`, then open `http://<your-computer>:3000` on the iPad.
2. In Safari, tap **Share → Add to Home Screen**.
3. RecipeFun opens full screen like an app. Cook mode keeps the screen awake (iPadOS 18.4+). Voice control asks for microphone permission the first time.

Installing as an app, and keeping the screen awake, need HTTPS everywhere except `localhost`, so use a deployed copy for daily use.

## Deploying

The simplest path is [Vercel](https://vercel.com): import the GitHub repo, add the environment variables, deploy. Any Node host that runs `npm run build && npm start` works too.

## Tests

| Command | What it runs |
| --- | --- |
| `npm test` | Unit and component tests (Vitest + Testing Library) |
| `npm run test:coverage` | The same, with a coverage report in `coverage/` |
| `npm run test:e2e` | End-to-end tests (Playwright) on desktop Chrome and iPad (Safari's WebKit, landscape and portrait) |
| `npm run lint`, `npm run typecheck` | ESLint and TypeScript |

Before the first end-to-end run, install the browsers with `npx playwright install chromium webkit`.

End-to-end tests run against a production build in local mode. Claude is mocked, so tests never spend API credits, and imports use a stand-in recipe site. GitHub Actions runs everything on each push and pull request (`.github/workflows/ci.yml`).

## How it's built

- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS 4**
- **Storage** behind one interface (`src/lib/data/repository.ts`) with two implementations:
  - `LocalRepository`: browser storage, used when Supabase isn't configured.
  - `SupabaseRepository`: Postgres with row-level security.
- **Server routes** (`src/app/api/*`): `import` (fetch + parse a recipe page), `structure` (Claude structures text), `generate` (Cooking with Claude), `status`.
- **Recipe logic** is plain TypeScript in `src/lib/` and fully unit-tested: ingredient parsing, scaling, unit conversion, timer detection, ingredient-to-step linking, schema.org extraction, shopping-list merging, voice commands, and the cook-mode state machine.
- **Import safety**: the importer only fetches public addresses (private network ranges are blocked, including after redirects), with size and time limits.

```
src/
  app/            pages and API routes
  components/     UI (recipe view, cook mode, forms)
  lib/            recipe logic, storage, server code
supabase/         database schema and access rules
e2e/              Playwright tests
```

## Notes

- Imported recipes are for personal use. Each keeps a link to its source; please respect each site's terms.
- Some sites block automated requests. When that happens, use **Paste text** or the bookmarklet.
