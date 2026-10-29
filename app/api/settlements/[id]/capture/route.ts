import { captureSettlementOrder } from "@/lib/settlements";
import { memberForSettlement } from "@/lib/settlement-auth";

// Called by the PayPal button's onApprove. The webhook confirms the same capture independently.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await memberForSettlement(id);
  if (!me) return new Response("Forbidden", { status: 403 });
  try {
    const settlement = await captureSettlementOrder(id, me.id);
    return Response.json({ status: settlement?.status });
  } catch (error) {
    console.error("[settlement capture]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Capture failed" }, { status: 400 });
  }
}
