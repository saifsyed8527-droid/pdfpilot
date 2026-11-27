-- Only fixed-size HMAC buckets and expiring counters; no document data or raw IPs.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.import_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[a-f0-9]{64}$'),
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);
create index import_rate_limits_expiry on private.import_rate_limits (expires_at);
alter table private.import_rate_limits enable row level security;
revoke all on private.import_rate_limits from public, anon, authenticated, service_role;

create function public.consume_import_limit(bucket_key text, request_limit integer, window_seconds integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  used integer;
  expiry timestamptz;
begin
  if bucket_key is null or bucket_key !~ '^[a-f0-9]{64}$' or request_limit is null or request_limit not between 1 and 10000 or window_seconds is null or window_seconds not between 1 and 3600 then
    raise exception 'Invalid rate limit parameters' using errcode = '22023';
  end if;
  -- Bounded request-driven cleanup; no scheduler or background worker needed.
  delete from private.import_rate_limits where import_rate_limits.bucket_key in (
    select r.bucket_key from private.import_rate_limits r where r.expires_at < v_now order by r.expires_at limit 100 for update skip locked
  );
  insert into private.import_rate_limits as r (bucket_key, hits, expires_at)
  values (bucket_key, 1, v_now + make_interval(secs => window_seconds))
  on conflict on constraint import_rate_limits_pkey do update set
    hits = case when r.expires_at <= v_now then 1 else least(r.hits + 1, 10001) end,
    expires_at = case when r.expires_at <= v_now then v_now + make_interval(secs => window_seconds) else r.expires_at end
  returning hits, expires_at into used, expiry;
  return jsonb_build_object('allowed', used <= request_limit, 'retry_after', case when used <= request_limit then 0 else greatest(1, ceil(extract(epoch from expiry - v_now))::integer) end);
end;
$$;
revoke all on function public.consume_import_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_import_limit(text, integer, integer) to service_role;
