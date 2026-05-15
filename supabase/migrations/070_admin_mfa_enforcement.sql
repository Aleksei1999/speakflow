-- 070_admin_mfa_enforcement.sql
-- Adds public.admin_has_mfa() — SECURITY DEFINER RPC that checks whether the
-- currently authenticated user has at least one VERIFIED TOTP factor.
--
-- Soft-enforce strategy:
--   1) Deploy this RPC + enrollment UI in /admin/settings.
--   2) Admins enroll TOTP at their leisure.
--   3) Flip ENABLE_ADMIN_MFA_ENFORCE='1' on Vercel — middleware will then
--      redirect /admin/* → /student/settings?mfa=required for any admin
--      without a verified factor. NOT a hard logout — same session, just
--      a forced detour to the enrollment screen.
--
-- The RPC intentionally does NOT check role inside — it answers a single
-- narrow question ("does this user have a verified TOTP factor?") so it
-- can be reused by future teacher/student MFA flows without changes.

create or replace function public.admin_has_mfa()
returns boolean
language plpgsql
security definer
-- Lock search_path to the schemas we actually use. auth.mfa_factors lives
-- in `auth`; everything else is `public`/`pg_catalog`.
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_has boolean;
begin
  -- Unauthenticated callers can never have MFA.
  if v_uid is null then
    return false;
  end if;

  select exists (
    select 1
    from auth.mfa_factors f
    where f.user_id = v_uid
      and f.factor_type = 'totp'
      and f.status = 'verified'
  ) into v_has;

  return coalesce(v_has, false);
end;
$$;

-- Tighten privileges: SECURITY DEFINER + revoke PUBLIC so it can only be
-- called via the explicit GRANT.
revoke all on function public.admin_has_mfa() from public;
grant execute on function public.admin_has_mfa() to authenticated;

comment on function public.admin_has_mfa() is
  'Returns true if auth.uid() has at least one verified TOTP factor in auth.mfa_factors. '
  'Used by Next.js middleware to soft-enforce MFA for admin routes when '
  'ENABLE_ADMIN_MFA_ENFORCE=1. Reusable across roles — does not gate on role itself.';
