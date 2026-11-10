import type { AgAiEvent, AgLlmAdapter, AgLlmResponse } from "ag-studio";

// AG Studio's assistant talks to Claude through our server, so the API key never reaches the browser.
// The server answers a whole turn at once; we replay it to Studio as stream events.
export function insightsAdapter(publicId: string): AgLlmAdapter {
  return {
    executeTurn(request, options) {
      const complete: Promise<AgLlmResponse> = fetch(`/api/trips/${publicId}/insights-ai`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: options?.signal,
      }).then(async (res) => {
        if (res.ok) return res.json();
        return {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          status: "failed",
          error: { code: String(res.status), message: (await res.text()) || "The assistant is unavailable." },
          output: [],
        };
      });

      async function* stream(): AsyncGenerator<AgAiEvent> {
        const response = await complete;
        for (const item of response.output) {
          if (item.type === "message") {
            const text = item.content.map((c) => (c.type === "text" ? c.text : c.refusal)).join("\n");
            yield { type: "TEXT_MESSAGE_START", messageId: item.id, role: "assistant" };
            yield { type: "TEXT_MESSAGE_CONTENT", messageId: item.id, delta: text };
            yield { type: "TEXT_MESSAGE_END", messageId: item.id };
          } else if (item.type === "function_call") {
            yield { type: "TOOL_CALL_START", toolCallId: item.callId, toolCallName: item.name };
            yield { type: "TOOL_CALL_ARGS", toolCallId: item.callId, delta: item.arguments };
            yield { type: "TOOL_CALL_END", toolCallId: item.callId };
          }
        }
      }

      return { stream: stream(), complete };
    },
  };
}
