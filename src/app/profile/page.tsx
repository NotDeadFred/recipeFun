"use client";

import { useState, type FormEvent } from "react";
import { useApp } from "@/components/AppProvider";
import type { UnitSystem } from "@/lib/types";

export default function ProfilePage() {
  const { repo, profile, refreshProfile, mode, signOut, claudeEnabled } = useApp();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(profile.unitSystem);
  const [saved, setSaved] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    await repo.updateProfile({ displayName: displayName.trim() || profile.displayName, unitSystem });
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="page max-w-xl">
      <h1 className="page-title">Your profile</h1>
      {profile.email && <p className="mt-1 text-muted">{profile.email}</p>}

      <form onSubmit={save} className="card mt-6 space-y-4 p-5">
        <label className="field">
          <span>Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="field">
          <span>Preferred units</span>
          <select value={unitSystem} onChange={(e) => setUnitSystem(e.target.value as UnitSystem)}>
            <option value="us">US (cups, ounces)</option>
            <option value="metric">Metric (grams, millilitres)</option>
          </select>
        </label>
        <button className="btn-primary">{saved ? "Saved ✓" : "Save"}</button>
      </form>

      <div className="card mt-6 space-y-2 p-5 text-sm">
        <h2 className="text-base font-semibold">This app</h2>
        <p>
          Storage: <strong>{mode === "local" ? "This device only (local mode)" : "Your account (synced)"}</strong>
        </p>
        <p>
          Cooking with Claude: <strong>{claudeEnabled ? "Ready" : "Not configured"}</strong>
        </p>
        <p className="text-muted">On iPad, tap Share → Add to Home Screen to install RecipeFun as an app.</p>
      </div>

      {mode === "supabase" && (
        <button className="btn mt-6" onClick={signOut}>
          Sign out
        </button>
      )}
    </div>
  );
}
