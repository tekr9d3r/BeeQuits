import { existsSync } from "node:fs";
import path from "node:path";

// Demo friends have portrait photos in public/people; everyone else gets their initials.
export type Avatar = { photo: string | null; initials: string };

const DEMO_PHOTOS: Record<string, string> = {
  "demo:emma": "emma",
  "demo:sam": "sam",
  "demo:olivia": "olivia",
};

const photoCache = new Map<string, string | null>();

export function photoFor(key: string): string | null {
  if (!photoCache.has(key)) {
    const found = [".jpg", ".jpeg", ".png", ".webp"].find((ext) => existsSync(path.join(process.cwd(), "public/people", key + ext)));
    photoCache.set(key, found ? `/people/${key}${found}` : null);
  }
  return photoCache.get(key)!;
}

export function avatarFor(member: { displayName: string; user: { paypalUserId: string } | null }): Avatar {
  const key = member.user ? DEMO_PHOTOS[member.user.paypalUserId] : undefined;
  const initials = member.displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { photo: key ? photoFor(key) : null, initials };
}
