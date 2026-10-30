Title: Blocks.ai (PubNub) — an overview for a video presentation

Purpose of this document: a self-contained, factual source for NotebookLM to turn into a narrated video overview of Blocks.ai — what it is, how it works, what it's like to build on, and where it stands on security. It is written in plain declarative sentences so it narrates cleanly. It is based on a hands-on build on 2026-10-30 plus the vendor's own documentation (links at the end). Where a claim comes from the docs rather than from direct testing, the text says so.

==================================================
1. What Blocks.ai is
==================================================

Blocks.ai is a network for agent-to-agent communication, built by PubNub and launched in July 2026. PubNub describes it as the "control plane and network layer for AI agents" — the "Internet of Agents." Its job is the layer underneath the agents themselves: how an agent built by one team or company gets discovered, called, and governed by another, without everyone rebuilding the same connective plumbing.

A developer interacts with Blocks through a command-line tool (the Blocks CLI) and language SDKs for TypeScript (the default) and Python. Agents are described by a single file, the agent card, and run as small programs with a handler function. The public, multi-tenant deployment is called Blocks Network; large customers can also run their own single-tenant Blocks Enterprise deployment.

==================================================
2. The problem it addresses
==================================================

Writing an AI agent is now the easy part. The hard part at scale is coordination: discovery (how does one agent find another), invocation (how does it call it safely), presence (is it online), identity and access (who is allowed to call it), and an economy (free or paid access). Inside an enterprise, the recurring waste is every team rebuilding the same capability. Blocks' core promise is "register a capability once, reuse it everywhere," with agents private by default so this can happen inside an organization before anything is exposed publicly.

==================================================
3. How it works — architecture
==================================================

Blocks is built on PubNub's globally distributed, real-time messaging infrastructure. An agent opens a single outbound connection on port 443 and receives work over it; there are no inbound ports and no public endpoints on the agent side. Task dispatch, control messages, results, streamed events, and presence all travel over that one connection.

There are two kinds of task. A "request" task is one-shot: the handler runs, returns artifacts, and finishes. A "pipe" task is long-running and streaming, with an explicit duration from one minute up to thirty days; its handler loops until it is cancelled or expires.

Results can return inline inside the task message for small payloads. Larger file artifacts go to managed object storage through a short-lived pre-signed URL — the message connection carries the coordination, not the bytes. Task state, including inputs, status, intermediate results, and final output, is persisted in the platform database at every transition.

==================================================
4. The developer workflow
==================================================

The path from nothing to a running agent is short and linear:

- Install the CLI (npm global install).
- Scaffold a project with "blocks init", which creates the agent card, a handler, and a trigger script.
- Implement the handler and declare typed inputs and outputs in the agent card.
- Validate locally with "blocks check", which checks the card against its schema and confirms the handler exists.
- Authenticate with "blocks login" (browser OAuth, or an API key for headless and CI environments).
- Register the agent with "blocks register" — this lists it as private and free, the recommended first step.
- Start it with "blocks run", and call it with a trigger or consumer script.
- Later, "blocks publish" makes the agent public and/or paid.

==================================================
5. The hands-on proof — two agents and a live call
==================================================

To evaluate the platform honestly, two agents were built and run live on Blocks Network.

The first, "delivery_slot_estimator", is a deterministic specialist: given a region, parcel weight, and service tier, it returns a delivery window. It uses no language model, so the same input always yields the same output — the kind of agent another system can place in a critical path and trust.

The second, "order_intake", is an orchestrator. It validates an incoming online-shop order, derives the destination region and total weight from the line items, and then calls the delivery_slot_estimator agent over the network to attach a promised delivery window to a confirmed order.

Running the orchestrator produced a live two-hop agent-to-agent chain: a consumer called order_intake, whose handler dispatched a separate network task to delivery_slot_estimator and folded the result back. The proof that this was a real network call and not a local function was that the estimator's own process logged a completed task with a different task identifier from the inbound order task. Two processes, two tasks, one network call between them.

==================================================
6. Communication models
==================================================

Agent-to-agent is the primary model, and it is clean in code: a handler uses the task client the runtime provides to send a message to another agent, waits for the terminal event, and collects the returned artifact.

Human-to-agent communication is also supported, with a caveat. A human can drive an agent from a browser web app (scaffolded with "blocks init --mode webapp"), authenticating through an embedded auth widget or a backend that mints short-lived tokens, and can watch the agent's progress, artifacts, and streamed output in real time. The agent card can also declare streams as outbound, inbound, or bidirectional, which defines, at the protocol level, a path for a client to feed data into a running task. However, the documentation does not yet show a consumer-side method to write into an inbound or bidirectional stream, and there is no chat or turn-taking abstraction. So one-directional human-to-agent and agent-to-human exchange is first-class, while symmetric back-and-forth during a single task is defined in the spec but not documented end-to-end for a human client today. This communication detail is read from the docs, not independently tested.

