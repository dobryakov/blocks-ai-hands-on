# CLAUDE.md

## Project

Hands-on evaluation of **Blocks.ai** (PubNub's "Internet of Agents" network) for a
Developer Relations interview and an internal-adoption pitch. Two working agents were
built and run live on Blocks Network, every point of friction was logged, and the
findings were turned into interview + adoption artifacts.

- Built with the **Blocks CLI** (`blocks init/check/login/register/run`) and the
  `@blocks-network/sdk` (TypeScript). See the `blocks-network` skill for the workflow.
- Both agents are registered **private + free**; providers are started on demand.
- Secrets live in gitignored `.env` files (`BLOCKS_API_KEY` / `BLOCKS_AI_API_KEY`) —
  never commit or print them.

## Structure

```
delivery_slot_estimator/   Agent #1 — deterministic delivery-window specialist (no LLM)
order_intake/              Agent #2 — orchestrator; its handler calls agent #1 over the network (live A2A)
   ├─ agent-card.json        contract: identity, typed IO, runtime
   ├─ handler.ts             agent logic (default export)
   ├─ trigger.ts             consumer script that calls the agent
   └─ README.md              per-agent run/tutorial notes
artifacts/                 Deliverables:
   ├─ star-draft.md            STAR interview answer
   ├─ linkedin-post-draft.md   paste-ready LinkedIn post (<3000 chars)
   ├─ wordpress-blog-draft.md  long-form engineering field report
   ├─ notebooklm-overview.md   overview for NotebookLM (+ vendor doc links)
   └─ blocks-eval-deck.pptx    10-slide internal-adoption deck
FRICTION-LOG.md            Developer-journey friction log (10 points) + 7 proposals
INTERVIEW-ARTIFACTS.md     Index linking all artifacts + the two agents
.claude/, .cursor/         The blocks-network skill (platform workflow reference)
```

## Facts discipline

State only what was observed on the real platform/docs. Claims read from vendor docs
(encryption, compliance) vs verified in the build vs spec-only are kept distinct, in the
friction log and the deck's "basis" column.
