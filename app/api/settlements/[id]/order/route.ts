import { createSettlementOrder } from "@/lib/settlements";
import { memberForSettlement } from "@/lib/settlement-auth";

// Called by the PayPal button's createOrder: returns the order id for the debtor to approve.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await memberForSettlement(id);
  if (!me) return new Response("Forbidden", { status: 403 });
  try {
    return Response.json({ orderId: await createSettlementOrder(id, me.id) });
  } catch (error) {
    console.error("[settlement order]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not create the PayPal order" }, { status: 400 });
  }
}
