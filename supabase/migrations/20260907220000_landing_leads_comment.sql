-- Поле «комментарий» из модалки «Форма для связи» (Figma 2522:2375).
ALTER TABLE landing_leads ADD COLUMN IF NOT EXISTS comment TEXT;
