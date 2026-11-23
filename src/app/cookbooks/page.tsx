"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useApp, withApp } from "@/components/AppProvider";
import { useAsync } from "@/lib/hooks";

function CookbooksPage() {
  const { repo, profile } = useApp();
  const { data, reload } = useAsync(async () => {
    const [cookbooks, groups] = await Promise.all([repo.listCookbooks(), repo.listGroups()]);
    return { cookbooks, groups };
  }, [repo]);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await repo.saveCookbook({ name: name.trim(), groupId: groupId || null });
    setName("");
    setGroupId("");
    await reload();
  }

  const groupName = (id?: string | null) => data?.groups.find((g) => g.id === id)?.name;

  return (
    <div className="page max-w-4xl">
      <h1 className="page-title">Cookbooks</h1>
      <p className="mt-1 text-muted">Collect recipes into cookbooks. Share a cookbook with a group so everyone in it can cook from it.</p>

      <form onSubmit={create} className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="field flex-1">
          <span>New cookbook</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday baking" />
        </label>
        <label className="field sm:w-56">
          <span>Share with</span>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Just me</option>
            {data?.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary">Create</button>
      </form>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Cookbooks">
        {data?.cookbooks.map((c) => (
          <li key={c.id}>
            <Link href={`/cookbooks/${c.id}`} className="card flex flex-col p-5 hover:shadow-md">
              <span className="text-lg font-semibold">📚 {c.name}</span>
              <span className="mt-1 text-sm text-muted">
                {c.recipeIds.length} {c.recipeIds.length === 1 ? "recipe" : "recipes"}
                {c.groupId ? ` · Shared with ${groupName(c.groupId) ?? "a group"}` : " · Private"}
                {c.ownerId !== profile.id ? " · Owned by someone else" : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {data && data.cookbooks.length === 0 && <p className="mt-6 text-center text-muted">No cookbooks yet.</p>}
    </div>
  );
}

export default withApp(CookbooksPage);
