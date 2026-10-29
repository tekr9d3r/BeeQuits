"use client";

import { useState, useTransition } from "react";
import {
  type ActionResult,
  addPlaceholderAction,
  regenerateInviteAction,
  removeMemberAction,
  renameMemberAction,
  setLockedAction,
} from "@/app/actions";
import { Card } from "./Dashboard";
import type { Me, TripInfo, TripSnapshot } from "./types";

export function People({
  trip,
  me,
  myName,
  invite,
  snapshot,
  onChange,
}: {
  trip: TripInfo;
  me: Me;
  myName: string;
  invite: { url: string; qr: string };
  snapshot: TripSnapshot;
  onChange: () => Promise<void>;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState(false);
  const organizer = me.role === "organizer";

  const act = (fn: () => Promise<ActionResult>, reload = false) =>
    start(async () => {
      setError(null);
      const result = await fn();
      if (result.error) setError(result.error);
      else if (reload) window.location.reload();
      else await onChange();
    });

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: trip.name, text: `Join "${trip.name}" on BeeQuits`, url: invite.url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-0">
      <Card title="Invite friends">
        {trip.locked ? (
          <p className="text-sm text-muted">🔒 The trip is locked, so new people can&apos;t join.</p>
        ) : (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={invite.qr} alt="Invite QR code" className="size-28 rounded-lg border border-line" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-sm text-muted">Friends join with PayPal, so they can get paid back.</p>
              <button onClick={share} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
                {copied ? "Link copied ✓" : "Share invite link"}
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title={`People (${snapshot.members.filter((m) => m.status === "active").length})`}>
        <ul className="divide-y divide-line">
          {snapshot.members.map((m) => (
            <li key={m.id} className={`flex items-center justify-between gap-2 py-2 text-sm ${m.status === "inactive" ? "opacity-50" : ""}`}>
              <span className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-honey-soft font-semibold">{m.name[0]}</span>
                <span>
                  {m.name}
                  {m.id === me.memberId && <span className="text-muted"> (you)</span>}
                  <span className="block text-xs text-muted">
                    {m.role === "organizer" ? "Organizer · " : ""}
                    {m.status === "inactive" ? "removed" : m.joined ? "joined via PayPal ✓" : "not joined yet"}
                  </span>
                </span>
              </span>
              {organizer && m.id !== me.memberId && m.status === "active" && (
                <button
                  disabled={busy}
                  onClick={() => act(() => removeMemberAction(trip.publicId, m.id))}
                  className="text-xs text-muted underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName;
            setNewName("");
            act(() => addPlaceholderAction(trip.publicId, name));
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add someone who hasn't joined"
            className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-honey-strong"
          />
          <button disabled={busy || !newName.trim()} className="rounded-full border-2 border-ink px-4 text-sm font-semibold disabled:opacity-40">
            Add
          </button>
        </form>

        <button
          className="mt-3 text-xs text-muted underline"
          onClick={() => {
            const name = prompt("Your name in this trip", myName);
            if (name) act(() => renameMemberAction(trip.publicId, me.memberId, name));
          }}
        >
          Change my name
        </button>
      </Card>

      {organizer && (
        <Card title="Organizer">
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => act(() => setLockedAction(trip.publicId, !trip.locked))}
              className="rounded-full border border-line px-4 py-2 text-sm"
            >
              {trip.locked ? "🔓 Unlock trip" : "🔒 Lock trip"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (confirm("The current invite link will stop working. Continue?")) act(() => regenerateInviteAction(trip.publicId), true);
              }}
              className="rounded-full border border-line px-4 py-2 text-sm"
            >
              New invite link
            </button>
          </div>
        </Card>
      )}
      {error && <p className="text-sm text-warn">{error}</p>}
    </div>
  );
}
