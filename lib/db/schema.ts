import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// All money is integer cents in the trip currency.

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  paypalUserId: text().notNull().unique(),
  name: text().notNull(),
  paypalEmail: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const trips = pgTable("trips", {
  id: uuid().primaryKey().defaultRandom(),
  publicId: text().notNull().unique(),
  inviteCode: text().notNull(),
  name: text().notNull(),
  currency: text().notNull().default("EUR"),
  startDate: date(),
  endDate: date(),
  status: text({ enum: ["active", "settling", "closed"] }).notNull().default("active"),
  lockedAt: timestamp({ withTimezone: true }),
  isDemo: boolean().notNull().default(false),
  createdBy: uuid().references(() => users.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// user_id null = placeholder member (added by name, claimed on join).
export const tripMembers = pgTable(
  "trip_members",
  {
    id: uuid().primaryKey().defaultRandom(),
    tripId: uuid().notNull().references(() => trips.id, { onDelete: "cascade" }),
    userId: uuid().references(() => users.id),
    displayName: text().notNull(),
    role: text({ enum: ["organizer", "member"] }).notNull().default("member"),
    status: text({ enum: ["active", "inactive"] }).notNull().default("active"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("trip_members_trip_user").on(t.tripId, t.userId)],
);

export const budgets = pgTable(
  "budgets",
  {
    tripId: uuid().notNull().references(() => trips.id, { onDelete: "cascade" }),
    category: text().notNull(),
    amountCents: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tripId, t.category] })],
);

export const receipts = pgTable("receipts", {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: "cascade" }),
  mediaType: text().notNull(),
  dataBase64: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable(
  "expenses",
  {
    id: uuid().primaryKey().defaultRandom(),
    tripId: uuid().notNull().references(() => trips.id, { onDelete: "cascade" }),
    paidBy: uuid().notNull().references(() => tripMembers.id),
    amountCents: integer().notNull(),
    category: text().notNull(),
    description: text().notNull(),
    receiptId: uuid().references(() => receipts.id),
    productUrl: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("expenses_trip").on(t.tripId)],
);

export const expenseSplits = pgTable(
  "expense_splits",
  {
    expenseId: uuid().notNull().references(() => expenses.id, { onDelete: "cascade" }),
    memberId: uuid().notNull().references(() => tripMembers.id),
    shareCents: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.memberId] })],
);

// seq gives a cheap cursor for chat polling ("messages after seq N").
// memberId null = written by the agent.
export const messages = pgTable(
  "messages",
  {
    seq: bigserial({ mode: "number" }).primaryKey(),
    tripId: uuid().notNull().references(() => trips.id, { onDelete: "cascade" }),
    memberId: uuid().references(() => tripMembers.id),
    content: text().notNull(),
    attachments: jsonb().$type<MessageAttachment[]>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_trip_seq").on(t.tripId, t.seq)],
);

export type MessageAttachment =
  | { type: "receipt"; receiptId: string }
  | { type: "expense"; expenseId: string }
  | { type: "settlement"; settlementId: string }
  | { type: "products"; products: ProductCard[] };

export type ProductCard = {
  title: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  approxTripCurrency: number | null;
  merchant: string;
  url: string;
};

export const settlements = pgTable("settlements", {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: "cascade" }),
  fromMember: uuid().notNull().references(() => tripMembers.id),
  toMember: uuid().notNull().references(() => tripMembers.id),
  amountCents: integer().notNull(),
  paypalOrderId: text().unique(),
  paypalCaptureId: text(),
  status: text({ enum: ["pending", "approved", "captured", "failed"] }).notNull().default("pending"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp({ withTimezone: true }),
});

export const webhookEvents = pgTable("webhook_events", {
  paypalEventId: text().primaryKey(),
  eventType: text().notNull(),
  payload: jsonb().notNull(),
  receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp({ withTimezone: true }),
});

export const tripMembersRelations = relations(tripMembers, ({ one }) => ({
  user: one(users, { fields: [tripMembers.userId], references: [users.id] }),
  trip: one(trips, { fields: [tripMembers.tripId], references: [trips.id] }),
}));

export const expensesRelations = relations(expenses, ({ many, one }) => ({
  splits: many(expenseSplits),
  payer: one(tripMembers, { fields: [expenses.paidBy], references: [tripMembers.id] }),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, { fields: [expenseSplits.expenseId], references: [expenses.id] }),
}));
