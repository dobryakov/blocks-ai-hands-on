# delivery_slot_estimator — a Blocks Network sample agent

A tiny, **deterministic** agent that estimates a delivery window for a retail /
furniture order from three inputs: destination region, parcel weight, and
service tier. No LLM, no external API — the same input always produces the same
output, so an upstream order-orchestration agent can trust the number instead of
re-validating a model's guess.

Built hands-on on the real Blocks Network as a worked example of the full
developer journey: `init → check → test → login → register → run → call`.
(The friction I hit along the way is logged in
[`../FRICTION-LOG.md`](../FRICTION-LOG.md).)

---

## What it does

**Input** (JSON — sent as the `text` of the `request` part; see note below):

```json
{ "region": "EU-East", "weightKg": 45, "serviceTier": "standard", "orderDate": "2026-10-30" }
```

| field | type | notes |
|-------|------|-------|
| `region` | `"EU-West" \| "EU-East" \| "Balkans"` | unknown regions fall back to a conservative window |
| `weightKg` | number | > 30 kg adds 1 day, > 100 kg adds 2 (freight handling) |
| `serviceTier` | `"standard" \| "express"` | express halves the lead time |
| `orderDate` | `YYYY-MM-DD` (optional) | defaults to today (UTC) |

**Output** (`application/json` artifact):

```json
{
  "region": "EU-East",
  "serviceTier": "standard",
  "weightKg": 45,
  "orderDate": "2026-10-30",
  "estimatedDays": { "min": 4, "max": 7 },
  "deliveryWindow": { "earliest": "2026-11-03", "latest": "2026-11-06" },
  "surchargeDays": 1,
  "notes": ["Over 30 kg: palletised handling adds 1 day."]
}
```

> **Note on JSON input.** The Blocks SDK has no `jsonPart` helper — parts are
> `{ partId, text }`. So the structured order is `JSON.stringify`'d into the
> `text` of the `request` part by the caller and `JSON.parse`'d back in the
> handler. The card still declares `application/json` + a JSON Schema so the
> dashboard can render an input form.

---

## Project layout

```
delivery_slot_estimator/
├── agent-card.json   # identity, IO schema, runtime (maxRunningTimeSec=30)
├── handler.ts        # the agent logic (default export)
├── trigger.ts        # consumer script: calls the agent and prints the result
├── package.json
└── .env              # BLOCKS_API_KEY (gitignored) — only for scripts run outside the CLI
```

## Prerequisites

- Node.js + npm. If `npm i -g @blocks-network/cli` fails with `EACCES`, use a
  user prefix (this is what I did):
  ```bash
  npm config set prefix ~/.npm-global
  export PATH="$HOME/.npm-global/bin:$PATH"   # add to ~/.bashrc to persist
  npm i -g @blocks-network/cli
  ```

## Run it

```bash
cd delivery_slot_estimator
npm install
blocks check            # validate agent-card.json + handler — should print "All checks passed."
```

### Test the handler offline (fastest inner loop — no auth, no network)

The handler is a plain function, so you can exercise it directly:

```bash
npx tsx -e '
import handler from "./handler.ts";
const task = { requestParts: [{ partId: "request", text: JSON.stringify({ region: "EU-West", weightKg: 120, serviceTier: "express" }) }] };
handler(task, { reportStatus: (m) => console.error(m) }).then(r => console.log(r.artifacts[0].data));
'
```

### Take it live (needs your Blocks account)

```bash
# 1. Authenticate (first time only). On a normal desktop:
blocks login --network --write-env
#    …or headless / CI / container — grab an API key from the dashboard:
#    blocks login --api-key-stdin --no-write-env   # paste key on stdin
#    (or: export BLOCKS_API_KEY=<key> and skip login entirely)

# 2. Register it — private and free (recommended first step)
blocks register

# 3. Start the agent (provider process)
blocks run

# 4. In another shell: call it (consumer / agent-to-agent path)
npx tsx trigger.ts
```

`trigger.ts` sends a sample order and prints the estimated delivery window.
It's also the template for calling this agent from *another* agent on the
network.

### Publish later (optional)

```bash
blocks publish --billing-mode free --listing public --accept-terms   # discoverable, free
```

Keep it private + free (just `blocks register`) while iterating. Re-running
`blocks register` resets a published agent back to private/free.
