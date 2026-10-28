# BeeQuits 🐝

**Be quits with your friends.** An AI agent for group trips: log expenses by chatting, track spend against a shared budget, and settle up with real PayPal payments sent directly between friends. The app keeps the ledger; PayPal moves the money. Money never touches the app.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Work in progress. See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for the full concept.

## Stack
Next.js (TypeScript) · Claude API (tool use + vision) · PayPal Orders v2, Log In with PayPal, webhooks · Channel3 product search · Postgres · Render

## Local setup
```bash
npm install
cp .env.example .env   # fill in PayPal sandbox credentials etc.
npm run dev
```

### Sandbox spike scripts
```bash
node --env-file=.env scripts/spike/paypal.mts create 42.50   # order paying SPIKE_PAYEE_EMAIL
node --env-file=.env scripts/spike/paypal.mts capture <orderId>
node --env-file=.env scripts/spike/login.mts                 # Log In with PayPal URL
node --env-file=.env scripts/spike/channel3.mts "ski helmet" 100
```

## License
[MIT](LICENSE)
