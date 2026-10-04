# Diana — Build Plan

Source vision: [SPEC.md](SPEC.md). This document is the **authoritative build order**; where it
disagrees with the spec, this wins. Reasons for each deviation are in [DECISIONS.md](DECISIONS.md).

## Scope

- **Private accounts (L1) with sharing groundwork (L2).** Anyone can run or sign up; every account
  sees only its own data. Collaboration (shared projects) is not built, but the access model is
  shaped so it can be added by changing one SQL function (ADR-004).
- **Self-hostable + bring-your-own-key.** No billing, no Google app verification, no public SaaS
  obligations until real users ask for it.
- **Free/cheapest AI first**, behind a provider abstraction; the app is fully usable with AI off.

## Procedure: vertical slices

Each slice is usable end-to-end on its own. Every slice ends with **one week of real daily use**,
a written list of friction points, and an adjustment of the next slice. Nothing in a later slice is
designed in detail until that slice starts.

### Slice 0 — Spine (3–4 days)

- pnpm + Turborepo workspace, TypeScript strict, Vitest, lint, GitHub Actions CI
- Supabase local stack; Drizzle schema + migrations
- Core tables: `profiles`, `goals`, `projects`, `milestones`, `tasks`, `task_dependencies`,
  `captures`, `audit_logs`, `domain_events` — all with `owner_id` + RLS via `app.can_read/can_write`
- `packages/core`: domain services, typed tool registry (zod input, risk level 0–3), `withUser()`
  RLS-scoped transactions, audit + outbox written in the same transaction as the change
- Next.js app shell: magic-link auth, navigation (Today / Tasks / Projects / Calendar / Assistant /
  Settings), ⌘K palette skeleton

**Done when:** a signed-in user can create a task through a domain tool; the task, its audit row and
its `task.created` event commit atomically; a second user cannot read it (tested).

### Slice 1 — Capture → Today (~2 weeks)

- Capture box (web + ⌘K) → raw text saved to `captures` **before** any AI call
- AI parse (fast model, structured output) → typed draft: kind, fields, per-field confidence;
  low-confidence fields asked, never invented; plain-task fallback when AI is unavailable
- **Telegram bot**: account linking via one-time code, capture by text/forward, `/today`, `/now`
- Task & project lists (inbox, subtasks, dependencies, priorities, estimates, due dates)
- Today view + deterministic **"What should I do now?"** with explanation from score components
- `evals/capture`: fixture set of real captures → expected parse; run on demand against the model

**Done when:** you capture from your phone daily and "What now?" gives a defensible answer.

### Slice 2 — Real time (~2 weeks)

- `events` table: `timestamptz`, IANA tz, RRULE + exceptions (ADR-007)
- Google Calendar **read** sync (OAuth per user, incremental sync tokens, recurring series)
- Internal events, FullCalendar views
- Free-window computation (working hours − events − buffers) feeding "What now?"

**Done when:** Diana's calendar matches your Google Calendar and free time is correct across
recurring events and DST.

### Slice 3 — Plan + execute (~2–3 weeks)

- `packages/scheduler` (pure, no I/O): scoring, chunking (≥25 min), daily deep-work cap,
  dependency order, infeasibility report, pinned blocks, minimum-change re-plan (ADR-008)
- Daily plan: generate → explain → approve → `schedule_blocks` (optionally mirrored to a
  dedicated "Diana" Google calendar, never the primary one)
- Focus mode → `task_sessions` (actual durations, blocked reasons)
- Reminders: pg-boss worker; delivery via Telegram (with Done / Snooze buttons) and
  **PWA install + web push**

**Done when:** you plan tomorrow in under two minutes and the plan survives contact with the day.

### Slice 4 — Assistant (~2–3 weeks)

- Chat with streaming; tools exposed from the registry, filtered by permission
- Level 0–1 auto-execute; level ≥2 → `pending_actions` → approval card; audit viewer
- Task breakdown, project status ("what's blocking X?", "what remains?")
- BYOK: per-user provider keys, encrypted (Supabase Vault)
- `evals/agent`: tool choice, arguments, unnecessary actions

### Slice 5 — Remember (~2 weeks) — end of V1

- `memories` (semantic / episodic / procedural; candidate → active → superseded) + review UI
- pgvector; embeddings record their model; hybrid search (Postgres FTS + vector) in ⌘K
- Trust labels on all stored content; retrieved content never authorises tool calls

**V1 exit criteria:** daily use for 3+ consecutive weeks; correct answers to "What should I work on
now?", "Plan tomorrow", "What remains before <project> is done?", "What did I decide about X?".

### After V1 (ordered, re-evaluated after each)

1. Documents / PDF ingestion + RAG with citations (injection defenses land here)
2. Commitments + decision journal
3. Learning / exam planner, revision scheduling
4. Gmail read + draft (never auto-send), Calendar write
5. GitHub read → project activity
6. Automations on `domain_events` (trigger → conditions → actions)
7. Weekly review, proactive insights (with per-feature LLM budgets)
8. Only now evaluate LangGraph / Temporal, native mobile (Expo), desktop (Tauri)

## Architecture spine

```
 Web (server actions) ──┐
 Assistant (LLM loop) ──┼─→ Tool registry ─→ Policy ─→ [approval?] ─→ Domain service
 Telegram webhook ──────┤    zod + risk       perms      pending_action    │
 Worker (pg-boss) ──────┘                                                  ↓
                                         one transaction, RLS-scoped via withUser():
                                           row change + audit_logs + domain_events (outbox)
                                                                           │
                              worker polls outbox → reminders, embeddings, automations
```

- **Reads** may go directly to Postgres under RLS (including Realtime).
- **Writes** always go through domain services.
- The LLM never sees a database connection; it only calls tools.
- Server code never uses the service-role key for user work. Only the worker's outbox
  dispatcher is privileged, and it hands user work back to `withUser()`.

## Stack

| Concern | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Web | Next.js (App Router), React, Tailwind, shadcn/ui, cmdk, FullCalendar |
| DB / Auth / Storage | Supabase (Postgres, Auth, Storage, Vault, pgvector) |
| Data access | Drizzle ORM + postgres.js; schema in TS, migrations generated |
| Validation | zod |
| AI | Vercel AI SDK; roles `fast` / `reasoning` / `embedding`; Gemini free tier default, Groq fallback |
| Jobs | pg-boss in `apps/worker` |
| Telegram | grammY, webhook mode |
| Tests | Vitest; Playwright for a few E2E flows; `evals/` for AI behaviour |
| Hosting (own copy) | Vercel + Supabase Cloud + Railway/Fly for the worker |

## Repository layout

```
apps/web            Next.js UI, server actions, route handlers (chat, telegram webhook)
apps/worker         pg-boss: outbox dispatch, reminders, sync, cron
packages/db         Drizzle schema, RLS policies, migrations, withUser()
packages/core       domain services, tool registry, policy, audit, events
packages/scheduler  pure planning engine
packages/ai         model roles, context assembly, capture parser, prompts
evals/              fixtures + runners for AI behaviour
docs/               SPEC, BUILD_PLAN, DECISIONS
supabase/           local stack config
```

## Metrics (north-star proxies)

Days active per week · captures per day · capture correction rate · plan acceptance rate ·
plan adherence (blocks completed / planned) · estimate error trend · AI calls and cost per day.
