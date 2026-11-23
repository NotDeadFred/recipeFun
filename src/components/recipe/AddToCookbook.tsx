"use client";

import { useLayoutEffect, useState } from "react";
import { useApp } from "../AppProvider";
import type { Cookbook } from "@/lib/types";

export function AddToCookbook({ recipeId }: { recipeId: string }) {
  const { repo } = useApp();
  const [open, setOpen] = useState(false);
  const [cookbooks, setCookbooks] = useState<Cookbook[] | null>(null);
  const [newName, setNewName] = useState("");

  // Close the menu when the page is hidden by navigation (pages stay mounted).
  useLayoutEffect(() => () => setOpen(false), []);

  async function toggleOpen() {
    if (!open) setCookbooks(await repo.listCookbooks());
    setOpen(!open);
  }

  async function toggle(book: Cookbook) {
    if (book.recipeIds.includes(recipeId)) await repo.removeRecipeFromCookbook(book.id, recipeId);
    else await repo.addRecipeToCookbook(book.id, recipeId);
    setCookbooks(await repo.listCookbooks());
  }

  async function create() {
    if (!newName.trim()) return;
    const book = await repo.saveCookbook({ name: newName.trim() });
    await repo.addRecipeToCookbook(book.id, recipeId);
    setNewName("");
    setCookbooks(await repo.listCookbooks());
  }

  return (
    <div className="relative">
      <button className="btn" onClick={toggleOpen} aria-expanded={open}>
        📚 Add to cookbook
      </button>
      {open && (
        <div className="card absolute z-20 mt-2 w-72 p-3 shadow-lg" role="dialog" aria-label="Choose cookbooks">
          {cookbooks?.length === 0 && <p className="mb-2 text-sm text-muted">No cookbooks yet.</p>}
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {cookbooks?.map((book) => (
              <li key={book.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-brand"
                    checked={book.recipeIds.includes(recipeId)}
                    onChange={() => toggle(book)}
                  />
                  <span>{book.name}</span>
                  {book.groupId && <span className="ml-auto text-xs text-muted">shared</span>}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2 border-t border-border pt-2">
            <input
              className="input"
              placeholder="New cookbook"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              aria-label="New cookbook name"
            />
            <button className="btn" onClick={create}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
