"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { viewAs } from "@/app/actions";
import { Logo } from "@/components/Logo";
import { Chat } from "./Chat";
import { Dashboard } from "./Dashboard";
import { People } from "./People";
import type { ChatMessage, Me, TripInfo, TripSnapshot } from "./types";

const POLL_MS = 2500;
type Tab = "chat" | "dashboard" | "people";

export function TripApp(props: {
  trip: TripInfo;
  me: Me;
  invite: { url: string; qr: string };
  demoCrew: { id: string; name: string }[];
  paypalClientId: string;
  initialMessages: ChatMessage[];
  initialSnapshot: TripSnapshot;
}) {
  const { me } = props;
  const [trip, setTrip] = useState(props.trip);
  const [messages, setMessages] = useState(props.initialMessages);
  const [snapshot, setSnapshot] = useState(props.initialSnapshot);
  const [tab, setTab] = useState<Tab>("chat");
  const lastSeq = useRef(props.initialMessages.at(-1)?.seq ?? 0);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/trips/${trip.publicId}/feed?after=${lastSeq.current}`, { cache: "no-store" });
    if (!res.ok) return;
    const data: { messages: ChatMessage[]; snapshot: TripSnapshot; locked: boolean } = await res.json();
    if (data.messages.length) {
      lastSeq.current = data.messages.at(-1)!.seq;
      setMessages((prev) => [...prev, ...data.messages.filter((m) => m.seq > (prev.at(-1)?.seq ?? 0))]);
    }
    setSnapshot(data.snapshot);
    setTrip((t) => (t.locked === data.locked ? t : { ...t, locked: data.locked }));
  }, [trip.publicId]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const myName = snapshot.members.find((m) => m.id === me.memberId)?.name ?? "You";

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-line bg-card px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <Logo />
            <h1 className="truncate text-sm text-muted">
              {trip.name}
              {trip.locked && " · 🔒 settling up"}
            </h1>
          </div>
          {trip.isDemo && <DemoSwitcher trip={trip} crew={props.demoCrew} current={me.memberId} />}
        </div>
      </header>

      <nav className="flex border-b border-line bg-card lg:hidden">
        {(["chat", "dashboard", "people"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-ink" : "text-muted"}`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6 lg:px-4 lg:py-4">
        <section className={`min-h-0 flex-col ${tab === "chat" ? "flex" : "hidden"} lg:flex lg:rounded-2xl lg:border lg:border-line lg:bg-card`}>
          <Chat trip={trip} me={me} messages={messages} snapshot={snapshot} paypalClientId={props.paypalClientId} onSent={refresh} />
        </section>
        <aside className={`min-h-0 overflow-y-auto ${tab === "chat" ? "hidden" : "block"} lg:block`}>
          <div className={tab === "people" ? "hidden lg:block" : ""}>
            <Dashboard trip={trip} me={me} snapshot={snapshot} paypalClientId={props.paypalClientId} onPaid={refresh} />
          </div>
          <div className={tab === "dashboard" ? "hidden lg:block" : "lg:mt-6"}>
            <People trip={trip} me={me} myName={myName} invite={props.invite} snapshot={snapshot} onChange={refresh} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function DemoSwitcher({ trip, crew, current }: { trip: TripInfo; crew: { id: string; name: string }[]; current: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex shrink-0 items-center gap-2 rounded-full bg-honey-soft px-3 py-1.5 text-sm">
      <span className="hidden sm:inline">Demo · viewing as</span>
      <span className="sm:hidden">As</span>
      <select
        value={current}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          await viewAs(trip.publicId, e.target.value);
          window.location.reload();
        }}
        className="bg-transparent font-semibold outline-none"
      >
        {crew.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
