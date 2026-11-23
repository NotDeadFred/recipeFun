"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useAsync } from "@/lib/hooks";

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { repo, profile } = useApp();
  const { data, loading } = useAsync(async () => {
    const [group, cookbooks] = await Promise.all([repo.getGroup(id), repo.listCookbooks()]);
    return { group, cookbooks: cookbooks.filter((c) => c.groupId === id) };
  }, [repo, id]);
  const [copied, setCopied] = useState(false);

  if (loading && !data) return <p className="page text-muted">Loading…</p>;
  const group = data?.group;
  if (!group) return <p className="page">Group not found.</p>;
  const isOwner = group.ownerId === profile.id;

  async function copyCode() {
    await navigator.clipboard?.writeText(group!.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function leave() {
    const msg = isOwner ? `Delete “${group!.name}” for everyone? Shared cookbooks become private.` : `Leave “${group!.name}”?`;
    if (!confirm(msg)) return;
    if (isOwner) await repo.deleteGroup(group!.id);
    else await repo.leaveGroup(group!.id);
    router.push("/groups");
  }

  return (
    <div className="page max-w-4xl">
      <Link href="/groups" className="text-sm text-brand">
        ← Groups
      </Link>
      <h1 className="page-title mt-2">👥 {group.name}</h1>

      <div className="card mt-6 flex flex-wrap items-center gap-3 p-5">
        <div className="flex-1">
          <p className="text-sm text-muted">Invite code — share it so others can join</p>
          <p className="font-mono text-2xl font-bold tracking-widest" data-testid="invite-code">
            {group.inviteCode}
          </p>
        </div>
        <button className="btn" onClick={copyCode}>
          {copied ? "Copied!" : "Copy code"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Members</h2>
          <ul className="mt-2 space-y-2">
            {group.members.map((m) => (
              <li key={m.userId} className="flex justify-between">
                <span>{m.displayName}</span>
                <span className="text-sm text-muted">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Shared cookbooks</h2>
          {data!.cookbooks.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              None yet. Open a cookbook and choose this group under “Shared with”.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {data!.cookbooks.map((c) => (
                <li key={c.id}>
                  <Link href={`/cookbooks/${c.id}`} className="text-brand underline">
                    📚 {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <button className="btn mt-8 text-danger" onClick={leave}>
        {isOwner ? "Delete group" : "Leave group"}
      </button>
    </div>
  );
}
