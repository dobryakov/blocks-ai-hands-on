# Interview artifacts — Blocks.ai DevRel round

Supporting material for the hiring-manager round. All claims below are from the
hands-on build on 2026-10-30; the raw evidence is in
[`FRICTION-LOG.md`](FRICTION-LOG.md) and the working agent in
[`delivery_slot_estimator/`](delivery_slot_estimator/).

---

## 1. STAR — "I connected an agent to Blocks, found the friction, proposed the fixes"

This is the answer to *"have you actually built on our platform?"* — the gap Rama
flagged twice. Keep it tight and concrete (her feedback: no apocalypse, no philosophy).

**Situation.**
Before the hiring-manager round I did what a brand-new developer does: I took
Blocks Network from discovery to a first working build myself — no slide decks,
no internal access, just the public CLI, SDK and docs. The goal was to feel the
self-service onboarding the way a dev evaluating Blocks on a Tuesday afternoon
would feel it.

**Task.**
Stand up a real agent end-to-end — scaffold, implement, validate, test, and get
it ready to register and call agent-to-agent — and log every point of friction
with enough specificity to turn each one into a fix. That *is* the DevRel job, so
I treated the exercise as the job.

**Action.**
I built `delivery_slot_estimator`, a small deterministic agent (delivery-window
estimator by region / weight / service tier — deliberately no LLM, so output is
reproducible and auditable, the kind of agent an enterprise order flow can
trust). I went `blocks init → edit card + handler → blocks check → offline test
→ login → register → run → agent-to-agent call`, took it **all the way live on the
real network** (registered private+free, ran the provider, called it from a consumer
script and got the result back), and kept a running friction log. I hit **9 distinct
friction points** and distilled them into **6 prioritized onboarding proposals**.
The two that matter most:
1. The **very first command** — `npm i -g @blocks-network/cli` — hard-fails with
   `EACCES` on a normal managed Linux box, and the official `install.sh` is
   literally the same command, so there's no working fallback. I worked around it
   with a user npm prefix and wrote the fix (ship a real installer + PATH
   persistence + an EACCES note).
2. A **gap between the agent card and the SDK**: the card advertises typed
   `application/json` IO with a JSON Schema, but the SDK has no `jsonPart` — you
   hand-serialize JSON into a text part and parse it back yourself, and the schema
   silently rejects standard keywords like `pattern` with no documented
   allowed-list. I proposed a `jsonPart`/`getJsonInput` pair and docs for the
   schema subset.
   I also flagged the good parts honestly — the headless-login error message is a
   model of how error UX should read, and `blocks check` gives clear per-line
   pass/fail.

**Result.**
A working agent that I ran **live end-to-end**: registered on Blocks Network
(private + free), provider online in ~3s, and a successful agent-to-agent call —
task created, progress event streamed back, correct JSON result artifact returned.
Plus a structured friction log and six fixes scoped to exactly this
role — install, the type contract, offline-test scaffolding, a headless-auth doc
path, and an enterprise "first 30 minutes" track. I can hand any of these to
engineering as a concrete ticket, and I can walk the hiring manager through the
build live. Net: I'm no longer talking about Blocks from the outside — I've
onboarded onto it, and I already have the enablement backlog a DevRel hire would
produce in week one.

**Bridge to the deeper credential (use if they push on scale).**
This maps onto what I did for ~5 years at enterprise scale: I built a messaging
bus across 4 countries / ~200 engineers / ~40 services, drove its adoption, then
layered AI and agent-to-agent spec negotiation on top of it — essentially Blocks'
category, inside one enterprise. So I've lived both sides: the individual-dev
onboarding I just did, and the enterprise "make agents discoverable internally
instead of rebuilding them" problem that is Blocks' harder sale.

---

## 2. LinkedIn post — draft (English)

> Draft only, for the advocacy voice. Honest, specific, optimistic — not a
> teardown. Publish decision is yours.

---

**I spent an afternoon building my first agent on Blocks Network. Here's the honest developer-journey report.**

Not from the outside, not from a deck — I installed the CLI, scaffolded an agent,
validated it, tested it, and walked the path a first-time developer walks:
`init → check → test → login → register → call`.

I built a tiny one on purpose: `delivery_slot_estimator`, a *deterministic*
delivery-window estimator (region + weight + service tier → a date range). No
LLM. Same input, same output — the kind of agent another agent can call and
actually trust inside an order flow.

What's genuinely good:
→ The journey shape is right — short, linear, no detours.
→ The error messages are the best part. When I tried to log in from a headless
box, it didn't hang or dump a stack trace — it detected the SSH session and
handed me two working alternatives. That's how error UX should read.
→ `blocks check` gives clear, per-line pass/fail on your agent card.

Where I hit friction (and this is the useful part):
→ The very first command tripped me up on a standard Linux machine. First
impressions are command #1 — that's the highest-leverage thing to smooth.
→ The agent card advertises typed JSON IO, but in code you still hand-serialize
it yourself. A small helper would close that gap and make the typed-contract
story real end-to-end.

I turned the whole run into a friction log and a short list of concrete fixes —
because the fastest way to grow a network of agents is to make the first one
effortless to ship.

If you're building on the Internet of Agents, I'd love to compare notes. And if
you've shipped an agent to a network like this — what tripped *you* up first?

#DeveloperExperience #AIAgents #BlocksNetwork #DevRel #MCP

---

*Variants to consider before posting: (a) lead with the deterministic-agent angle
for an enterprise audience; (b) add a 20-sec screen capture of `blocks check`
passing; (c) if posting while interviewing, keep the tone collaborative — "report
from a build," not "review of a vendor.")*
