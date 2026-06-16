# Claude Code Subagents — Trading Platform + Business Suite

Seven specialized subagents covering the technical, business, and creative work of building a trading application as a software company. Drop the `.claude/agents/` folder into your project root and run `claude` from there.

## The agents at a glance

### Technical agents
| Agent | When it fires | Tools | Model |
|---|---|---|---|
| **`code-cleaner-refactorer`** | After AI-generated code dumps, before merging branches, when code is tangled or inconsistent. Hunts the specific anti-patterns AI assistants produce. | `Read, Edit, MultiEdit, Grep, Glob, Bash` | sonnet |
| **`frontend-stylist`** | Any new UI work — pages, components, layouts. Asks you for style preferences once, persists them, then stays consistent. | `Read, Write, Edit, MultiEdit, Bash, Grep, Glob, AskUserQuestion` | sonnet |
| **`production-coder`** | Default for any production code that isn't a throwaway script. Writes deployment-grade code with security and observability built in. | `Read, Write, Edit, MultiEdit, Bash, Grep, Glob` | opus |
| **`quant-trader-coder`** | Anything in `indicators/`, `strategies/`, `oms/`, `risk/`, `market_data/`, `llm_trader/`. Trader-mindset: fail closed, decimals not floats, no look-ahead, kill switch, idempotency. | `Read, Write, Edit, MultiEdit, Bash, Grep, Glob` | opus |
| **`ml-systems-engineer`** | ML/DL/LLM work — training, evaluation, RAG, fine-tuning, inference. Baseline-first, leakage-paranoid, evaluation-rigorous. | `Read, Write, Edit, MultiEdit, Bash, Grep, Glob` | opus |

### Business & creative agents
| Agent | When it fires | Tools | Model |
|---|---|---|---|
| **`business-strategist`** | Pricing, GTM, fundraising, positioning, build-vs-buy, when-to-pivot, "should I do X". Operator + investor + founder voice rolled into one. Pushes back on weak ideas. | `Read, Write, Grep, Glob, WebSearch, WebFetch` | opus |
| **`marketing-creative`** | Campaigns, scripts, ad copy, LinkedIn/X/TikTok content, taglines, launch plans, brand voice. Senior-creative-director voice — refuses to produce generic AI marketing slop. | `Read, Write, Edit, Grep, Glob, WebSearch, WebFetch` | opus |

## How they fit together

```
              ┌─────────────────────────────────────────────────┐
              │       Main Claude Code session (orchestrator)   │
              └─────────────────────────────────────────────────┘
                                      │
         ┌────────────────────────────┴────────────────────────────┐
         │                                                         │
         ▼                                                         ▼
   ┌──────────────────────────────┐              ┌─────────────────────────────────┐
   │   TECHNICAL                  │              │   BUSINESS & CREATIVE           │
   │                              │              │                                 │
   │   production-coder           │              │   business-strategist           │
   │   quant-trader-coder         │              │   ↳ pricing, GTM, fundraising,  │
   │   ml-systems-engineer        │              │     positioning, decisions      │
   │   frontend-stylist           │              │                                 │
   │   ↳ build the product        │              │   marketing-creative            │
   │                              │              │   ↳ launch plans, content,      │
   │   code-cleaner-refactorer    │              │     scripts, copy, voice        │
   │   ↳ clean it up              │              │                                 │
   └──────────────────────────────┘              └─────────────────────────────────┘
```

The technical agents build the product. The business and creative agents help you decide what to build, who to sell it to, what to charge, and how to launch it. They share the same codebase context — so the strategist can read your product code to understand what you actually have, and the marketing agent can read your landing page copy and stay consistent with it.

## Recommended workflow

1. **Start a feature** with the relevant builder (`production-coder`, `quant-trader-coder`, `ml-systems-engineer`, or `frontend-stylist`).
2. **Review with a fresh-context reviewer** — open a new Claude Code session and ask it to review the diff. Anthropic's docs explicitly recommend this: a fresh context catches what the writing-session is biased to miss.
3. **Clean up before merge** with `code-cleaner-refactorer` to strip scaffolding, consolidate duplication, and align style.

## Boundary rules between the agents

These are encoded in each agent's description, but worth being explicit:

**Technical**
- **`production-coder` vs `quant-trader-coder`**: production-coder handles app-layer code (auth, web framework, database, infra). quant-trader-coder handles anything where being wrong loses money — order path, risk, indicators, strategies, market data ingestion. When a file mixes both, the trader agent wins for the order-path bits, production-coder for the rest.
- **`quant-trader-coder` vs `ml-systems-engineer`**: ML-engineer handles model training, evaluation, and the training-side of LLM-trader logic. Trader-coder handles **how the model's output is converted to orders** — the deterministic, risk-checked translation layer. Don't let the ML engineer write the order-emission code; don't let the trader-coder set up the training loop.
- **`code-cleaner-refactorer`**: never the first agent on a task. It's the closing pass. It does not refactor architecture, change behavior, or fix bugs — it cleans.
- **`frontend-stylist`**: only frontend. Backend API design for endpoints the frontend calls is `production-coder`'s job.

**Business & creative**
- **`business-strategist` vs `marketing-creative`**: the strategist decides *what* to do (pricing, positioning, market entry, fundraising). The marketing agent decides *how to communicate* what's been decided. Don't ask the marketer "should I raise a seed round" or the strategist to "write me a viral LinkedIn thread" — they'll do it, but worse than each other.
- **Both can read your code, your landing pages, and your docs.** Useful: ask the strategist to read your `README.md` and product code, then assess positioning against actual capabilities. Ask the marketing agent to read existing site copy before writing new content so the voice stays consistent.

## Forcing a specific agent

If auto-routing picks the wrong agent, force one with `@agent-<name>`:

```
@agent-quant-trader-coder review the order state machine in oms/state.py
@agent-frontend-stylist build the positions table component
@agent-code-cleaner-refactorer clean up everything in src/strategies/ from today's commits
@agent-business-strategist should I raise a pre-seed or bootstrap this for another 6 months?
@agent-marketing-creative write a launch-day LinkedIn post for our beta release
```

## On first run of `frontend-stylist`

It will ask you 5 batched questions about aesthetic, color, density, typography, and component approach, then save your answers to `.claude/agent-memory/frontend-stylist/STYLE.md`. Edit that file directly any time to change preferences.

## On model choice

The trader, production, ML, business-strategist, and marketing-creative agents use `opus`. The first three because trading and ML mistakes are expensive enough that the model-cost differential is trivial against a single avoided incident. The latter two because business and creative judgment benefit most from the model's depth — bad strategic advice or generic marketing copy compound silently. The cleaner and frontend stylist use `sonnet` — they're high-volume and don't need the same depth.

## Adapting these to your codebase

Each agent assumes it can find the project's conventions by reading nearby files. The first time you use one, it'll often be slightly less precise — by the second or third use it will have learned the patterns (especially with `memory: project` enabled, as on `frontend-stylist`).

If an agent consistently makes a wrong assumption about your codebase, edit the relevant `.md` file directly to add a `## Project conventions` section. It's just a system prompt — there's no magic.
