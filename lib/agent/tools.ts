import type Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, addExpense, deleteExpense, getBalances, getBudgetStatus, setBudget, updateExpense } from "../ledger/service";
import { listSettlements, reopenTrip, startSettlement } from "../settlements";
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
    name: "start_settlement",
    description:
      "Settle up: locks the trip and creates the minimal set of PayPal transfers. Each debtor then gets a Pay button in the app. Use when the group says they want to settle.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_settlement_status",
    description: "Which settle-up transfers are paid and which are still open.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "reopen_trip",
    description: "Cancel the settle-up so expenses can be changed again. Only possible before anyone has paid.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
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
  tripStatus: "active" | "settling" | "closed";
  receiptId: string | null;
  memberName: (id: string) => string;
  attachments: MessageAttachment[];
};

// Runs one tool call. Errors are returned to the model as text so it can recover or ask.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runTool(name: string, input: any, ctx: ToolContext): Promise<string> {
  const changesLedger = ["add_expense", "update_expense", "delete_expense"].includes(name);
  if (changesLedger && ctx.tripStatus !== "active") {
    throw new Error("The trip is settling up, so the ledger is frozen. Use reopen_trip first if nobody has paid yet.");
  }
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
    case "start_settlement": {
      const { settlements, alreadyStarted } = await startSettlement(ctx.tripId);
      if (settlements.length) ctx.tripStatus = "settling";
      if (settlements.length) ctx.attachments.push({ type: "settle_up" });
      return JSON.stringify({
        already_started: alreadyStarted,
        transfers: settlements.map((s) => `${ctx.memberName(s.fromMember)} pays ${ctx.memberName(s.toMember)} ${(s.amountCents / 100).toFixed(2)} (${s.status})`),
        note: settlements.length ? "Each payer now sees a PayPal Pay button in the app." : "Everyone is already even.",
      });
    }
    case "get_settlement_status":
      return JSON.stringify(
        (await listSettlements(ctx.tripId)).map((s) => ({
          from: ctx.memberName(s.fromMember),
          to: ctx.memberName(s.toMember),
          amount: s.amountCents / 100,
          status: s.status === "captured" ? "paid" : "open",
        })),
      );
    case "reopen_trip":
      await reopenTrip(ctx.tripId);
      ctx.tripStatus = "active";
      return JSON.stringify({ ok: true, note: "The ledger is open again." });
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
