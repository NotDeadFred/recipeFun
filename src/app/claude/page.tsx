"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { ClaudeRequestForm, type ClaudeFormValues } from "@/components/claude/ClaudeRequestForm";
import { DraftPreview } from "@/components/recipe/DraftPreview";
import type { RecipeDraft } from "@/lib/types";

export default function ClaudePage() {
  const { bfcacheId } = useRouter();
  return <ClaudeContent key={bfcacheId} />;
}

function ClaudeContent() {
  const { apiFetch, claudeEnabled } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [lastRequest, setLastRequest] = useState<ClaudeFormValues | null>(null);

  async function generate(req: ClaudeFormValues) {
    setBusy(true);
    setError(null);
    setLastRequest(req);
    try {
      const res = await apiFetch("/api/generate", { method: "POST", body: JSON.stringify(req) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claude couldn't create a recipe.");
      setDraft(data.recipe);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page max-w-5xl">
      <h1 className="page-title">✨ Cooking with Claude</h1>
      <p className="mt-1 text-muted">
        Tell Claude what you have and what you&apos;re in the mood for. You&apos;ll get an original recipe you can save, edit and cook step by step.
      </p>

      {!claudeEnabled && (
        <p className="mt-4 rounded-xl bg-highlight p-3 text-sm" role="status">
          Claude isn&apos;t set up on this server yet. Add <code>ANTHROPIC_API_KEY</code> to the environment and restart.
        </p>
      )}

      {draft ? (
        <DraftPreview
          draft={draft}
          onDiscard={() => setDraft(null)}
          extraActions={
            lastRequest && (
              <button className="btn" onClick={() => generate(lastRequest)} disabled={busy}>
                {busy ? "Trying again…" : "🔄 Try another"}
              </button>
            )
          }
        />
      ) : (
        <div className="card mt-6 p-4 sm:p-6">
          <ClaudeRequestForm busy={busy} onSubmit={generate} />
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-danger/10 p-3 text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
