"use client";

import { AgStudio } from "ag-studio-react";
import { AgStudioLicenseManager, studioTheme, type AgReportState } from "ag-studio";
import { useMemo } from "react";
import { CATEGORY_LABEL, type TripSnapshot } from "./types";

// Without a key Studio runs with a trial watermark.
if (process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY) {
  AgStudioLicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY);
}

// Bee palette for Studio's UI and chart series.
const theme = studioTheme.withParams({
  accentColor: "#e0a800",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  borderRadius: 12,
  chartPaletteFills1Color: "#ffc629",
  chartPaletteFills2Color: "#1b1a17",
  chartPaletteFills3Color: "#c2410c",
  chartPaletteFills4Color: "#1f8a4c",
  chartPaletteFills5Color: "#8a6d1f",
  chartPaletteFills6Color: "#ffe08a",
  chartPaletteFills7Color: "#6b6559",
  chartPaletteFills8Color: "#f59e0b",
});

const f = (id: string, aggregation?: "sum" | "count") => ({ id, ...(aggregation && { aggregation }) });
const title = (text: string) => ({ title: { enabled: true, text } });

// A finished dashboard shipped as state, so it opens ready-made in view mode. Layout grid is 24 wide.
const REPORT: AgReportState = {
  selectedPageId: "insights",
  panels: { filters: { collapsed: true } },
  pages: [
    {
      id: "insights",
      layout: { minWidth: 760, rowHeight: 24, backgroundColor: "#fffbf0", widgetBorderColor: "#ede6d3", widgetBorderRadius: 16 },
      widgets: {
        total: { type: "value", dataMapping: { value: [f("expenses.amount", "sum")] }, format: title("Group spent (€)") },
        count: { type: "value", dataMapping: { value: [f("expenses.description", "count")] }, format: title("Expenses logged") },
        budget: { type: "value", dataMapping: { value: [f("budget.budget", "sum")] }, format: title("Total budget (€)") },
        byCategory: {
          type: "donut-chart",
          dataMapping: { categoryKey: [f("expenses.category")], valueKey: [f("expenses.amount", "sum")] },
          format: title("Where the money went"),
        },
        budgetVsSpent: {
          type: "column-chart-grouped",
          dataMapping: { categoryKey: [f("budget.category")], valueKey: [f("budget.budget", "sum"), f("budget.spent", "sum")] },
          format: title("Budget vs spent"),
        },
        people: {
          type: "bar-chart-grouped",
          dataMapping: { categoryKey: [f("people.member")], valueKey: [f("people.paid", "sum"), f("people.share", "sum")] },
          format: title("Paid vs fair share"),
        },
        ledger: {
          type: "grid",
          dataMapping: {
            cols: [f("expenses.date"), f("expenses.description"), f("expenses.category"), f("expenses.paidBy"), f("expenses.people"), f("expenses.amount")],
          },
          format: title("All expenses"),
        },
      },
      widgetLayout: {
        total: { xTrack: 0, yTrack: 0, xSpan: 8, ySpan: 4 },
        count: { xTrack: 8, yTrack: 0, xSpan: 8, ySpan: 4 },
        budget: { xTrack: 16, yTrack: 0, xSpan: 8, ySpan: 4 },
        byCategory: { xTrack: 0, yTrack: 4, xSpan: 10, ySpan: 12 },
        budgetVsSpent: { xTrack: 10, yTrack: 4, xSpan: 14, ySpan: 12 },
        people: { xTrack: 0, yTrack: 16, xSpan: 10, ySpan: 12 },
        ledger: { xTrack: 10, yTrack: 16, xSpan: 14, ySpan: 12 },
      },
    },
  ],
};

export default function Insights({ snapshot }: { snapshot: TripSnapshot }) {
  // Polling hands us a new snapshot object every few seconds; only rebuild the data when it changed.
  const key = JSON.stringify([snapshot.expenses, snapshot.budget, snapshot.members]);
  const data = useMemo(() => {
    const name = (id: string) => snapshot.members.find((m) => m.id === id)?.name ?? "?";
    const label = (c: string) => (CATEGORY_LABEL[c] ?? c).replace(/^\S+\s/, "");
    return {
      sources: [
        {
          id: "expenses",
          name: "Expenses",
          data: snapshot.expenses.map((e) => ({
            date: e.createdAt.slice(0, 10),
            description: e.description,
            category: label(e.category),
            paidBy: name(e.paidBy),
            people: e.splitWith.length,
            amount: e.amountCents / 100,
          })),
        },
        {
          id: "budget",
          name: "Budget",
          data: snapshot.budget.map((b) => ({ category: label(b.category), budget: (b.budgetCents ?? 0) / 100, spent: b.spentCents / 100 })),
        },
        {
          id: "people",
          name: "People",
          data: snapshot.members
            .filter((m) => m.status === "active")
            .map((m) => ({ member: m.name, paid: m.paidCents / 100, share: m.shareCents / 100 })),
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="h-full min-h-[640px] w-full overflow-x-auto">
      <AgStudio data={data} initialState={REPORT} mode="view" theme={theme} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
