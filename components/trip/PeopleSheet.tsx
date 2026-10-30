"use client";

import { Lock, LockOpen, Link2, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  type ActionResult,
  addPlaceholderAction,
  regenerateInviteAction,
  removeMemberAction,
  renameMemberAction,
  setLockedAction,
} from "@/app/actions";
import { money } from "@/lib/format";
import { Avatar } from "./Avatar";
import type { Me, TripInfo, TripSnapshot } from "./types";

// Members of the trip, opened from the avatar stack in the header. Bottom sheet on phones, dialog on desktop.
export function PeopleSheet({
  trip,
  me,
  myName,
  invite,
  snapshot,
  onChange,
  onClose,
}: {
  trip: TripInfo;
  me: Me;
  myName: string;
  invite: { url: string; qr: string };
  snapshot: TripSnapshot;
  onChange: () => Promise<void>;
  onClose: () => void;
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="People"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">People</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-surface">
            <X size={20} />
          </button>
        </div>

        <ul className="divide-y divide-line">
          {snapshot.members.map((m) => (
            <li key={m.id} className={`flex items-center gap-3 py-3 ${m.status === "inactive" ? "opacity-50" : ""}`}>
              <Avatar member={m} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">
                  {m.name}
                  {m.id === me.memberId && <span className="font-normal text-muted"> (you)</span>}
                </p>
                <p className="text-xs text-muted">
                  {m.role === "organizer" ? "Organizer · " : ""}
                  {m.status === "inactive" ? "Removed" : m.joined ? "Joined with PayPal" : "Not joined yet"}
                </p>
              </div>
              <span className={`tabular text-sm font-medium ${m.netCents < 0 ? "text-negative" : m.netCents > 0 ? "text-positive" : "text-muted"}`}>
                {m.netCents > 0 ? "+" : ""}
                {money(m.netCents, trip.currency)}
              </span>
              {organizer && m.id !== me.memberId && m.status === "active" && (
                <button disabled={busy} onClick={() => act(() => removeMemberAction(trip.publicId, m.id))} className="text-xs text-muted hover:text-negative">
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        <form
          className="mt-4 flex gap-2"
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
            placeholder="Add someone by name"
            className="min-w-0 flex-1 rounded-full border border-line px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <button disabled={busy || !newName.trim()} className="rounded-full border border-ink px-4 text-sm font-medium disabled:opacity-40">
            Add
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <button
            className="text-accent hover:underline"
            onClick={() => {
              const name = prompt("Your name in this trip", myName);
              if (name) act(() => renameMemberAction(trip.publicId, me.memberId, name));
            }}
          >
            Change my name
          </button>
          {organizer && !trip.isDemo && (
            <>
              <button disabled={busy} onClick={share} className="flex items-center gap-1 text-accent hover:underline">
                <Link2 size={14} /> {copied ? "Link copied" : "Share invite link"}
              </button>
              <button disabled={busy} onClick={() => act(() => setLockedAction(trip.publicId, !trip.locked))} className="flex items-center gap-1 text-accent hover:underline">
                {trip.locked ? <LockOpen size={14} /> : <Lock size={14} />} {trip.locked ? "Unlock trip" : "Lock trip"}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (confirm("The current invite link will stop working. Continue?")) act(() => regenerateInviteAction(trip.publicId), true);
                }}
                className="text-accent hover:underline"
              >
                New invite link
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
