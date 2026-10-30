import Link from "next/link";

// Minimal bee mark: striped navy body, two outline wings, one honey dot.
export function BeeMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <ellipse cx="8.2" cy="7.6" rx="4.2" ry="2.8" transform="rotate(-30 8.2 7.6)" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
      <ellipse cx="15.8" cy="7.6" rx="4.2" ry="2.8" transform="rotate(30 15.8 7.6)" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
      <rect x="7.5" y="9" width="9" height="12" rx="4.5" fill="var(--ink)" />
      <rect x="7.5" y="13.2" width="9" height="1.4" fill="var(--bg)" />
      <rect x="7.5" y="16.4" width="9" height="1.4" fill="var(--bg)" />
      <circle cx="18.6" cy="19.4" r="1.6" fill="var(--honey)" />
    </svg>
  );
}

export function Logo({ size = "md", href = "/" }: { size?: "md" | "lg"; href?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-semibold tracking-tight text-ink ${size === "lg" ? "text-2xl" : "text-[17px]"}`}>
      <BeeMark size={size === "lg" ? 30 : 24} />
      BeeQuits
    </Link>
  );
}
