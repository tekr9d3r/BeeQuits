import Link from "next/link";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-bold tracking-tight ${size === "lg" ? "text-3xl" : "text-lg"}`}>
      <span aria-hidden className="grid place-items-center rounded-full bg-honey size-[1.6em] text-[0.8em]">🐝</span>
      BeeQuits
    </Link>
  );
}
