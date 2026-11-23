"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useApp, withApp } from "@/components/AppProvider";
import { useAsync } from "@/lib/hooks";

function GroupsPage() {
  const { repo, mode } = useApp();
  const { data: groups, reload } = useAsync(() => repo.listGroups(), [repo]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await repo.createGroup(name);
    setName("");
    await reload();
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await repo.joinGroup(code);
      setCode("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="page max-w-4xl">
      <h1 className="page-title">Groups</h1>
      <p className="mt-1 text-muted">Make a group for your family or friends, share the invite code, then share cookbooks with the group.</p>
      {mode === "local" && (
        <p className="mt-4 rounded-md bg-highlight p-3 text-sm" role="status">
          You&apos;re in local mode, so groups live only on this device. Connect Supabase (see the README) to invite other people.
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <form onSubmit={create} className="card space-y-3 p-5">
          <h2 className="font-semibold">Create a group</h2>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Smith Family" aria-label="Group name" />
          <button className="btn-primary">Create group</button>
        </form>
        <form onSubmit={join} className="card space-y-3 p-5">
          <h2 className="font-semibold">Join with an invite code</h2>
          <input
            className="input font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD2345"
            aria-label="Invite code"
          />
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <button className="btn">Join group</button>
        </form>
      </div>

      <ul className="mt-6 space-y-3" aria-label="Your groups">
        {groups?.map((g) => (
          <li key={g.id}>
            <Link href={`/groups/${g.id}`} className="card flex items-center justify-between p-5 hover:shadow-md">
              <span className="text-lg font-semibold">👥 {g.name}</span>
              <span className="text-sm text-muted">
                {g.members.length} {g.members.length === 1 ? "member" : "members"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default withApp(GroupsPage);
