# Blocks Network — Developer Journey Friction Log

Hands-on walk from discovery → first successful build, by Grigoriy Dobryakov.
Date: 2026-10-30. Environment: Linux (Ubuntu), Node v20.19.5, npm 10.8.2, Python 3.12.3.
Everything below is what I actually observed on the real platform/CLI — not guesses.

Severity scale: 🔴 blocker · 🟠 real friction (cost me time) · 🟡 papercut · 🟢 positive (keep it)

---

## F1 — `npm i -g` is the only documented install path, and it fails on a normal machine 🟠
**Where:** GETSTARTED step 3 ("Install the CLI").
**What the docs say:**
```bash
npm i -g @blocks-network/cli
export PATH="$HOME/.blocks/bin:$PATH"
```
**What happened:** `npm i -g` fails with `EACCES: mkdir '/usr/lib/node_modules/@blocks-network'`
on any machine where the global node_modules isn't user-writable (i.e. most managed/corp
Linux boxes, and anyone who installed Node via the distro package manager rather than nvm).
This is the *very first command a new developer runs*. A hard failure here is the worst
possible place for one.
**Note:** The docs give a POSIX `install.sh` only for OpenBSD. There's no "if `-g` fails"
fallback for the 90% Linux/macOS case. The `export PATH=".../.blocks/bin"` line also implies
the installer puts binaries somewhere other than npm's global bin — the two install methods
aren't reconciled in the doc.
**Dug deeper:** I fetched `https://config.blocks.ai/install.sh` and it is *literally*:
```bash
#!/usr/bin/env bash
set -euo pipefail
npm i -g @blocks-network/cli
export PATH="$HOME/.blocks/bin:$PATH"
```
So the "alternative installer" runs the exact same `npm i -g` and fails identically. There is
no real fallback. Also note `export PATH` inside a piped `| sh` dies with the subshell — it
never reaches the user's shell, so even on success `blocks` isn't on PATH in a new terminal.
**Workaround I used:** set a user-writable npm prefix (`npm config set prefix ~/.npm-global`)
and reinstall, then add that bin dir to PATH. Worked.
**Fix idea:** Ship a real installer (download a prebuilt binary to `~/.blocks/bin`, or use a
user prefix), persist PATH to the shell rc, and add a one-line EACCES troubleshooting note.
This is the single highest-leverage onboarding fix — it's command #1. (see Proposals P1)

## F2 — `blocks login --write-env` vs `blocks login --network --write-env` inconsistency 🟡
**Where:** `blocks --help` and the `blocks init` "Next steps" both print `blocks login --write-env`;
GETSTARTED.md and the blocks-network skill say `blocks login --network --write-env`. A new dev
following the CLI's own output omits `--network`. On Blocks Network it happens to default
correctly, but the mismatch undermines trust in the docs and matters the moment someone has
also touched an Enterprise deployment (stale `BLOCKS_BACKEND_URL` in `.env`). One canonical
command, please.

## F3 — The card says `application/json` + JSON Schema, but the SDK has no JSON part 🟠
**Where:** generated `agent-card.json` (`io.inputs[0].contentType: "application/json"`, with a
`schema` object) vs the Node reference / SDK part helpers.
**What I found:** the only part helpers are `textPart`, `filePart`, `filePartFromPath`. There is
**no `jsonPart`**. A part is `{ partId, text }`. So to send the structured input the card
advertises, I have to `JSON.stringify` it into `.text` on the consumer side and `JSON.parse` it
back in the handler myself. The Node reference never shows parsing a JSON object out of a part,
and never explains whether/how the card's `io.inputs[].schema` validates the incoming payload or
only drives the dashboard form. So the card's typed-IO story and the SDK's string-part reality
are disconnected, and the dev has to guess the contract. For someone coming from a typed
enterprise message bus this is the first "wait, where did my types go?" moment.
**Fix idea:** add a `jsonPart(obj, partId?)` helper + a handler-side `getJsonInput(task, id)`
accessor, and document in the Node reference how `io.inputs[].schema` relates to parts (validated?
form-only?). (see Proposals P2)

## F4 — `io.inputs[].schema` is a restricted subset of JSON Schema, and the limits aren't documented 🟠
**Where:** `blocks check` on my card.
**What happened:** I added a perfectly valid JSON Schema `"pattern": "^\\d{4}-\\d{2}-\\d{2}$"`
to an input property. `blocks check` rejected it:
```
[FAIL] Schema: /io/inputs/0/schema/properties/orderDate — additionalProperties 'pattern' not allowed
```
So the input schema only accepts a whitelisted subset of JSON Schema keywords (`type`, `title`,
`enum`, `default`, `minimum`, … but not `pattern`). That's a reasonable product decision, but it
is **nowhere in the quickstart or the Node reference**, and the dev only discovers it by writing
standard JSON Schema and getting a failure. The error is at least specific and actionable (good),
but it should have been a documented allowed-keyword list up front. Removing `pattern` made
`blocks check` pass.
**Fix idea:** publish the allowed input-schema keyword list in the Agent Card reference and link
it from the `check` error. (see Proposals P2)

## F5 — `npm install` of the SDK reports 6 high-severity vulnerabilities 🟠
**Where:** `npm install` in a freshly scaffolded project.
**What happened:** the generated `package.json` pins `"@blocks-network/sdk": "latest"` and install
ends with `6 high severity vulnerabilities`. For an individual dev that's a shrug, but one of the
two adoption blockers for this product's *enterprise* segment is infosec / data-perimeter review —
and the very first `npm install` a security team runs throws 6 highs. That's a bad first
impression for exactly the buyer who is hardest to win. Also `"latest"` is non-reproducible: two
devs scaffolding a week apart get different trees. (Not verified whether the highs are in Blocks'
own code or transitive deps — stating only what npm reported.)
**Fix idea:** pin the SDK to an exact version in the scaffold, keep the transitive tree clean, and
publish an SBOM / security page for enterprise reviewers. (see Proposals P5)

