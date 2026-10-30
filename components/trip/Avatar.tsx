import type { TripSnapshot } from "./types";

export function Avatar({ member, size = 32 }: { member?: TripSnapshot["members"][number]; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, fontSize: size * 0.55, background: member?.avatar.color ?? "var(--line)" }}
    >
      {member?.avatar.emoji ?? "🙂"}
    </span>
  );
}

export function BeeAvatar({ size = 32 }: { size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-honey" style={{ width: size, height: size, fontSize: size * 0.55 }}>
      🐝
    </span>
  );
}
