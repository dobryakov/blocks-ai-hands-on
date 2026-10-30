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
- **[`FRICTION-LOG.md`](FRICTION-LOG.md)** — the full developer-journey friction
  log (10 points) + 7 onboarding proposals + the discovery→build summary.

## Working agents (proof of the build)

- **[`delivery_slot_estimator/`](delivery_slot_estimator/)** — deterministic
  delivery-window specialist; registered live (private + free).
- **[`order_intake/`](order_intake/)** — orchestrator whose handler calls the
  estimator over the network; ran a live two-hop agent-to-agent chain.
