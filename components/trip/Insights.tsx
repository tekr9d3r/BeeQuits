"use client";

import { AgStudio } from "ag-studio-react";
import {
  AgStudioAiModule,
  AgStudioLicenseManager,
  createAiHarness,
  studioTheme,
  type AgAiPromptStarter,
  type AgPanelConfig,
  type AgReportState,
  type AgStudioApi,
  type AgStudioProperties,
} from "ag-studio";
import { useMemo, useSyncExternalStore } from "react";
import { insightsAdapter } from "./insightsAdapter";
import { CATEGORY_LABEL, type TripSnapshot } from "./types";

// Without a key Studio runs with a trial watermark.
if (process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY) {
  AgStudioLicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY);
}

// The app palette for Studio's UI and chart series: navy and a blue scale.
const theme = studioTheme.withParams({
  accentColor: "#0070e0",
  foregroundColor: "#0b1f44",
  textColor: "#0b1f44",
  subtleTextColor: "#5b6475",
  borderColor: "#e6e9ef",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  borderRadius: 12,
  chartPaletteFills1Color: "#0070e0",
  chartPaletteFills2Color: "#0b1f44",
  chartPaletteFills3Color: "#7db4f2",
  chartPaletteFills4Color: "#0a7a46",
  chartPaletteFills5Color: "#b9d6f8",
  chartPaletteFills6Color: "#5b6475",
  chartPaletteFills7Color: "#b42318",
  chartPaletteFills8Color: "#c9d1de",
});

const f = (id: string, aggregation?: "sum" | "count") => ({ id, ...(aggregation && { aggregation }) });
const title = (text: string) => ({ title: { enabled: true, text } });

type Layout = Record<string, { xTrack: number; yTrack: number; xSpan: number; ySpan: number }>;

// Desktop: two columns of charts on the 24-track grid.
const DESKTOP_LAYOUT: Layout = {
  total: { xTrack: 0, yTrack: 0, xSpan: 8, ySpan: 4 },
  count: { xTrack: 8, yTrack: 0, xSpan: 8, ySpan: 4 },
  budget: { xTrack: 16, yTrack: 0, xSpan: 8, ySpan: 4 },
  byCategory: { xTrack: 0, yTrack: 4, xSpan: 10, ySpan: 12 },
  budgetVsSpent: { xTrack: 10, yTrack: 4, xSpan: 14, ySpan: 12 },
  people: { xTrack: 0, yTrack: 16, xSpan: 10, ySpan: 12 },
  ledger: { xTrack: 10, yTrack: 16, xSpan: 14, ySpan: 12 },
};

// Phone: one column, every widget full width, stacked top to bottom.
function stacked(heights: [string, number][]): Layout {
  let y = 0;
  return Object.fromEntries(
    heights.map(([id, ySpan]) => {
      const cell = { xTrack: 0, yTrack: y, xSpan: 24, ySpan };
      y += ySpan;
      return [id, cell];
    }),
  );
}
const MOBILE_LAYOUT = stacked([
  ["total", 4],
  ["count", 4],
  ["budget", 4],
  ["byCategory", 14],
  ["budgetVsSpent", 14],
  ["people", 12],
  ["ledger", 18],
]);

// A finished dashboard shipped as state, so it opens ready-made in view mode.
function buildReport(mobile: boolean): AgReportState {
  const ledgerCols = mobile
    ? [f("expenses.description"), f("expenses.paidBy"), f("expenses.amount")]
    : [f("expenses.date"), f("expenses.description"), f("expenses.category"), f("expenses.paidBy"), f("expenses.people"), f("expenses.amount")];
  return {
    selectedPageId: "insights",
    panels: { filters: { collapsed: true } },
    pages: [
      {
        id: "insights",
        layout: {
          minWidth: mobile ? 0 : 760,
          rowHeight: 24,
          backgroundColor: "#f5f7fa",
          widgetBorderColor: "#e6e9ef",
          widgetBorderRadius: 16,
        },
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
          ledger: { type: "grid", dataMapping: { cols: ledgerCols }, format: title("All expenses") },
        },
        widgetLayout: mobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT,
      },
    ],
  };
}

// Desktop gets AG Studio's assistant (Claude via our server). Its chat panel only exists in edit mode,
// so we show just the assistant and the filters, without Studio's manual editing panels.
const AI_PANELS: AgPanelConfig = { edit: { left: ["ai"], right: ["filters"] } };
const AI_MODULES = [AgStudioAiModule];

const PROMPT_STARTERS: AgAiPromptStarter[] = [
  { label: "Spending per day", prompt: "Add a line chart showing how much the group spent each day." },
  { label: "Who paid the most", prompt: "Add a bar chart of how much each person paid, highest first." },
  { label: "Biggest expenses", prompt: "Add a table of the five most expensive expenses." },
  { label: "Cost per person", prompt: "How much did the trip cost per person, and which category was the most expensive?" },
];

const MOBILE_QUERY = "(max-width: 767px)";

// Studio only reads initialState on mount, so crossing the breakpoint remounts it with the other layout.
function useIsMobile() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(MOBILE_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

export default function Insights({ snapshot, publicId }: { snapshot: TripSnapshot; publicId: string }) {
  const mobile = useIsMobile();
  const report = useMemo(() => buildReport(mobile), [mobile]);
  const ai = useMemo<AgStudioProperties["ai"]>(() => {
    const adapter = insightsAdapter(publicId);
    // The setup hook is typed with the core API; at runtime it is the full Studio API.
    return ({ api }) => createAiHarness(api as AgStudioApi, { adapter, promptStarters: PROMPT_STARTERS });
  }, [publicId]);
  // Polling hands us a new snapshot object every few seconds; only rebuild the data when it changed.
  const key = JSON.stringify([snapshot.expenses, snapshot.budget, snapshot.members]);
  const data = useMemo(() => {
    const name = (id: string) => snapshot.members.find((m) => m.id === id)?.name ?? "?";
    const label = (c: string) => CATEGORY_LABEL[c] ?? c;
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
    <div className={`h-full w-full ${mobile ? "min-h-[80dvh]" : "min-h-[640px] overflow-x-auto"}`}>
      <AgStudio
        key={mobile ? "mobile" : "desktop"}
        data={data}
        initialState={report}
        mode={mobile ? "view" : "edit"}
        {...(!mobile && { modules: AI_MODULES, ai, panels: AI_PANELS })}
        theme={theme}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
