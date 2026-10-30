# order_intake — agent-to-agent demo on Blocks Network

An online-shop **order processor** that shows the point of an agent network:
it doesn't re-implement delivery logic — it discovers and **calls another
registered agent** (`delivery_slot_estimator`) over the network to attach a
promised delivery window.

```
  trigger.ts ──► order_intake ──(network task)──► delivery_slot_estimator
                     │                                    │
                     │ 1. validate order                  │ compute delivery window
                     │ 2. country → region, sum weight    │ return {min,max, dates}
                     │ 3. call estimator (ctx.taskClient) ◄┘
                     ▼
            confirmed order + delivery window
```

This is the orchestrator↔specialist pattern — the enterprise "make an agent
discoverable inside the org instead of rebuilding it" story.

## The agent-to-agent call

The handler uses the **`ctx.taskClient`** the runtime provides — you do **not**
build a `TaskClient` inside a handler:

```ts
const session = await ctx.taskClient.sendMessage({
  agentName: 'delivery_slot_estimator',
  ownerId: task.ownerId,
  requestParts: [{ partId: 'request', text: JSON.stringify({ region, weightKg, serviceTier }) }],
});
await session.waitForTerminal(20_000);
const [ref] = session.listArtifacts();
const bytes = ref.kind === 'inline' && ref.data
  ? decodeInlineArtifact(ref)
  : (await session.downloadArtifact(ref)).data;
const estimate = JSON.parse(new TextDecoder().decode(bytes));
await session.asyncClose();
```

## Input / output

**Input** (JSON string in the `request` part):
```json
{
  "orderId": "A-1042",
  "country": "PL",
  "items": [
    { "sku": "SOFA-3", "qty": 1, "weightKg": 48, "price": 899 },
    { "sku": "CUSHION", "qty": 2, "weightKg": 1.5, "price": 25 }
  ],
  "serviceTier": "standard"
}
```

**Output** (`application/json`):
```json
{
  "orderId": "A-1042",
  "region": "EU-East",
  "totalWeightKg": 51,
  "totalPrice": 949,
  "serviceTier": "standard",
  "estimatedDays": { "min": 4, "max": 7 },
  "deliveryWindow": { "earliest": "2026-11-03", "latest": "2026-11-06" },
  "estimatorNotes": ["Over 30 kg: palletised handling adds 1 day."],
  "status": "confirmed"
}
```

Country → region: `DE/FR/NL/BE/AT → EU-West`, `PL/CZ/HU/RO/BG/SK → EU-East`,
`RS/BA/ME/MK/AL/HR → Balkans`, else a conservative fallback.

## Run the full two-hop demo

`delivery_slot_estimator` must be registered too (it's the sibling project).

```bash
# one-time auth (see the repo root FRICTION-LOG for the headless/API-key path)
blocks login --network --write-env

# terminal 1 — the specialist
cd ../delivery_slot_estimator && blocks register && blocks run

# terminal 2 — the orchestrator
cd ../order_intake && blocks register && blocks run

# terminal 3 — send an order; order_intake will call the estimator for you
cd ../order_intake && npx tsx trigger.ts
```

You'll see `order_intake` report `Asking delivery_slot_estimator…`, and the
estimator's own provider log a **separate** completed task — proof the call
crossed the network rather than running locally.

> Keep `delivery_slot_estimator` **private** and grant access to your org to
> demo the enterprise "internal reuse" pattern; publish it public for an open
> marketplace demo.
