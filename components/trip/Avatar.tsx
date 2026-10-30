import { BeeMark } from "@/components/Logo";
import type { TripSnapshot } from "./types";

type MemberLike = Pick<TripSnapshot["members"][number], "name" | "avatar">;

export function Avatar({ member, size = 32, ring = false }: { member?: MemberLike; size?: number; ring?: boolean }) {
  const style = { width: size, height: size };
  const ringClass = ring ? "ring-2 ring-bg" : "";
  if (member?.avatar.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={member.avatar.photo} alt={member.name} style={style} className={`shrink-0 rounded-full object-cover ${ringClass}`} />;
  }
  return (
    <span
      aria-label={member?.name}
      style={{ ...style, fontSize: size * 0.38 }}
      className={`grid shrink-0 place-items-center rounded-full bg-surface font-semibold text-ink ${ringClass}`}
    >
      {member?.avatar.initials ?? "?"}
    </span>
  );
}

export function BeeAvatar({ size = 32 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full border border-line bg-bg">
      <BeeMark size={size * 0.62} />
    </span>
  );
}
