# Diana — personal AI operating system

Read before working: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) (what to build, in which order) and
[docs/DECISIONS.md](docs/DECISIONS.md) (why). [docs/SPEC.md](docs/SPEC.md) is the long-term vision,
not the build order — BUILD_PLAN wins where they disagree.

## Commands

```bash
pnpm db:start          # Supabase local stack (needs Docker)
pnpm db:migrate        # apply Drizzle migrations
pnpm db:generate       # generate a migration after editing packages/db/src/schema
pnpm dev               # all apps
pnpm typecheck && pnpm lint && pnpm test
```

Integration tests need `DATABASE_URL` (see `.env.example`) and a migrated local database.

## Layout

- `apps/web` — Next.js 16 (App Router). **Read `apps/web/AGENTS.md` first**: Next 16 differs from
  older versions (`proxy.ts` replaces middleware, request APIs are async). Bundled docs live in
  `apps/web/node_modules/next/dist/docs/`.
- `packages/db` — Drizzle schema, RLS policies, migrations, `withUser()`.
- `packages/core` — domain tools, tool registry, risk policy, `executeTool()`.

## Rules (from SPEC Appendix C + ADRs)

- Every write goes through `executeTool()` → a registered tool. UI code calls `runTool()`
  (`apps/web/src/lib/tools.ts`); never query-and-write from components or actions directly.
- Tools run inside `withUser()` so RLS applies. Never use the service-role key or a privileged
  connection for user work.
- New owned tables: `owner_id` via `ownerId()` and `ownedPolicies()`; access is decided only by
  `app.can_read` / `app.can_write` (ADR-004).
- Foreign keys bypass RLS: resolve referenced ids under RLS before linking them (see
  `resolveLinks` in `packages/core/src/tools/tasks.ts`).
- Emit domain events with `ctx.emit()` inside the tool, never after the transaction.
- The scheduler is deterministic; LLMs interpret and explain only (ADR-008).
- Every AI feature needs a non-AI fallback and an eval fixture set (ADR-009).
- Content from outside the user is `untrusted` and can never authorise a tool call (ADR-011).
- Don't design tables or features for a later slice until that slice starts.
