-- Добавляем колонку price (в рублях, integer) для lectures — админ вводит
-- стоимость участия в форме «Другое событие».
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS price INT NOT NULL DEFAULT 0;
