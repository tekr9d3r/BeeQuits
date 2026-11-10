import Anthropic from "@anthropic-ai/sdk";
import type { AgAiConversationItem, AgAiOutputItem, AgLlmRequest, AgLlmResponse } from "ag-studio";
import { loadMembership } from "@/lib/trip-view";

// Sonnet only for BeeQuits (cost). Building a widget needs more reasoning than logging an expense.
const MODEL = "claude-sonnet-5-5";
const MAX_BODY_BYTES = 600_000;

const client = new Anthropic();

// One turn of AG Studio's Insights assistant. Studio sends its conversation, instructions and
// tool schemas; we translate them to Claude and hand back the reply. Studio runs the tools itself.
export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { trip, me } = await loadMembership((await params).publicId);
  if (!trip || !me) return new Response("Not a member of this trip", { status: 403 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("Conversation too long, start a new chat", { status: 413 });
  const turn: AgLlmRequest = JSON.parse(raw);

  const tools: Anthropic.Tool[] = (turn.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));
  if (tools.length) tools[tools.length - 1].cache_control = { type: "ephemeral" };

  const choice = turn.toolChoice;
  const tool_choice: Anthropic.ToolChoice | undefined = !tools.length
    ? undefined
    : choice === "none"
      ? { type: "none" }
      : choice === "required"
        ? { type: "any" }
        : typeof choice === "object"
          ? { type: "tool", name: choice.name }
          : { type: "auto" };

  const { system, messages } = toClaude(turn.input);
  try {
    const reply = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "low" },
      system: [{ type: "text", text: [turn.instructions, ...system].filter(Boolean).join("\n\n"), cache_control: { type: "ephemeral" } }],
      messages,
      ...(tools.length && { tools, tool_choice }),
    });
    return Response.json(fromClaude(reply));
  } catch (error) {
    console.error("[insights-ai]", error);
    const failed: AgLlmResponse = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: "failed",
      error: { code: "provider_error", message: "The assistant couldn't answer. Please try again." },
      output: [],
    };
    return Response.json(failed);
  }
}

function toClaude(items: AgAiConversationItem[]) {
  const system: string[] = [];
  const messages: Anthropic.MessageParam[] = [];
  const push = (role: "user" | "assistant", block: Anthropic.ContentBlockParam) => {
    const last = messages.at(-1);
    if (last?.role === role && Array.isArray(last.content)) last.content.push(block);
    else messages.push({ role, content: [block] });
  };

  for (const item of items) {
    if (item.type === "message" && item.kind === "input") {
      const text = item.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");
      if (!text) continue;
      if (item.role === "system") system.push(text);
      else push("user", { type: "text", text });
    } else if (item.type === "message") {
      const text = item.content.map((c) => (c.type === "text" ? c.text : c.refusal)).join("\n");
      if (text) push("assistant", { type: "text", text });
    } else if (item.type === "function_call") {
      push("assistant", { type: "tool_use", id: item.callId, name: item.name, input: parseArgs(item.arguments) });
    } else if (item.type === "function_call_output") {
      push("user", { type: "tool_result", tool_use_id: item.callId, content: item.output });
    }
  }
  return { system, messages };
}

function parseArgs(args: string) {
  try {
    return JSON.parse(args || "{}");
  } catch {
    return {};
  }
}

function fromClaude(reply: Anthropic.Message): AgLlmResponse {
  const output: AgAiOutputItem[] = [];
  for (const block of reply.content) {
    if (block.type === "text" && block.text) {
      output.push({
        id: crypto.randomUUID(),
        kind: "output",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "text", text: block.text, annotations: [] }],
      });
    } else if (block.type === "tool_use") {
      output.push({
        id: block.id,
        kind: "output",
        type: "function_call",
        callId: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input),
        status: "completed",
      });
    }
  }
  const cut = reply.stop_reason === "max_tokens";
  return {
    id: reply.id,
    createdAt: Date.now(),
    status: cut ? "incomplete" : "completed",
    ...(cut && { incompleteDetails: { reason: "max_output_tokens" as const } }),
    output,
    model: reply.model,
    usage: {
      inputTokens: reply.usage.input_tokens,
      outputTokens: reply.usage.output_tokens,
      cachedInputTokens: reply.usage.cache_read_input_tokens ?? undefined,
      cacheWriteTokens: reply.usage.cache_creation_input_tokens ?? undefined,
    },
  };
}
