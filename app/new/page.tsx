import { redirect } from "next/navigation";
import { startTrip } from "@/app/actions";
import { Logo } from "@/components/Logo";
import { currentUser } from "@/lib/auth";

// Reads the session cookie, so it renders per request.
export const instant = false;

export default async function NewTrip() {
  if (!(await currentUser())) redirect("/api/auth/paypal/login?next=/new");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <Logo />
      <h1 className="mt-10 text-3xl font-bold tracking-tight">New trip</h1>
      <p className="mt-2 text-muted">You&apos;ll get a link to invite your friends next.</p>
      <form action={startTrip} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Trip name</span>
          <input name="name" required maxLength={80} placeholder="Ski week in Sölden" className="rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-honey-strong" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">From</span>
            <input type="date" name="startDate" className="rounded-xl border border-line bg-card px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">To</span>
            <input type="date" name="endDate" className="rounded-xl border border-line bg-card px-3 py-3" />
          </label>
        </div>
        <p className="text-sm text-muted">Currency: EUR</p>
        <button className="rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:opacity-90">Create trip</button>
      </form>
    </main>
  );
}
