-- 031_fix_rls_recursion_materials.sql
--
-- Second half of the 028-cycle fix (see 030_fix_rls_recursion.sql for the
-- teacher_groups ↔ teacher_group_members cycle).
--
-- Remaining cycle after 030 was:
--   materials SELECT
--     → materials_select_via_share
--     → EXISTS material_shares  (triggers material_shares SELECT)
--     → material_shares_select_owner_or_recipient
--         arm 1: EXISTS materials m WHERE m.teacher_id = get_teacher_profile_id()
--         ← materials SELECT  (loop)
--
-- Fix: introduce `is_material_owner(uuid)` SECURITY DEFINER helper and rewrite
-- all material_shares policies (SELECT/INSERT/DELETE) to use it.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_material_owner(p_material_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id = p_material_id
      AND m.teacher_id = public.get_teacher_profile_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_material_owner(uuid) TO authenticated;

DROP POLICY IF EXISTS material_shares_select_owner_or_recipient ON public.material_shares;
CREATE POLICY material_shares_select_owner_or_recipient ON public.material_shares
  FOR SELECT USING (
    public.is_material_owner(material_id)
    OR (target_type = 'student' AND target_id = auth.uid())
    OR (target_type = 'group' AND public.is_group_member(target_id))
    OR (target_type = 'homework' AND EXISTS (
          SELECT 1 FROM public.homework h
          WHERE h.id = material_shares.target_id
            AND h.student_id = auth.uid()
        ))
  );

DROP POLICY IF EXISTS material_shares_insert_owner ON public.material_shares;
CREATE POLICY material_shares_insert_owner ON public.material_shares
  FOR INSERT WITH CHECK (public.is_material_owner(material_id));

DROP POLICY IF EXISTS material_shares_delete_owner ON public.material_shares;
CREATE POLICY material_shares_delete_owner ON public.material_shares
  FOR DELETE USING (public.is_material_owner(material_id));

COMMIT;