==================================================
7. Security and data governance
==================================================

The security posture, as stated on the vendor's security page and architecture whitepaper:

- Connections use TLS on every hop with no plaintext fallback, and data is AES-256 encrypted at rest. The exact TLS version and cipher suites are not published.
- An agent can optionally require end-to-end encryption of task inputs and outputs, so that not even the operator can read them. This is a per-agent control.
- Agents are private by default. A private agent is reachable only by its owner and explicitly granted users or organizations; organization membership alone grants nothing.
- Tenant isolation applies on every point of presence, and an administrator can revoke an agent's channel access within seconds.
- For data residency, a customer can run dedicated instances on its own infrastructure; air-gapped networks are explicitly not supported.
- The security page displays compliance badges for SOC 2 Type II, SOC 3, HIPAA with BAA, GDPR, CCPA, and ISO/IEC 27001, and points to PubNub's Trust Center for attestations. Audit dates and scope are not shown on the page.

Items not confirmed in the public documentation, which a buyer should ask about directly: data retention and deletion periods, the TLS version and cipher baseline, the region in which shared-pool task data resides, the audit scope behind each compliance badge, and whether the platform analyzes or trains on payloads.

==================================================
8. Strengths and friction, from the build
==================================================

Strengths worth keeping:

- The developer path is short and linear.
- Error messages are often excellent; a headless login detected the environment and offered working alternatives.
- "blocks check" gives clear, per-line validation.
- Private-by-default and the reuse model map cleanly onto how an enterprise must adopt such a tool.

Friction worth fixing (all onboarding and documentation issues, not architecture):

- The first install command can fail on a managed machine where the global package directory is not user-writable; the documented fallback runs the same command and fails the same way.
- The agent card advertises typed JSON input and output, but the SDK has no JSON part helper, so structured data is hand-serialized as text; the input schema is also a restricted subset of JSON Schema whose limits are undocumented.
- A freshly scaffolded install reports several high-severity dependency vulnerabilities, and there is no published software bill of materials for enterprise review.
- How a deployed agent authenticates its outbound calls to other agents is not documented, which is the key question for production deployment.

==================================================
9. Who it is for
==================================================

Two audiences. Individual developers can build and register agents, call other agents, and optionally publish and monetize them on the public network. Enterprises can make agents discoverable and reusable inside the organization, private by default, with dedicated instances available for data-residency needs — the "do not rebuild the same agent five times" case.

==================================================
10. Key facts for quick reference
==================================================

- Vendor: PubNub. Product: Blocks.ai. Launched: July 2026.
- Tagline: control plane and network layer for AI agents; the "Internet of Agents."
- Interfaces: Blocks CLI, TypeScript SDK (default), Python SDK.
- Core object: the agent card (identity, task kinds, typed IO, runtime, streams).
- Task kinds: request (one-shot) and pipe (long-running, up to 30 days).
- Default registration: private and free. Publishing sets public and/or paid.
- Transport: PubNub messaging; one outbound connection on port 443; no inbound ports.
- Encryption: TLS in transit, AES-256 at rest, optional per-agent end-to-end encryption.
- Residency: dedicated instances on customer infrastructure; air-gapped not supported.

==================================================
11. Vendor documentation and sources
==================================================

Primary vendor sources (use these as the authoritative references):

- Blocks.ai home: https://blocks.ai/
- About: https://blocks.ai/about
- Security: https://blocks.ai/security
- Architecture / network whitepaper: https://blocks.ai/architecture/network-whitepaper
- Getting started guide: https://config.blocks.ai/GETSTARTED.md
- Agent card schema: https://config.blocks.ai/references/agent-card.schema.json
- Agent card reference: https://config.blocks.ai/references/agent-card-reference.md
- IO schema reference: https://config.blocks.ai/references/io-schema-reference.md
- Node (TypeScript) reference: https://config.blocks.ai/references/node-reference.md
- Python reference: https://config.blocks.ai/references/python-reference.md
- Agent development guide: https://config.blocks.ai/references/agent-development-guide.md

PubNub context:

- PubNub launch announcement: https://www.pubnub.com/blog/introducing-blocks-ai-control-plane-network-layer
- PubNub Trust Center (linked from the Blocks security page for compliance attestations).

Note for the presentation: this overview reflects the platform as observed on 2026-10-30. Pricing, compliance scope, and documentation evolve; treat the vendor sources above as current over this document where they differ.
