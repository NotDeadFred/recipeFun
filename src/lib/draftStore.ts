import type { RecipeDraft } from "./types";

const KEY = "recipefun:pending-draft";

/** Hand a draft (from import or Claude) to the editor page. */
export function setPendingDraft(draft: RecipeDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable */
  }
}

export function takePendingDraft(): RecipeDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as RecipeDraft) : null;
  } catch {
    return null;
  }
}
