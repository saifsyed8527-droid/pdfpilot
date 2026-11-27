-- App migrations run as postgres. Existing objects and managed-role defaults are unchanged.
-- New API objects require explicit grants alongside their RLS policies.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
-- PUBLIC's built-in function grant is global; a schema-local REVOKE cannot remove it.
alter default privileges for role postgres
  revoke execute on functions from public;
