import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import { computeBalances, minimalTransfers, splitEvenly, type Share } from "./math";

const { expenses, expenseSplits, budgets, tripMembers } = schema;

export const CATEGORIES = [
  "lodging",
  "lift_passes",
  "rental",
  "transport",
  "groceries",
  "food_drinks",
  "apres_ski",
  "gear",
  "activities",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type SplitSpec =
  | { type: "equal"; memberIds: string[] }
  | { type: "exact"; shares: Share[] };

function resolveSplit(amountCents: number, split: SplitSpec): Share[] {
  if (split.type === "equal") return splitEvenly(amountCents, split.memberIds);
  const total = split.shares.reduce((a, s) => a + s.shareCents, 0);
  if (total !== amountCents) throw new Error(`Shares add up to ${total} cents but the expense is ${amountCents}`);
  return split.shares;
}

export async function addExpense(input: {
  tripId: string;
  paidBy: string;
  amountCents: number;
  category: string;
  description: string;
  split: SplitSpec;
  receiptId?: string | null;
  productUrl?: string | null;
  createdAt?: Date;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Amount must be positive");
  const shares = resolveSplit(input.amountCents, input.split);
  return db.transaction(async (tx) => {
    const [expense] = await tx
      .insert(expenses)
      .values({
        tripId: input.tripId,
        paidBy: input.paidBy,
        amountCents: input.amountCents,
        category: input.category,
        description: input.description,
        receiptId: input.receiptId ?? null,
        productUrl: input.productUrl ?? null,
        ...(input.createdAt && { createdAt: input.createdAt }),
      })
      .returning();
    await tx.insert(expenseSplits).values(shares.map((s) => ({ expenseId: expense.id, ...s })));
    return { ...expense, splits: shares };
  });
}

export async function updateExpense(
  tripId: string,
  expenseId: string,
  patch: Partial<{ paidBy: string; amountCents: number; category: string; description: string; split: SplitSpec }>,
) {
  return db.transaction(async (tx) => {
    const current = await tx.query.expenses.findFirst({
      where: and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId), isNull(expenses.deletedAt)),
      with: { splits: true },
    });
    if (!current) throw new Error("Expense not found");
    const amountCents = patch.amountCents ?? current.amountCents;
    const { split, ...fields } = patch;
    await tx.update(expenses).set(fields).where(eq(expenses.id, expenseId));

    // A new amount without a new split keeps the same people, re-split evenly.
    const newSplit: SplitSpec | undefined =
      split ?? (patch.amountCents ? { type: "equal", memberIds: current.splits.map((s) => s.memberId) } : undefined);
    if (newSplit) {
      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
      await tx.insert(expenseSplits).values(resolveSplit(amountCents, newSplit).map((s) => ({ expenseId, ...s })));
    }
  });
}

export async function deleteExpense(tripId: string, expenseId: string) {
  await db
    .update(expenses)
    .set({ deletedAt: new Date() })
    .where(and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId)));
}

export async function listExpenses(tripId: string) {
  return db.query.expenses.findMany({
    where: and(eq(expenses.tripId, tripId), isNull(expenses.deletedAt)),
    with: { splits: true },
    orderBy: desc(expenses.createdAt),
  });
}

// Balances after expenses and any settle-up payments already made.
export async function getBalances(tripId: string) {
  const [members, ledger, paid] = await Promise.all([
    db.query.tripMembers.findMany({ where: eq(tripMembers.tripId, tripId) }),
    listExpenses(tripId),
    db.query.settlements.findMany({
      where: and(eq(schema.settlements.tripId, tripId), eq(schema.settlements.status, "captured")),
    }),
  ]);
  const balances = computeBalances(
    members.map((m) => m.id),
    ledger.map((e) => ({ paidBy: e.paidBy, amountCents: e.amountCents, splits: e.splits })),
  );
  for (const p of paid) {
    const from = balances.find((b) => b.memberId === p.fromMember);
    const to = balances.find((b) => b.memberId === p.toMember);
    if (from) from.netCents += p.amountCents;
    if (to) to.netCents -= p.amountCents;
  }
  const totalCents = ledger.reduce((a, e) => a + e.amountCents, 0);
  return { members, balances, totalCents, transfers: minimalTransfers(balances) };
}

export async function setBudget(tripId: string, category: string, amountCents: number) {
  await db
    .insert(budgets)
    .values({ tripId, category, amountCents })
    .onConflictDoUpdate({ target: [budgets.tripId, budgets.category], set: { amountCents } });
}

export async function getBudgetStatus(tripId: string) {
  const [rows, ledger] = await Promise.all([
    db.query.budgets.findMany({ where: eq(budgets.tripId, tripId) }),
    listExpenses(tripId),
  ]);
  const spent = new Map<string, number>();
  for (const e of ledger) spent.set(e.category, (spent.get(e.category) ?? 0) + e.amountCents);
  const categories = new Set([...rows.map((r) => r.category), ...spent.keys()]);
  return [...categories].map((category) => {
    const budgetCents = rows.find((r) => r.category === category)?.amountCents ?? null;
    const spentCents = spent.get(category) ?? 0;
    return { category, budgetCents, spentCents, remainingCents: budgetCents === null ? null : budgetCents - spentCents };
  });
}
