"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Chat } from "./Chat";
import { Dashboard } from "./Dashboard";
import { People } from "./People";
import type { ChatMessage, Me, TripInfo, TripSnapshot } from "./types";

const POLL_MS = 2500;
type Tab = "chat" | "dashboard" | "people" | "insights";

// AG Studio is heavy and browser-only, so it loads when the Insights tab is first opened.
const Insights = dynamic(() => import("./Insights"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">Loading insights…</p>,
});

export function TripApp(props: {
  trip: TripInfo;
  me: Me;
  invite: { url: string; qr: string };
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

  function openTab(t: Tab) {
    setTab(t);
    if (t === "insights" && snapshot.tour && !snapshot.tour.insights) {
      fetch(`/api/trips/${trip.publicId}/tour`, { method: "POST" }).then(refresh);
    }
  }

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
        </div>
      </header>

      <nav className="flex border-b border-line bg-card lg:hidden">
        {(["chat", "dashboard", "people", "insights"] as const).map((t) => (
          <button
            key={t}
            onClick={() => openTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-ink" : "text-muted"}`}
          >
            {t}
          </button>
        ))}
      </nav>
      <nav className="hidden border-b border-line bg-card lg:block">
        <div className="mx-auto flex max-w-6xl gap-6 px-4">
          {(
            [
              ["chat", "Trip"],
              ["insights", "Insights"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => openTab(t)}
              className={`py-2.5 text-sm font-medium ${(tab === "insights") === (t === "insights") ? "border-b-2 border-ink" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "insights" && (
        <div className="mx-auto min-h-0 w-full max-w-6xl flex-1 overflow-y-auto lg:p-4">
          <Insights snapshot={snapshot} />
        </div>
      )}
      <div className={`mx-auto ${tab === "insights" ? "hidden" : "grid"} min-h-0 w-full max-w-6xl flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6 lg:px-4 lg:py-4`}>
        <section className={`min-h-0 flex-col ${tab === "chat" ? "flex" : "hidden"} lg:flex lg:rounded-2xl lg:border lg:border-line lg:bg-card`}>
          <Chat
            trip={trip}
            me={me}
            messages={messages}
            snapshot={snapshot}
            paypalClientId={props.paypalClientId}
            onSent={refresh}
            onOpenInsights={() => openTab("insights")}
          />
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
