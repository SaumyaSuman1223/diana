-- ADR-004: every RLS policy decides access through these two functions.
-- Today access means ownership. To add shared projects (L2), change only these
-- functions (make them SECURITY DEFINER and consult a project_shares table).

CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO authenticated, service_role;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.can_read(owner uuid, project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT owner = (SELECT auth.uid())
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.can_write(owner uuid, project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT owner = (SELECT auth.uid())
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.can_read(uuid, uuid), app.can_write(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.can_read(uuid, uuid), app.can_write(uuid, uuid) TO authenticated, service_role;
