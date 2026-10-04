# Diana

A self-hostable personal AI operating system. See [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Local setup

1. Node 24, pnpm, Docker (on WSL2: Docker Desktop → Settings → Resources → WSL integration).
2. `pnpm install`
3. `pnpm db:start`, then copy `.env.example` to `.env` and `apps/web/.env.local`, filling the
   publishable key from `pnpm exec supabase status`.
4. `pnpm db:migrate`
5. `pnpm dev` → http://localhost:3000. Sign-in emails appear in Mailpit at http://127.0.0.1:54324.
