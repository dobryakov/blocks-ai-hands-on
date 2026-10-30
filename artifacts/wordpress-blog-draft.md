Title: Building on Blocks Network — a hands-on field report on the "Internet of Agents"

Subtitle: Two agents, one live agent-to-agent call, and an honest engineering read for developers, DevOps, analysts and security teams.

---

Every team I work with is suddenly shipping AI agents. The agents are the easy part. The hard part — the part I spent years solving for ordinary services — is the layer underneath: how does an agent built by one team get **discovered, called, and governed** by another, without everyone rebuilding the same plumbing and without security signing off on a free-for-all?

Blocks Network (from PubNub) pitches itself as exactly that substrate — a network for agent-to-agent communication with routing, discovery, presence and an economy layer. So instead of reading the marketing, I built on it. This is a field report from taking it from `npm install` to a live two-agent call, written for the four people who actually have to approve this kind of thing: the developer, the DevOps/platform engineer, the analyst/architect, and the security reviewer.

Everything below is what I observed on the real platform on a Linux box (Node v20.19.5, Blocks CLI 1.0.24). Where I couldn't verify something, I say so.

## What I built

Two small agents, deliberately scoped so the *mechanics* are the subject, not the AI:

1. **`delivery_slot_estimator`** — a deterministic specialist. Given a region, parcel weight and service tier, it returns a delivery window. No LLM: same input, same output. That determinism is the point — it's the kind of agent another system can put in a critical path and trust.
2. **`order_intake`** — an orchestrator. It validates an incoming order, derives region and total weight from the line items, then **calls `delivery_slot_estimator` over the network** and folds the delivery window into a confirmed order.

That second agent is the whole reason a network like this exists: `order_intake` doesn't re-implement delivery logic — it *discovers and reuses* a capability another team could own.

## The developer view

The scaffold is clean. `blocks init <name> --yes --language node` produces three files — `agent-card.json`, `handler.ts`, `trigger.ts` — plus a `.env`. The agent card is the contract: identity, task kinds, typed IO, runtime limits.

A handler is just a function:

```typescript
export default async function handler(task, ctx) {
  const raw = task.requestParts?.[0]?.text;
  const input = JSON.parse(raw ?? "{}");
  // ...compute...
  return { artifacts: [{ data: JSON.stringify(result), mimeType: "application/json" }] };
}
```

Three things developers should know going in:

- **There is no `jsonPart` helper.** The card happily declares `contentType: "application/json"` with a JSON Schema, but the SDK's part helpers are `textPart`, `filePart`, `filePartFromPath` only. So "structured" input is really a JSON string you `stringify` on the way in and `parse` on the way out yourself. The typed-IO story the card advertises isn't first-class in code yet.
- **The card's input schema is a restricted subset of JSON Schema.** I added a perfectly valid `"pattern"` to a property and `blocks check` rejected it: `additionalProperties 'pattern' not allowed`. The error is specific and actionable (good), but the allowed-keyword list isn't documented — you discover the boundary by hitting it.
- **You can test a handler offline.** It's a plain function, so you can import it and call it with a mock task — no auth, no network, the fastest possible inner loop. This isn't in the quickstart, but it works and it's the first thing I'd tell a new developer.

The agent-to-agent call from inside a handler is genuinely nice once you know the shape — and the key detail is you use the `taskClient` the runtime hands you on `ctx`, you don't construct one:

```typescript
const session = await ctx.taskClient.sendMessage({
  agentName: "delivery_slot_estimator",
  ownerId: task.ownerId,
  requestParts: [{ partId: "request", text: JSON.stringify({ region, weightKg, serviceTier }) }],
});
await session.waitForTerminal(20_000);
const [ref] = session.listArtifacts();
const bytes = ref.kind === "inline" && ref.data
  ? decodeInlineArtifact(ref)
  : (await session.downloadArtifact(ref)).data;
const estimate = JSON.parse(new TextDecoder().decode(bytes));
await session.asyncClose();
```

## The DevOps view

This is where the first impression is weakest, and it's fixable.

**The very first command fails on a normal machine.** The documented install is `npm i -g @blocks-network/cli`. On any box where the global `node_modules` isn't user-writable — i.e. most managed/corporate Linux and anyone who installed Node from a distro package — it dies with `EACCES`. The official `install.sh` turns out to be *literally the same command*, so there is no working fallback, and its `export PATH="$HOME/.blocks/bin:$PATH"` line can't survive a `| sh` subshell anyway. My workaround:

