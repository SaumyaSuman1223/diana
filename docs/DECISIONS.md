# Architecture Decision Records

Short records of decisions that are expensive to reverse. Status: Accepted unless noted.
Add new records at the bottom; supersede rather than edit old ones.

---

## ADR-001 — Build in vertical slices, not horizontal phases

**Context.** SPEC §78 builds layer by layer; the core loop first closes around Phase 3–4, and
§74/§78 disagree with each other.
**Decision.** Follow [BUILD_PLAN.md](BUILD_PLAN.md): thin end-to-end slices, each used daily for a
week before the next is designed in detail.
**Consequence.** Some early code will be rewritten; that is cheaper than designing 50 tables up front.

## ADR-002 — Single-user accounts (L1) with sharing groundwork (L2)

**Decision.** Every account is private. No workspaces, shares, assignment or billing. Every owned
table carries `owner_id`; access is decided only by `app.can_read` / `app.can_write` (ADR-004).
Distribution is self-host + hosted copy with bring-your-own-key AI.
**Consequence.** Google OAuth apps are registered per deployment; the hosted copy stays under
Google's unverified-app user cap until verification is worth it.

## ADR-003 — No LangGraph, Temporal or full OpenTelemetry in V1

**Context.** SPEC lists all three for the MVP but also says not to add infrastructure before it is
needed (Appendix C #14). LangGraph and Temporal overlap on durable state.
**Decision.** Assistant = a tool-use loop with approvals persisted in Postgres. Jobs = pg-boss.
Tracing = `audit_logs` + structured logs. Revisit after V1 when a real workflow needs durability
across days.

## ADR-004 — Access control through two SQL functions

**Decision.** All RLS policies call `app.can_read(owner_id, project_id)` and
`app.can_write(owner_id, project_id)`. Today both mean `owner_id = auth.uid()`. The sharing unit
for a future L2 is the **project**, so rows that belong to a project pass its id.
**Consequence.** Adding shared projects = new `project_shares` table + changing two functions.
All AI retrieval must go through a single access-filtered function for the same reason.

## ADR-005 — Writes go through domain services; one transaction per change

**Decision.** UI, assistant, Telegram and worker all call domain services. Each service call runs in
`withUser(userId, tx => …)`, which sets `role authenticated` and JWT claims so RLS applies, and
writes the row change, an `audit_logs` row and a `domain_events` row atomically (transactional
outbox). Reads may use Supabase directly under RLS.
**Consequence.** No service-role key in request paths. The outbox dispatcher is the only
privileged component.

## ADR-006 — Not offline-first

**Decision.** The server is the source of truth. The only offline guarantee is that captures are
never lost: web queues them locally, Telegram queues them in its own client.
**Consequence.** Full offline tasks/notes (SPEC §62–63) would require a sync engine and is
explicitly out of scope.

## ADR-007 — Time and recurrence

**Decision.** All instants are `timestamptz`; each user has an IANA time zone in `profiles`.
All-day items store a `date`, not midnight UTC. Recurrence is stored as RFC 5545 RRULE plus
exception rows, expanded on read for a bounded window. Google recurring events keep their
series id and instance ids.

## ADR-008 — Deterministic scheduler; LLM interprets and explains

**Decision.** `packages/scheduler` is a pure function with no I/O. It uses heuristic scoring and
greedy placement (not "optimal"), respects pinned blocks, and re-plans with minimum change. It
reports infeasibility explicitly. The LLM only converts preferences into constraints and phrases
explanations from score components.

## ADR-009 — AI providers: free tier first, swappable, optional

**Decision.** Vercel AI SDK behind roles `fast`, `reasoning`, `embedding`. Default Gemini free tier
(Flash-Lite for `fast`, Flash for `reasoning`), Groq as fallback. Every AI feature has a non-AI
path. Embeddings store their model name so re-embedding is possible.
**Consequence.** Free tiers may use prompts for training. This is documented to users; switching to
a paid tier is configuration only.

## ADR-010 — Telegram first for mobile, PWA push in Slice 3

**Decision.** A Telegram bot (grammY, webhook, secret-token verified) provides mobile capture,
commands and two-way reminders from Slice 1. Linking uses a one-time code. PWA install and web
push follow in Slice 3 for users who do not want Telegram.
**Consequence.** Bot messages are not end-to-end encrypted; Telegram is opt-in per user.

## ADR-011 — Content trust labels

**Decision.** Every stored content item records whether it is `trusted` (typed by the owner) or
`untrusted` (external, forwarded, fetched, or authored by someone else). Untrusted content is
passed to models as quoted data and can never satisfy an approval or authorise a tool call.

## ADR-012 — Drizzle schema is the source of truth

**Decision.** Tables and RLS policies are defined in `packages/db` with Drizzle; `drizzle-kit`
generates SQL migrations. SQL that Drizzle cannot express (helper functions, triggers) goes in
custom migrations. The Supabase CLI runs the local stack only.