## F6 — Headless/SSH login is handled gracefully 🟢 (keep this)
**Where:** `blocks login --network` in an SSH session.
**What happened:** instead of hanging or dumping a stack trace, the CLI detected there was no
local browser and returned a genuinely helpful message with two concrete fallbacks:
```
Run 'blocks login --no-browser' in an interactive terminal to log in from another device, or
authenticate without a browser using an API key from the dashboard:
  export BLOCKS_API_KEY=<key>
  blocks login --api-key-stdin --no-write-env
```
This is exactly how error UX should read: names the cause, gives the next command, offers an
alternative. It's also what unblocks CI / container / devcontainer onboarding. Note this
`BLOCKS_API_KEY`-from-dashboard path is NOT in GETSTARTED.md — the quickstart only shows the
browser `blocks login`. The best onboarding path for headless devs is hidden inside an error
message. Promote it into the docs. (see Proposals P4)

## F7 — The local-test story is implicit 🟡
**Where:** between `blocks check` and `blocks run`.
**What happened:** to prove my handler worked before touching the network, I imported `handler.ts`
and called it with a hand-built `StartTaskMessage` / `TaskContext`. It worked first try (good — the
handler signature is clean and `ctx` is optional). But nothing in the quickstart tells a dev they
can unit-test a handler this way; the documented loop is `blocks run` + `trigger.ts`, which both
need auth and a live task channel. A copy-pasteable "test your handler offline" snippet would let
devs iterate on logic with zero network and zero credentials — the fastest possible inner loop.
**Fix idea:** ship a `handler.test.ts` in the scaffold and a one-paragraph "offline testing"
doc section. (see Proposals P3)

---

# Developer-journey summary (discovery → first build)

| Step | Tool/doc | Result | Friction |
|------|----------|--------|----------|
| Discovery | GETSTARTED.md + skill | Clear, linear, correct order | — |
| Install CLI | `npm i -g` | **Failed (EACCES)**; worked via user prefix | F1 🟠 |
| Scaffold | `blocks init … --language node` | Clean, 3 files + .env, good "next steps" | 🟢 |
| Understand contract | Node reference | Found the card↔SDK gap (no jsonPart) | F3 🟠 |
| Edit card | `blocks check` | Caught restricted-subset schema clearly | F4 🟠 |
| Install deps | `npm install` | 6 high-severity vulns; `latest` pin | F5 🟠 |
| Validate | `blocks check` | Passed; clear per-line OK/FAIL output | 🟢 |
| Test offline | (self-rolled) | Handler works; path undocumented | F7 🟡 |
| Login | `blocks login --network` | Blocked (headless) but excellent fallback msg | F6 🟢 / F2 🟡 |
| Register/run/call | — | Needs dashboard API key (live, handed off) | — |

**Headline:** the *shape* of the journey is right — short, linear, `init → check → login →
register → run → call`, with genuinely good error messages at the two places I hit a wall
(headless login, schema validation). The friction is concentrated at the **very first command**
(install) and in the **card↔SDK type contract** (no jsonPart, undocumented schema subset). Fix
those two and the self-service path gets dramatically smoother — which is exactly the role's job.

---

# Proposals — onboarding / self-service improvements

Scoped to DevRel/enablement: remove friction, add sample agents & docs, serve both individual
devs and enterprise. Ordered by leverage.

### P1 — Make the first install command actually work (highest leverage) 🔴→🟢
Command #1 (`npm i -g`) hard-fails on most managed Linux/macOS boxes and the "installer" is the
same command. Ship a real installer that drops a prebuilt binary into `~/.blocks/bin`, persists
PATH to the shell rc, and falls back to a user npm prefix; add an EACCES troubleshooting line.
*Segment:* both. *Why it matters:* nothing else in onboarding matters if step 1 fails.

### P2 — Close the card↔SDK type gap
Add a `jsonPart(obj, partId?)` helper and a handler-side `getJsonInput(task, id)` accessor so the
typed IO the card advertises is first-class in code, not hand-rolled `JSON.stringify`/`parse`.
Document (a) how `io.inputs[].schema` relates to parts — validated or form-only — and (b) the
allowed JSON-Schema keyword subset, linked from the `blocks check` error. *Segment:* both; matters
most to devs coming from typed enterprise buses (the enterprise champion).

### P3 — Ship offline handler testing in the scaffold
Add `handler.test.ts` (import handler, mock `StartTaskMessage`/`TaskContext`, assert on the
artifact) plus an "offline testing" doc section. Gives the fastest inner loop — iterate on logic
with no auth, no network. *Segment:* both; great sample-agent teaching moment.

### P4 — Promote the headless / API-key auth path into the docs
The `BLOCKS_API_KEY` dashboard-key flow only appears inside a login *error* message. Put it in
GETSTARTED as the "CI / container / no-browser" path. Unblocks devcontainers, CI, and any
enterprise box without a desktop browser. *Segment:* enterprise especially.

### P5 — An enterprise "first 30 minutes" track
Enterprise adoption is blocked by infosec and "we'll build it in-house." Give that buyer a
dedicated path: pin the SDK to exact versions + clean the dep tree (6 highs on first install is a
bad look), publish an SBOM / security page, and ship one **enterprise sample agent** that shows an
agent made discoverable *inside* an org (private registration + org grant) rather than built
from scratch — the exact "don't reinvent the wheel" story. *Segment:* enterprise. My
`delivery_slot_estimator` is a seed for this: deterministic, private-by-default, auditable output.