```bash
npm config set prefix ~/.npm-global
export PATH="$HOME/.npm-global/bin:$PATH"   # persist in your shell rc
npm i -g @blocks-network/cli
```

**Headless/CI login, on the other hand, is handled well.** On an SSH session the browser login detected there was no local browser and returned two concrete alternatives — a device-style `--no-browser` flow, or a dashboard API key via `blocks login --api-key-stdin` / `export BLOCKS_API_KEY=...`. That's exactly what you need for containers and pipelines. The catch: this API-key path only appears *inside an error message*, not in the quickstart, so the best onboarding path for automated environments is effectively hidden.

**Reproducibility.** The scaffold pins `"@blocks-network/sdk": "latest"`. Two engineers scaffolding a week apart get different trees. Pin it.

**The open question for production: outbound auth.** Running a provider locally is one command (`blocks run`). But when `order_intake` calls another agent from its handler via `ctx.taskClient`, the docs never say where that outbound call's credentials come from — there's no `apiKey`/`baseUrl` on the context, and `BLOCKS_API_KEY` isn't in the SDK's documented env-var list. I ran my provider with both a logged-in CLI profile *and* `BLOCKS_API_KEY` in the environment, so I genuinely can't tell which one authenticated the sub-call. For anyone deploying an agent to a server or container, "what exactly do I provision so my agent can call another agent?" is the make-or-break question, and it needs a crisp answer.

## The analyst / architect view

The reuse model is the asset. Concretely, the flow I ran:

```
client ──► order_intake ──(network task)──► delivery_slot_estimator
                │                                   │
                │ validate, derive region+weight    │ compute window
                ▼                                    ▼
         confirmed order  ◄───────────── delivery window
```

One capability, registered once, called by another agent that knows nothing about its internals. That is the "stop building the fifth copy of the same thing" promise, and at enterprise scale that consolidation is where the money is. The economy/pricing and presence primitives exist (agents can be published free or paid, public or private); I only exercised the free/private path, so I won't speak to billing mechanics I didn't touch.

## The security view

This is the segment that will actually decide an enterprise rollout, and it's a mixed-but-promising picture.

- **Private by default is the right default.** `blocks register` lists an agent as **private and free**. A private agent is reachable only by its owner and by explicitly granted users/orgs — notably, *org membership alone grants nothing*; the owner has to grant their own organization. That's a defensible posture: you can stand an agent up and demo internal reuse without ever exposing it publicly. Making it public/paid is a separate, deliberate `blocks publish`.
- **Credential hygiene is on you, and the tooling helps.** The API key lives in `~/.config/blocks/contexts.json` or a project `.env`. The skill/docs are explicit: never hardcode, print, commit, or ship the key to browser code; browser apps must use a user-auth flow, not a provider key. The scaffold `.gitignore`s `.env`. Good defaults — but the `BLOCKS_API_KEY` env-var pattern for automation means key sprawl into CI secrets, so treat it like any other high-value token.
- **Dependency surface needs a story.** A freshly scaffolded project's `npm install` ends with **6 high-severity vulnerabilities** reported by npm. I did *not* verify whether those are in Blocks' own code or in transitive dependencies — but it doesn't matter for the optics: the first `npm install` your security team runs throws six highs, and there's no published SBOM or security page to hand them. For the enterprise buyer this is the single most important thing to get ahead of.
- **Data governance is better documented than the quickstart suggests** — it's just not where a developer lands. The public security page and the architecture whitepaper cover transport, encryption, isolation and residency. It's worth its own section, below.

## Data governance — the part security reads first

I went past the quickstart into the public security page and the architecture whitepaper. Here's what's actually stated — and what still isn't.

**Transport and connection model.** Blocks is built on PubNub's globally distributed messaging infrastructure. An agent opens **one outbound connection on port 443** and receives work over it — "no inbound ports, no public endpoints." For a security team that's a strong starting posture: no firewall holes, no listening sockets on your agents. Task dispatch, control messages, results, streamed events and presence all ride that one connection.

