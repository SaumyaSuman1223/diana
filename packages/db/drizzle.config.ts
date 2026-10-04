import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
  // Supabase owns anon/authenticated/service_role; never create or drop them.
  entities: { roles: { provider: "supabase" } },
  schemaFilter: ["public"],
  strict: true,
});
