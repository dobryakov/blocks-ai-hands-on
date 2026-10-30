# Interview artifacts — Blocks.ai DevRel round

Supporting material for the hiring-manager round. All claims are from the
hands-on build on 2026-10-30. Each artifact now lives as its own file.

## Artifacts

- **[`artifacts/star-draft.md`](artifacts/star-draft.md)** — STAR answer to "have
  you actually built on our platform?" (the two-agent live build, 10 friction
  points → 7 fixes, plus the enterprise-bus bridge).
- **[`artifacts/linkedin-post-draft.md`](artifacts/linkedin-post-draft.md)** —
  paste-ready LinkedIn post (no markdown): an enterprise architect's due-diligence
  on Blocks as the substrate for an internal agent-to-agent landscape. ~2,912
  chars, under LinkedIn's 3,000 limit.
- **[`artifacts/wordpress-blog-draft.md`](artifacts/wordpress-blog-draft.md)** —
  long-form engineering field report for developers, DevOps, analysts and security
  teams: the two-agent build, the live A2A call, and a discipline-by-discipline
  deep-dive (SDK, install/auth, reuse model, security surface).
- **[`artifacts/blocks-eval-deck.pptx`](artifacts/blocks-eval-deck.pptx)** — 10-slide
  PowerPoint for bringing the tool into the org: hybrid business + technical, neutral
  corporate style, honest footnotes on unverified claims (problem → what it is → how
  it works → live A2A proof → why it matters → security → friction → pilot → ask).
- **[`artifacts/notebooklm-overview.md`](artifacts/notebooklm-overview.md)** —
  self-contained factual overview for uploading to NotebookLM (to generate a video
  presentation); includes vendor documentation links.
- **[`FRICTION-LOG.md`](FRICTION-LOG.md)** — the full developer-journey friction
  log (10 points) + 7 onboarding proposals + the discovery→build summary.

## Working agents (proof of the build)

- **[`delivery_slot_estimator/`](delivery_slot_estimator/)** — deterministic
  delivery-window specialist; registered live (private + free).
- **[`order_intake/`](order_intake/)** — orchestrator whose handler calls the
  estimator over the network; ran a live two-hop agent-to-agent chain.
