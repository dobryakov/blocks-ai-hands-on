I've spent years building the integration backbone that lets services across an enterprise talk to each other. Now every team is spinning up AI agents — and they can't find or safely call each other. So I went looking for the substrate, and I've been digging into one. Here's my honest evaluation so far.

The hard problem at enterprise scale was never writing an agent. It's the layer underneath: how does an agent built by one team get discovered, called, and governed by another — without everyone rebuilding the same plumbing, and without security signing off on a free-for-all?

So instead of reading the marketing, I built a proof of concept on Blocks Network. Two small agents:
→ a deterministic specialist (delivery_slot_estimator) — no LLM, same input → same output, the kind of agent another system can actually trust;
→ an orchestrator (order_intake) whose handler calls the specialist over the network and folds the answer into its result.

I ran the full two-hop chain live — one agent dispatching a real task to another, confirmed by distinct task IDs. That's exactly the pattern I want internally: one team registers a capability once, every other team reuses it instead of rebuilding it. And critically, agents register private by default — discoverable inside your org via explicit grants, not exposed to the world. That's how an enterprise actually has to adopt this.

What already looks right for enterprise:
→ The reuse model — register once, grant internally, call from anywhere.
→ Private-first visibility, so this survives a first conversation with security.
→ Deterministic specialist agents you can put in a critical path with confidence.
→ A short developer path and genuinely good error UX — it even handled a headless/CI login gracefully, which matters for locked-down build boxes.

What I still need answered before I put it in front of my teams (due-diligence, not a complaint):
→ Install hardening — the first command assumes a developer-writable machine; on a managed corporate box it needs a cleaner path.
→ Production outbound auth — the in-handler "call another agent" API is clean, but how a deployed agent authenticates that call must be clear before anything ships to a server or container.
→ Security surface — dependency hygiene and an SBOM story, because our first review question won't be "does it work," it'll be "what are we pulling in."

Net: the primitive is real, and the internal-reuse story is the one I came for. I'm writing it up for my teams with a short list of what to validate next — because the win isn't one clever agent, it's not building the fifth copy of the same one.

If you're an architect or platform lead looking at agent networks for your org — what did your security and operations reviews actually get stuck on? That's what I most want to compare notes on.

#EnterpriseArchitecture #AIAgents #AgentToAgent #PlatformEngineering #InternetOfAgents
