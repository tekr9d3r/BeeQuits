import type { MessageAttachment } from "@/lib/db/schema";
import type { TripSnapshot } from "@/lib/trip-view";

export type { TripSnapshot };

export type ChatMessage = {
  seq: number;
  memberId: string | null;
  content: string;
  attachments: MessageAttachment[] | null;
  createdAt: string;
};

export type TripInfo = {
  publicId: string;
  name: string;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  isDemo: boolean;
  locked: boolean;
};

export type Me = { memberId: string; role: "organizer" | "member" };

export const CATEGORY_LABEL: Record<string, string> = {
  lodging: "Lodging",
  lift_passes: "Lift passes",
  rental: "Rental",
  transport: "Transport",
  groceries: "Groceries",
  food_drinks: "Food & drinks",
  apres_ski: "Après-ski",
  gear: "Gear",
  activities: "Activities",
  other: "Other",
};
