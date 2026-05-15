-- Синк auth.users.email_confirmed_at → public.profiles.email_verified.
-- Применено через MCP. Локальная копия для воспроизводимости.
--
-- Зачем: frontend хочет показывать verified-badge на аватарах. Прямой
-- запрос к auth.users из клиента запрещён, а делать batch lookup'ы
-- через admin client при каждом рендере списка — дорого. Дешевле —
-- одна boolean колонка в profiles, синкаемая триггером.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET email_verified = true
FROM auth.users u
WHERE u.id = p.id
  AND u.email_confirmed_at IS NOT NULL
  AND p.email_verified = false;

CREATE OR REPLACE FUNCTION public.sync_email_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
     OR (OLD.email_confirmed_at IS NOT NULL AND NEW.email_confirmed_at IS NULL) THEN
    UPDATE public.profiles
       SET email_verified = (NEW.email_confirmed_at IS NOT NULL)
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_email_verified ON auth.users;
CREATE TRIGGER trg_sync_email_verified
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_email_verified();

COMMENT ON COLUMN public.profiles.email_verified IS
'Синкается с auth.users.email_confirmed_at через trg_sync_email_verified.';
