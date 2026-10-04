import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { ownedPolicies, timestamps } from "./_shared";

/** Weekly working hours in the user's time zone, e.g. { mon: [["09:00", "18:00"]] }. */
export type WorkingHours = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [start: string, end: string][]>
>;

/** One row per auth user, created by a trigger on auth.users. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    /** IANA zone name (ADR-007). */
    timezone: text("timezone").notNull().default("UTC"),
    workingHours: jsonb("working_hours").$type<WorkingHours>().notNull().default({}),
    ...timestamps(),
  },
  (t) => ownedPolicies("profiles", t.id),
);
