import { describe, expect, it } from "vitest";
import { computeBalances, minimalTransfers, splitEvenly, type LedgerExpense } from "./math";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("splitEvenly", () => {
  it("distributes leftover cents so shares sum to the total", () => {
    const shares = splitEvenly(1000, ["a", "b", "c"]);
    expect(shares.map((s) => s.shareCents)).toEqual([334, 333, 333]);
    expect(sum(shares.map((s) => s.shareCents))).toBe(1000);
  });

  it("rejects an empty split", () => {
    expect(() => splitEvenly(100, [])).toThrow();
  });
});

describe("balances and transfers", () => {
  const members = ["jack", "emma", "sam", "olivia"];
  const expenses: LedgerExpense[] = [
    { paidBy: "jack", amountCents: 114000, splits: splitEvenly(114000, members) }, // lift passes
    { paidBy: "emma", amountCents: 9600, splits: splitEvenly(9600, ["jack", "emma", "olivia"]) }, // Spar, not Sam
    { paidBy: "sam", amountCents: 8000, splits: splitEvenly(8000, members) }, // fuel
    { paidBy: "olivia", amountCents: 4999, splits: [{ memberId: "olivia", shareCents: 4999 }] }, // personal helmet
  ];

  it("nets to zero across the group", () => {
    const balances = computeBalances(members, expenses);
    expect(sum(balances.map((b) => b.netCents))).toBe(0);
  });

  it("settles everyone with at most n-1 transfers", () => {
    const balances = computeBalances(members, expenses);
    const transfers = minimalTransfers(balances);
    expect(transfers.length).toBeLessThanOrEqual(members.length - 1);

    const after = new Map(balances.map((b) => [b.memberId, b.netCents]));
    for (const t of transfers) {
      expect(t.amountCents).toBeGreaterThan(0);
      after.set(t.from, after.get(t.from)! + t.amountCents);
      after.set(t.to, after.get(t.to)! - t.amountCents);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
  });

  it("returns no transfers when everyone is even", () => {
    expect(minimalTransfers(computeBalances(members, []))).toEqual([]);
  });
});
