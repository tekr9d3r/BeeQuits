# Group Trip Money Agent: Project Brief

Working name: TBD. Entry for the **PayPal AI Hackathon** on Devpost.

> An agent-based Tricount for group trips. Friends log in with PayPal, log expenses in a group chat with an AI agent, track spend against a shared budget, and settle up with real PayPal payments sent directly between members. The app keeps the ledger; PayPal moves the money. Money never touches the app.

---

## 1. Hackathon context

- **Hackathon:** https://paypalaihackathon.devpost.com/
- **Deadline:** Nov 12, 2026 @ 12:00 PM PST (= 21:00 Slovenia time). The intro webinar mentioned 2:00 PM PT; go with the earlier one.
- **Hard requirement:** the project must *meaningfully* use both PayPal and AI. A PayPal button bolted onto an unrelated app does not count. PayPal must be central.
- **Submission needs:**
  - Working build judges can run: hosted demo URL or complete setup instructions in the repo. Mockups or non-functional demos do not count.
  - Public GitHub repo with a visible open-source license
  - Demo video under 3 minutes (YouTube)
  - Project name, elevator pitch, project story, list of tools used
- **Judging (20% each):** Technical Implementation, Design, Potential Impact, Innovation, Presentation
- **Prizes:** 1st $12k, 2nd $8k, 3rd $5k. Special categories ($5k each): Most Creative, Most Impactful, Best Demo Delivery, Best Use of PayPal + AI, Best Use of Agentic Commerce. Partner prizes stack on top.
- **Support:** PayPal Discord (PayPal + partner teams are there)

## 2. Problem

On group trips, one person pays for the apartment, another for groceries, a third for fuel. By the end nobody knows who owes what, budgets get blown without anyone noticing, and settling up means a spreadsheet, a calculator and a week of awkward reminders. Existing apps (Splitwise, Tricount) need careful manual entry and stop at "Ana owes you 42€". The actual payment and chasing is still on you.

## 3. Solution

A web app where a trip group shares one AI agent that:

1. Turns messy chat messages and receipt photos into a clean shared ledger
2. Proposes and tracks a group budget, warning before overspending
3. Computes the minimum set of transfers at the end
4. Sends each person a PayPal payment request with the right friend as payee, nudges the slow ones, and confirms payments automatically

**Core principle:** money never touches the app. Every settle-up is a direct PayPal payment from one member to another.

## 4. Scope

### In scope (MVP spine, non-negotiable)
- Log In with PayPal
- Create trip, invite members
- Group chat with the agent
- Agent parses natural language expenses into structured ledger entries (asks when ambiguous)
- Balances: who paid what, who owes whom
- Settlement: minimal transfers + PayPal checkout per transfer with friend as payee
- Webhooks mark transfers as paid
- Dashboard: spend vs budget, balances, owes scoreboard

### Nice to have (cut first if behind)
- Agent proposes budget per category from trip details (days, people, plans)
- Receipt photo parsing
- Agent nudges for unpaid transfers
- Q&A over the ledger ("how much have I spent on drinks?")

### Out of scope
- Trip itinerary / activity planning
- Booking anything
- Group pot / app holding funds
- Crypto / PYUSD
- Multi-currency (stick to EUR, maybe USD)

## 5. User flow

1. **Create trip.** Organizer logs in with PayPal, creates "Piran weekend", invites friends via link.
2. **Join.** Friends log in with PayPal. Their verified PayPal email is stored as their payee address.
3. **Budget (optional).** Agent asks a few questions, proposes budget by category, group adjusts in chat.
4. **Log expenses.** In group chat: "Paid 84€ at Mercator, everyone except Ana" → agent creates expense, confirms split. Receipt photo → same.
5. **Track.** Dashboard shows spend vs budget, per-person paid/owed, live balances. Agent warns: "Food is 60€ over budget."
6. **Settle up.** Someone says "let's settle". Agent computes minimal transfers, each debtor sees "Pay Miha 42.50€" → PayPal checkout → money goes directly to Miha.
7. **Close.** Webhooks confirm captures, balances go to zero, agent nudges anyone left, trip closes.

## 6. Where the AI does real work

| Task | AI or code? |
|---|---|
| Parse messy messages / receipts into expenses + splits | **AI** (core value) |
| Ask clarifying questions when a split is ambiguous | **AI** |
| Propose budget from trip details | **AI** |
| Budget warnings and spending commentary | **AI** |
| Answer questions about the ledger | **AI** (with tools to query data) |
| Compute balances and minimal transfers | **Plain code**, exposed as an agent tool |
| Trigger settle-up, track status, nudge | **AI** orchestrating PayPal tools |

Keeping the math deterministic and letting the agent call it as a tool is deliberate: show judges we know where AI belongs and where it doesn't.

## 7. PayPal integration

