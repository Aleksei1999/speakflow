-- 030_fix_rls_recursion.sql
--
-- Fixes the RLS cycle introduced in 028_material_shares.sql.
--
-- Cycle path (caused "infinite recursion detected in policy for relation
-- teacher_group_members" on ANY read from `materials`, because
-- `materials_select_via_share` transitively hits `teacher_group_members`):
--
--   materials_select_via_share
--     → EXISTS material_shares  (triggers material_shares SELECT policy)
--     → EXISTS teacher_group_members  (triggers tgm SELECT policy)
--     → EXISTS teacher_groups  (triggers teacher_groups SELECT policy)
--     → EXISTS teacher_group_members  ← cycle
--
-- Fix: use SECURITY DEFINER helpers that bypass RLS when checking
-- group ownership / membership from inside RLS expressions.

BEGIN;

-- 1. Helpers (SECURITY DEFINER → skip RLS on the internal read).

CREATE OR REPLACE FUNCTION public.is_group_owner(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_groups g
    WHERE g.id = p_group_id
      AND g.teacher_id = public.get_teacher_profile_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_group_members m
    WHERE m.group_id = p_group_id
      AND m.student_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated;

-- 2. teacher_groups — replace the policy that used a sub-select on
--    teacher_group_members (which itself has RLS).

DROP POLICY IF EXISTS teacher_groups_select_owner_or_member ON public.teacher_groups;
CREATE POLICY teacher_groups_select_owner_or_member ON public.teacher_groups
  FOR SELECT USING (
    teacher_id = public.get_teacher_profile_id()
    OR public.is_group_member(id)
  );

-- 3. teacher_group_members — replace policies that sub-selected from
--    teacher_groups (the other arm of the cycle).

DROP POLICY IF EXISTS teacher_group_members_select_owner_or_self ON public.teacher_group_members;
CREATE POLICY teacher_group_members_select_owner_or_self ON public.teacher_group_members
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_group_owner(group_id)
  );

DROP POLICY IF EXISTS teacher_group_members_insert_owner ON public.teacher_group_members;
CREATE POLICY teacher_group_members_insert_owner ON public.teacher_group_members
  FOR INSERT WITH CHECK (public.is_group_owner(group_id));

DROP POLICY IF EXISTS teacher_group_members_delete_owner ON public.teacher_group_members;
CREATE POLICY teacher_group_members_delete_owner ON public.teacher_group_members
  FOR DELETE USING (public.is_group_owner(group_id));

COMMIT;
