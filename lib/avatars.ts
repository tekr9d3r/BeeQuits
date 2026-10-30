// PayPal's login doesn't share profile photos, so each member gets an animal avatar instead.
// Assigned by join order from a per-trip starting point, so everyone in a trip looks different.
const ANIMALS = ["🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🦉", "🐧", "🐙", "🦄", "🐢", "🐳", "🦔", "🦦", "🐰", "🦩", "🐺", "🦭", "🐮", "🐷", "🦥", "🐞"];
const COLORS = ["#ffe08a", "#ffd1dc", "#c8e6ff", "#d4f5d0", "#e6d8ff", "#ffd9b8", "#cff4f1", "#f5e1c8"];

export type Avatar = { emoji: string; color: string };

function hash(text: string) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function avatarFor(tripId: string, joinIndex: number): Avatar {
  const start = hash(tripId);
  return { emoji: ANIMALS[(start + joinIndex) % ANIMALS.length], color: COLORS[(start + joinIndex * 3) % COLORS.length] };
}