- **Log In with PayPal:** identity + verified email used as payee for incoming settle-ups
- **Orders API v2 with custom payee:** each settle-up is an order where buyer = debtor, `purchase_units[].payee.email_address` = creditor. Called via REST (the agent toolkit `create_order` likely doesn't expose payee). **Must verify in sandbox first.**
- **JS SDK (v6):** approval button / checkout for debtor
- **Capture:** after approval
- **Webhooks:** e.g. `PAYMENT.CAPTURE.COMPLETED` to mark transfers paid. Handle duplicates (PayPal retries up to 25 times over 3 days). Respond 200 fast.
- **Agent tools (optional):** `get_order`, `list_transaction` so the agent can verify payment status itself
- **Fallback if custom payee fails:** group pot model (members pay into app merchant account, agent reimburses via Payouts REST API). Avoid unless forced.

## 8. Suggested stack

- **Frontend + backend:** Next.js (TypeScript)
- **DB:** Postgres (Render managed Postgres)
- **AI:** Claude API with tool use for the agent; vision for receipts
- **Dashboard:** AG Studio (AG Grid) for the dashboard widgets
- **Hosting:** Render (web service + Postgres; Workflows optional for background nudges)
- **Real-time chat:** start with polling or SSE; don't over-engineer
- **Local webhooks:** ngrok or Cloudflare Tunnel

### Rough data model
- `users` (id, paypal_user_id, name, paypal_email)
- `trips` (id, name, currency, created_by, status)
- `trip_members` (trip_id, user_id, role)
- `budgets` (trip_id, category, amount)
- `expenses` (id, trip_id, paid_by, amount, currency, category, description, receipt_url, created_at)
- `expense_splits` (expense_id, user_id, share_amount)
- `messages` (id, trip_id, user_id or agent, content, created_at)
- `settlements` (id, trip_id, from_user, to_user, amount, paypal_order_id, status: pending/approved/captured/failed)
- `webhook_events` (paypal_event_id unique, payload, processed_at) for idempotency

## 9. Agent design (sketch)

System role: the group's money assistant for one trip. Tools:
- `add_expense(paid_by, amount, category, description, split)`
- `update_expense(id, ...)`, `delete_expense(id)`
- `get_balances()`
- `get_budget_status()`
- `set_budget(category, amount)`
- `compute_settlement()` → list of transfers (deterministic code)
- `create_settlement_requests(transfers)` → creates PayPal orders with payee, returns approval links
- `get_settlement_status()`
- `send_nudge(user_id, message)`

Rules: always confirm parsed expenses back to the group in one short line; ask when payer, amount or split is unclear; never invent amounts.

## 10. Step 0: Sandbox spike (do first, decision gate)

Goal: prove the money flow works before building product code.

- [ ] Create PayPal developer account, sandbox app, note client ID + secret
- [ ] Create sandbox accounts: 1 business (app), 2+ personal (Ana, Miha)
- [ ] Install PayPal AI Toolkit (https://github.com/paypal/AI-Toolkit), token in `~/.claude/settings.json` env, run `/paypal:setup`
- [ ] Optional: APIMatic Context Plugin for PayPal API context
- [ ] **Test 1:** Log In with PayPal with a sandbox personal account, retrieve verified email
- [ ] **Test 2:** Create order with buyer = Ana, payee = Miha's sandbox email, approve as Ana, capture. Check Miha's sandbox balance increased.
- [ ] **Test 3:** Webhook endpoint (via tunnel) receives capture event, match it to the order
- [ ] Deploy hello world to Render

If Test 2 fails → ask on PayPal Discord, then fall back to group pot + Payouts.

## 11. Timeline

| Dates | Focus |
|---|---|
| Oct 28 to 29 | Sandbox spike, skeleton, Render deploy |
| Oct 30 to Nov 1 | Data model, group chat, agent parsing expenses |
| Nov 2 to 3 | Settlement engine, PayPal settle-up, webhooks |
| Nov 4 to 5 | AG Studio dashboard |
| Nov 6 to 7 | Budget proposal, receipts, nudges |
| Nov 8 to 9 | Polish, design pass, seeded demo trip, README + setup steps |
| Nov 10 to 11 | Demo video, Devpost story |
| Nov 12 | Buffer, submit well before 21:00 CET |

## 12. Partner integrations

- **AG Grid / AG Studio** (primary): dashboard. Their prize rewards polish (custom widgets, theming, layout) and use of the Studio Agent Framework. One of their suggested ideas is a friendly "who owes what" scoreboard, which matches us. PayPal boilerplate: https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate. 45-day free trial.
- **Render:** hosting, $50 credits. Workflows for background jobs (nudges, reconciliation).
- **APIMatic:** Context Plugin while coding (free, small subscription rewards).
- **Maybe later:** Zapier MCP for pushing nudges to WhatsApp/email.
- **Skipped:** Bryntum (itinerary out of scope), Channel3, KERNEL, Elastic, Astropods.

One partner done well beats three done thinly.

## 13. Demo video outline (under 3 min)

1. **Hook (0:00 to 0:20):** four friends back from a weekend in Piran, nobody knows who owes what.
2. **Chat (0:20 to 1:10):** messy messages and a receipt photo turn into a clean ledger; agent asks one clarifying question.
3. **Dashboard (1:10 to 1:40):** spend vs budget, balances, agent's overspend warning.
4. **Settle (1:40 to 2:30):** "let's settle" → 3 transfers → PayPal checkout → balances hit zero live via webhooks.
5. **Close (2:30 to 2:55):** money never touches the app; PayPal handles trust and protection; agent handles the boring parts.

## 14. Open questions

- Working name
- Does custom payee work for sandbox personal accounts? (spike)
- Currency handling: single currency per trip for MVP?
- How do invited members join: link + PayPal login only?
- Agent in group chat: responds to every message or only when mentioned?

## 15. Resources

- Hackathon: https://paypalaihackathon.devpost.com/
- Resources page: https://paypalaihackathon.devpost.com/resources
- PayPal developer docs: https://developer.paypal.com
- PayPal AI tools: https://developer.paypal.com/ai-tools/get-started
- Agent tools reference: https://developer.paypal.com/ai-tools/agent-tools/
- PayPal AI Toolkit (Claude Code plugin): https://github.com/paypal/AI-Toolkit
- PayPal Agent Toolkit: https://github.com/paypal/agent-toolkit
- LLM-friendly docs: https://developer.paypal.com/llms.txt
- Postman collection: https://postman.com/paypal
- AG Studio docs: https://www.ag-grid.com/studio/react/quick-start/
- Render credits: https://credits-portal-mmdm.onrender.com/claim/paypal-ai-hackathon
