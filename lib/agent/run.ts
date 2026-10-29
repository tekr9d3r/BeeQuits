import Anthropic from "@anthropic-ai/sdk";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import type { MessageAttachment } from "../db/schema";
import { getBudgetStatus, listExpenses } from "../ledger/service";
import { listMembers, type Trip } from "../trips";
import { SYSTEM_PROMPT } from "./prompt";
import { TOOLS, runTool } from "./tools";

// Sonnet only for BeeQuits (cost). Low effort is plenty for parsing chat into ledger entries.
const MODEL = "claude-sonnet-5-5";
const HISTORY = 20;
const MAX_TOOL_ROUNDS = 8;

const client = new Anthropic();

// Reads the latest chat, lets Claude act on the ledger through tools, and posts its reply (if any).
export async function runAgent(trip: Trip) {
  const [members, ledger, budget, recent] = await Promise.all([
    listMembers(trip.id),
    listExpenses(trip.id),
    getBudgetStatus(trip.id),
    db.query.messages.findMany({
      where: eq(schema.messages.tripId, trip.id),
      orderBy: desc(schema.messages.seq),
      limit: HISTORY,
    }),
  ]);
  const history = recent.reverse();
  const nameOf = new Map(members.map((m) => [m.id, m.displayName]));
  const memberName = (id: string) => nameOf.get(id) ?? "someone";

  // The newest receipt in the unanswered messages is attached to expenses logged this turn.
  const lastAgentIdx = history.findLastIndex((m) => m.memberId === null);
  const pending = history.slice(lastAgentIdx + 1);
  const receiptId =
    pending.flatMap((m) => m.attachments ?? []).findLast((a) => a.type === "receipt")?.receiptId ?? null;

  const state = [
    `Trip: ${trip.name} (currency ${trip.currency}${trip.startDate ? `, ${trip.startDate} to ${trip.endDate}` : ""})`,
    `Members:\n${members.map((m) => `- ${m.displayName} (id ${m.id})${m.userId ? "" : " [not joined yet]"}`).join("\n")}`,
    `Recent expenses:\n${
      ledger
        .slice(0, 15)
        .map((e) => `- id ${e.id}: ${(e.amountCents / 100).toFixed(2)} ${e.category} "${e.description}" paid by ${memberName(e.paidBy)}, split ${e.splits.map((s) => memberName(s.memberId)).join("/")}`)
        .join("\n") || "(none yet)"
    }`,
    `Budget: ${budget.length ? budget.map((b) => `${b.category} spent ${(b.spentCents / 100).toFixed(2)}${b.budgetCents === null ? "" : ` of ${(b.budgetCents / 100).toFixed(2)}`}`).join("; ") : "(none set)"}`,
  ].join("\n\n");

  const lastAgentSeq = lastAgentIdx >= 0 ? history[lastAgentIdx].seq : 0;
  const messages = await toClaudeMessages(history, memberName, state, lastAgentSeq);
  if (!messages) return null;

  const attachments: MessageAttachment[] = [];
  const ctx = { tripId: trip.id, receiptId, memberName, attachments };
  let reply = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });
    messages.push({ role: "assistant", content: response.content });
    reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (response.stop_reason !== "tool_use") break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        results.push({ type: "tool_result", tool_use_id: block.id, content: await runTool(block.name, block.input, ctx) });
      } catch (error) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: String(error), is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }

  if (!reply || reply === "NO_REPLY") return null;
  const [message] = await db
    .insert(schema.messages)
    .values({ tripId: trip.id, content: reply, attachments: attachments.length ? attachments : null })
    .returning();
  return message;
}

type ChatMessage = typeof schema.messages.$inferSelect;

// Agent messages become assistant turns; member messages become user turns prefixed with the sender.
// Trip state rides along in the final user turn so the system prompt stays cacheable.
async function toClaudeMessages(
  history: ChatMessage[],
  memberName: (id: string) => string,
  state: string,
  lastAgentSeq: number,
) {
  const out: Anthropic.MessageParam[] = [];
  for (const m of history) {
    if (m.memberId === null) {
      if (out.length) out.push({ role: "assistant", content: m.content });
      continue;
    }
    const content: Anthropic.ContentBlockParam[] = [];
    // Only unanswered photos are sent; older ones were already turned into expenses.
    for (const a of m.seq > lastAgentSeq ? (m.attachments ?? []) : []) {
      if (a.type !== "receipt") continue;
      const receipt = await db.query.receipts.findFirst({ where: eq(schema.receipts.id, a.receiptId) });
      if (receipt) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: receipt.mediaType as "image/jpeg", data: receipt.dataBase64 },
        });
      }
    }
    content.push({ type: "text", text: `${memberName(m.memberId)}: ${m.content || "(sent a photo)"}` });
    out.push({ role: "user", content });
  }
  const last = out.at(-1);
  if (!last || last.role !== "user") return null; // nothing new to respond to
  (last.content as Anthropic.ContentBlockParam[]).unshift({ type: "text", text: `<trip_state>\n${state}\n</trip_state>` });
  return out;
}
