"use client";

import { useFormStatus } from "react-dom";
import { startDemoTour } from "@/app/actions";

// Client form so the button can show progress and the submit carries a one-time key
// (a double click then reopens the same tour instead of starting a second one).
export function DemoStartForm({ children }: { children: React.ReactNode }) {
  return (
    <form
      action={startDemoTour}
      onSubmit={(e) => {
        // Set on the first submit and kept for any repeat submit of this form.
        const key = e.currentTarget.elements.namedItem("startKey") as HTMLInputElement;
        if (!key.value) key.value = crypto.randomUUID();
      }}
      className="mt-8 flex flex-col gap-5"
    >
      <input type="hidden" name="startKey" defaultValue="" />
      {children}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:opacity-90 disabled:opacity-60">
      {pending ? "Setting up your trip… 🐝" : "Invite friends & open the trip"}
    </button>
  );
}
