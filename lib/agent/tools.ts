import type Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, addExpense, deleteExpense, getBalances, getBudgetStatus, setBudget, updateExpense } from "../ledger/service";
import { addPlaceholder } from "../trips";
import type { MessageAttachment } from "../db/schema";

const cents = (amount: number) => Math.round(amount * 100);

const splitSchema = {
  type: "object",
  description: "Who the expense is for. 'equal' splits evenly among member_ids; 'exact' gives each person's amount.",
  properties: {
    type: { type: "string", enum: ["equal", "exact"] },
    member_ids: { type: "array", items: { type: "string" }, description: "For 'equal': members sharing the cost." },
    shares: {
      type: "array",
      description: "For 'exact': amount per member, summing to the total.",
      items: {
        type: "object",
        properties: { member_id: { type: "string" }, amount: { type: "number" } },
        required: ["member_id", "amount"],
        additionalProperties: false,
      },
    },
  },
  required: ["type"],
  additionalProperties: false,
} as const;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "add_expense",
    description: "Log a payment to the trip ledger.",
    input_schema: {
      type: "object",
      properties: {
        paid_by: { type: "string", description: "Member id of who paid." },
        amount: { type: "number", description: "Total in the trip currency, e.g. 96.5" },
        category: { type: "string", enum: [...CATEGORIES] },
        description: { type: "string", description: "Short label, e.g. 'Spar groceries'." },
        split: splitSchema,
      },
      required: ["paid_by", "amount", "category", "description", "split"],
      additionalProperties: false,
    },
  },
  {
    name: "update_expense",
    description: "Correct an existing expense. Only pass the fields that change.",
    input_schema: {
      type: "object",
      properties: {
        expense_id: { type: "string" },
        paid_by: { type: "string" },
        amount: { type: "number" },
        category: { type: "string", enum: [...CATEGORIES] },
        description: { type: "string" },
        split: splitSchema,
      },
      required: ["expense_id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_expense",
    description: "Remove an expense from the ledger.",
    input_schema: {
      type: "object",
      properties: { expense_id: { type: "string" } },
      required: ["expense_id"],
      additionalProperties: false,
    },
  },
  {
    name: "add_member",
    description: "Add someone who hasn't joined yet as a placeholder member. They can claim it when they join.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_balances",
    description: "Current balance per member and the minimal transfers that would settle everyone.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "set_budget",
    description: "Set the budget for a category.",
    input_schema: {
      type: "object",
      properties: { category: { type: "string", enum: [...CATEGORIES] }, amount: { type: "number" } },
      required: ["category", "amount"],
      additionalProperties: false,
    },
  },
  {
    name: "get_budget_status",
    description: "Spent vs budget per category.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

type SplitInput = { type: "equal" | "exact"; member_ids?: string[]; shares?: { member_id: string; amount: number }[] };

function toSplit(split: SplitInput) {
  if (split.type === "exact") {
    return {
      type: "exact" as const,
      shares: (split.shares ?? []).map((s) => ({ memberId: s.member_id, shareCents: cents(s.amount) })),
    };
  }
  return { type: "equal" as const, memberIds: split.member_ids ?? [] };
}

export type ToolContext = {
  tripId: string;
  receiptId: string | null;
  memberName: (id: string) => string;
  attachments: MessageAttachment[];
};

// Runs one tool call. Errors are returned to the model as text so it can recover or ask.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runTool(name: string, input: any, ctx: ToolContext): Promise<string> {
  switch (name) {
    case "add_expense": {
      const expense = await addExpense({
        tripId: ctx.tripId,
        paidBy: input.paid_by,
        amountCents: cents(input.amount),
        category: input.category,
        description: input.description,
        split: toSplit(input.split),
        receiptId: ctx.receiptId,
      });
      ctx.attachments.push({ type: "expense", expenseId: expense.id });
      return JSON.stringify({
        ok: true,
        expense_id: expense.id,
        split: expense.splits.map((s) => `${ctx.memberName(s.memberId)} ${(s.shareCents / 100).toFixed(2)}`),
      });
    }
    case "update_expense": {
      await updateExpense(ctx.tripId, input.expense_id, {
        paidBy: input.paid_by,
        amountCents: input.amount === undefined ? undefined : cents(input.amount),
        category: input.category,
        description: input.description,
        split: input.split ? toSplit(input.split) : undefined,
      });
      ctx.attachments.push({ type: "expense", expenseId: input.expense_id });
      return JSON.stringify({ ok: true });
    }
    case "delete_expense":
      await deleteExpense(ctx.tripId, input.expense_id);
      return JSON.stringify({ ok: true });
    case "add_member": {
      const member = await addPlaceholder(ctx.tripId, input.name);
      return JSON.stringify({ ok: true, member_id: member.id, name: member.displayName });
    }
    case "get_balances": {
      const { balances, transfers, totalCents } = await getBalances(ctx.tripId);
      return JSON.stringify({
        total_spent: totalCents / 100,
        balances: balances.map((b) => ({ member: ctx.memberName(b.memberId), paid: b.paidCents / 100, share: b.owedCents / 100, net: b.netCents / 100 })),
        settle_up: transfers.map((t) => `${ctx.memberName(t.from)} pays ${ctx.memberName(t.to)} ${(t.amountCents / 100).toFixed(2)}`),
      });
    }
    case "set_budget":
      await setBudget(ctx.tripId, input.category, cents(input.amount));
      return JSON.stringify({ ok: true });
    case "get_budget_status":
      return JSON.stringify(
        (await getBudgetStatus(ctx.tripId)).map((r) => ({
          category: r.category,
          budget: r.budgetCents === null ? null : r.budgetCents / 100,
          spent: r.spentCents / 100,
        })),
      );
    default:
      return JSON.stringify({ ok: false, error: `Unknown tool ${name}` });
  }
}
