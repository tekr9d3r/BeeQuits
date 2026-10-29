// Pure money math. No database, no AI: the agent calls these through tools.
// Amounts are integer cents.

export type Share = { memberId: string; shareCents: number };

// Splits evenly; leftover cents go to the first members so shares always sum to the total.
export function splitEvenly(totalCents: number, memberIds: string[]): Share[] {
  if (memberIds.length === 0) throw new Error("Split needs at least one member");
  const base = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents - base * memberIds.length;
  return memberIds.map((memberId, i) => ({ memberId, shareCents: base + (i < remainder ? 1 : 0) }));
}

export type LedgerExpense = { paidBy: string; amountCents: number; splits: Share[] };
export type Balance = { memberId: string; paidCents: number; owedCents: number; netCents: number };

// netCents > 0: the group owes this member. netCents < 0: this member owes the group.
export function computeBalances(memberIds: string[], expenses: LedgerExpense[]): Balance[] {
  const byId = new Map(memberIds.map((id) => [id, { memberId: id, paidCents: 0, owedCents: 0, netCents: 0 }]));
  const get = (id: string) => {
    let b = byId.get(id);
    if (!b) byId.set(id, (b = { memberId: id, paidCents: 0, owedCents: 0, netCents: 0 }));
    return b;
  };
  for (const e of expenses) {
    get(e.paidBy).paidCents += e.amountCents;
    for (const s of e.splits) get(s.memberId).owedCents += s.shareCents;
  }
  for (const b of byId.values()) b.netCents = b.paidCents - b.owedCents;
  return [...byId.values()];
}

export type Transfer = { from: string; to: string; amountCents: number };

// Greedy: the biggest debtor pays the biggest creditor until everyone is even.
// Produces at most n-1 transfers.
export function minimalTransfers(balances: Pick<Balance, "memberId" | "netCents">[]): Transfer[] {
  const debtors = balances.filter((b) => b.netCents < 0).map((b) => ({ id: b.memberId, cents: -b.netCents }));
  const creditors = balances.filter((b) => b.netCents > 0).map((b) => ({ id: b.memberId, cents: b.netCents }));
  const byAmountDesc = (a: { cents: number }, b: { cents: number }) => b.cents - a.cents;
  const transfers: Transfer[] = [];
  debtors.sort(byAmountDesc);
  creditors.sort(byAmountDesc);
  while (debtors.length && creditors.length) {
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.cents, c.cents);
    transfers.push({ from: d.id, to: c.id, amountCents: amount });
    d.cents -= amount;
    c.cents -= amount;
    if (d.cents === 0) debtors.shift();
    if (c.cents === 0) creditors.shift();
    debtors.sort(byAmountDesc);
    creditors.sort(byAmountDesc);
  }
  return transfers;
}
