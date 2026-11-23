"use client";

import { useState, type FormEvent } from "react";
import { useApp, withApp } from "@/components/AppProvider";
import { useAsync } from "@/lib/hooks";
import { clearChecked, toggleItem } from "@/lib/shoppingList";
import { parseIngredientLine } from "@/lib/ingredients";
import { formatQuantity, formatUnit } from "@/lib/scaling";
import { newId } from "@/lib/ids";
import type { ShoppingItem } from "@/lib/types";

function ShoppingPage() {
  const { repo } = useApp();
  const { data: items, setData } = useAsync(() => repo.getShoppingList(), [repo]);
  const [newItem, setNewItem] = useState("");

  async function save(next: ShoppingItem[]) {
    setData(next);
    await repo.saveShoppingList(next);
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    const ing = parseIngredientLine(newItem);
    await save([...(items ?? []), { id: newId(), name: ing.name, quantity: ing.quantity, unit: ing.unit, checked: false, recipeIds: [] }]);
    setNewItem("");
  }

  const list = items ?? [];
  const sorted = [...list].sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name));
  const checkedCount = list.filter((i) => i.checked).length;

  return (
    <div className="page max-w-2xl">
      <h1 className="page-title">Shopping list</h1>
      <p className="mt-1 text-muted">Add a recipe&apos;s ingredients from its page. Matching items are combined.</p>

      <form onSubmit={add} className="mt-6 flex gap-2">
        <input className="input" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item, e.g. 2 lemons" aria-label="New item" />
        <button className="btn-primary">Add</button>
      </form>

      {list.length === 0 ? (
        <p className="mt-10 text-center text-muted">Your list is empty.</p>
      ) : (
        <ul className="card mt-4 divide-y divide-border" aria-label="Shopping list">
          {sorted.map((item) => (
            <li key={item.id}>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4">
                <input type="checkbox" className="size-6 accent-brand" checked={item.checked} onChange={() => save(toggleItem(list, item.id))} />
                <span className={item.checked ? "text-muted line-through" : ""}>
                  {item.quantity !== null && <strong>{formatQuantity(item.quantity, item.unit)} </strong>}
                  {item.unit && `${formatUnit(item.unit, item.quantity)} `}
                  {item.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {list.length > 0 && (
        <div className="mt-4 flex gap-2">
          <button className="btn" onClick={() => save(clearChecked(list))} disabled={checkedCount === 0}>
            Remove checked ({checkedCount})
          </button>
          <button
            className="btn text-danger"
            onClick={() => {
              if (confirm("Clear the whole list?")) void save([]);
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default withApp(ShoppingPage);