**Encryption.** The security page states **TLS on every connection, with no plaintext fallback**, and **AES-256 at rest**; the whitepaper adds "there is no plaintext path between any two components," and that an agent's connection access tokens **expire within seconds** and refresh silently. The exact TLS version and cipher suites aren't published. Notably, an agent **can require end-to-end encryption of task inputs and outputs "so not even the operator can read them"** — an optional, per-agent control (very likely the `consumerPublicKey` I saw on task messages in the SDK). For a sensitive-data use case, that E2E option is the single most important lever.

**Where the bytes actually go.** This lined up with something I hit in code. Small results come back inline in the task message; **file artifacts go to managed object storage via a short-lived pre-signed URL** — "the socket carries the coordination messages but not the bytes themselves." So large payloads transit object storage, not the message bus. **Task state** — input, status, current step, intermediate results, final output — is **persisted in the platform's database at every transition.** Good for auditability; worth noting that *intermediate* results are persisted too, not just the final answer.

**Isolation.** Tenant-isolation rules apply on every point-of-presence, and messages are visible only to subscribers authorized for that tenant's channels. Admins can **revoke an agent's channel-level access within seconds**, and streaming credentials are scoped to a single channel.

**Residency.** There's a path, not a blanket guarantee: a customer with residency requirements can **run dedicated instances on their own infrastructure**, with the platform routing some tasks to those and others to the shared pool. Traffic goes to the closest PoP and replicates across PoPs as needed; the docs don't state which region shared-pool task data lives in. **Air-gapped networks are explicitly not supported.**

**Compliance.** The security page shows badges for **SOC 2 Type II, SOC 3, HIPAA (with BAA), GDPR, CCPA and ISO/IEC 27001**, and points to PubNub's Trust Center for attestations — but audit dates, scope and certificates aren't on the page, and the launch press release's other claims (zero-trust, a 99.999% SLA) aren't substantiated there.

**Still unconfirmed — ask before procurement:** data-retention and deletion periods, the TLS version/cipher baseline, which region shared-pool task data resides in, the audit scope behind each compliance badge, and whether the platform analyzes or trains on payloads (the security page doesn't say; the only adjacent statement is the optional per-agent E2E control).

**Bottom line for security:** the architecture is defensible — outbound-only, TLS everywhere, per-tenant channel isolation, seconds-to-revoke credentials, optional end-to-end encryption, and a dedicated-instance escape hatch for residency. The gaps are documentation and attestation, not obvious design holes. I verified the connection posture and the inline-vs-object-storage artifact split against my own build; the encryption, isolation, residency and compliance claims are read from Blocks' own docs, not independently audited.

## Does it actually work? Yes — live.

I registered both agents (private, free), started both providers, and called `order_intake` with a sample order (a sofa + two cushions to Poland). The result came back confirmed, with the delivery window the estimator computed (EU-East, 51 kg, €949, window spanning early November).

The proof it was a real network hop and not a local function call: the estimator's own provider logged a **separate** completed task ID (`098e8916…`) distinct from the inbound order task (`356f4b70…`). Two processes, two tasks, one network call between them.

## Verdict

The primitive is real and the core value — register a capability once, reuse it everywhere, private by default — is exactly what the "every team is building agents" problem needs. The developer path is short and the error UX is, in places, excellent.

What I'd want closed before putting it in front of my teams:

1. **Install hardening** for managed machines (it's command #1).
2. **A crisp production outbound-auth story** — the thing that makes agent-to-agent actually deployable.
3. **A security surface** an infosec team can sign off on — pinned deps, a clean tree, an SBOM.

None of those are architecture problems; they're onboarding and documentation problems. Which, encouragingly, is the most fixable kind.

---

*Appendix — the full path I walked:*

```bash
npm i -g @blocks-network/cli         # (use a user prefix if EACCES)
blocks init my_agent --yes --language node
# edit agent-card.json + handler.ts
blocks check                         # validate card + handler
blocks login --api-key-stdin         # headless/CI: dashboard key on stdin
blocks register                      # private + free
blocks run                           # start the provider
npx tsx trigger.ts                   # call it (or let another agent call it)
```

---

*Sources for the governance section: the Blocks.ai security page (https://blocks.ai/security) and architecture whitepaper (https://blocks.ai/architecture/network-whitepaper), plus the official docs at config.blocks.ai. Everything else is from my own build on 2026-10-30; where a claim is read from docs rather than independently audited, the text says so.*
