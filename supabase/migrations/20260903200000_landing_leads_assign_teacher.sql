-- Админ хочет назначать учителя прямо на анонимный лид с лендинга
-- (до регистрации ученика). Добавляем колонку assigned_teacher_id
-- (references profiles(id)); нулл — «не назначен».
--
-- Также расширяем допустимые статусы: 'assigned' появляется, когда
-- админ назначил учителя (чтобы не выпадать из фильтра списка).

ALTER TABLE landing_leads
    ADD COLUMN IF NOT EXISTS assigned_teacher_id UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE landing_leads
    DROP CONSTRAINT IF EXISTS landing_leads_status_check;

ALTER TABLE landing_leads
    ADD CONSTRAINT landing_leads_status_check
    CHECK (status IN ('new','contacted','assigned','archived'));

CREATE INDEX IF NOT EXISTS idx_landing_leads_assigned_teacher_id
    ON landing_leads(assigned_teacher_id);
