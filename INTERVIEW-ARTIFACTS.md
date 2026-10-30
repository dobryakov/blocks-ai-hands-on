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
script and got the result back). Then — to demonstrate the network's actual point — I
built a **second agent, `order_intake`** (an online-shop order processor) whose handler
**calls the first agent over the network**, and ran a live **two-hop agent-to-agent chain**:
`order_intake → delivery_slot_estimator`. I kept a running friction log throughout:
**10 distinct friction points** distilled into **7 prioritized onboarding proposals**.
The two that matter most for day-one DevRel:
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
Two working agents I ran **live end-to-end** on Blocks Network (both private + free),
and a successful **two-hop agent-to-agent chain**: a consumer calls `order_intake`,
whose handler dispatches a *separate* network task to `delivery_slot_estimator` and
folds the delivery window back into a confirmed order. I could show the orchestrator
reporting "Asking delivery_slot_estimator…" and the estimator's own provider logging a
distinct completed task — concrete proof the call crossed the network. Plus a structured
friction log and seven fixes scoped to exactly this
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

The post draft now lives as its own paste-ready file (no markdown/asterisks):
**[`artifacts/linkedin-post-draft.md`](artifacts/linkedin-post-draft.md)**.

Angle: an enterprise architect doing due-diligence on a tool he's considering
bringing into the org for an internal agent-to-agent landscape — measured, not
hype, not a teardown; the employer is deliberately not named.

Note: the current draft is ~3,056 characters — slightly over LinkedIn's 3,000
limit — so it still needs a ~60–100 char trim (or a short feed cut) before posting.
Variants to consider: (a) tighten to a short feed post (hook + the two-agent PoC +
the one-line "reuse, don't rebuild" takeaway), moving the due-diligence list to the
comments; (b) add a 20-sec screen capture of the two providers + the live call as
proof; (c) when posting while interviewing, this evaluation voice is the safe
register — a builder's assessment, not a vendor review or a job pitch.
