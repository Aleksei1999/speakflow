# RLS test suite

Набор SQL-тестов для проверки Row-Level Security policies на основных таблицах
проекта и `storage.objects` (миграции 027/028/030/031/052/071/072).

Каждый файл — самостоятельная транзакция: `BEGIN; … assertions … ROLLBACK;`.
Если ассерт фейлится, `psql` прерывает выполнение с ошибкой
`fail X.Y: <причина>` и весь скрипт возвращает non-zero exit code.

## Что покрывает

| Файл              | Сценарии                                                                 |
|-------------------|--------------------------------------------------------------------------|
| `00_setup.sql`    | Создаёт 5 предсказуемых тестовых пользователей + 2 урока + 1 material    |
| `10_profiles.sql` | student видит свой / не видит чужой; admin видит всех                    |
| `20_lessons.sql`  | student/teacher видят только свои уроки; stranger пусто; admin всё       |
| `30_materials.sql`| owner + participant + share-recipient видят; stranger не видит           |
| `40_storage.sql`  | per bucket (avatars/teacher-materials/homework/lesson-recordings)        |
| `50_audit.sql`    | `audit.audit_log` виден ТОЛЬКО admin'у; anon/student/teacher — 0 строк   |
| `99_teardown.sql` | удаляет тестовых пользователей и привязанные строки                      |

Тесты не зависят от pgTAP (не установлен на текущем проекте). Если включить
расширение (`create extension pgtap;`) — можно постепенно переписывать ассерты
на `is()` / `ok()` для более читаемых отчётов.

## Как запускать

### Локально через `psql` к удалённой БД

```bash
# Используй CONNECTION STRING с правами postgres/owner — RLS-тесты
# SET LOCAL ROLE, что обычным юзерам недоступно.
PGURL="$(supabase status -o env | grep DB_URL | cut -d= -f2)"

psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/00_setup.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/10_profiles.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/20_lessons.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/30_materials.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/40_storage.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/50_audit.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/99_teardown.sql
```

Один shell-loop:
```bash
for f in supabase/tests/rls/*.sql; do
  echo "▶ $f"
  psql "$PGURL" -v ON_ERROR_STOP=1 -f "$f" || { echo "✗ $f"; break; }
done
```

### Через MCP `execute_sql`

Вставляйте содержимое каждого файла в `mcp__Supabase__execute_sql` в порядке
от `00_setup` до `99_teardown`. Tip: `00_setup` создаёт реальные строки в БД,
поэтому всегда заканчивайте прогон `99_teardown` (даже после провала).

### Локальный stack (рекомендовано для CI)

`supabase db reset` поднимает локальную копию с применёнными миграциями.
Дальше — `supabase test db` если включить pgTAP, либо вышеуказанный psql-loop.

## Ограничения

- Тесты в `BEGIN/ROLLBACK`, но `00_setup` НЕ обёрнут — он намеренно создаёт
  данные с тестовыми UUID'ами, чтобы остальные файлы могли тестировать RLS
  на видимых строках. Поэтому `99_teardown` обязателен.
- Storage-тесты используют **виртуальные** записи в `storage.objects` без
  реального blob'а — RLS проверяется по metadata. Это не покрывает реальные
  PUT/GET через storage API, но 100% покрывает policy expressions.
- Старые таблицы и колонки могут отличаться у форков — проверяйте
  `00_setup.sql` перед запуском, если БД сильно расходится с main.
- Тесты гоняют `SET LOCAL ROLE authenticated;` — требуют superuser/postgres
  подключения. Из обычного `anon` ключа их запустить нельзя.

## Дополнения которые ещё стоит написать

- `60_homework.sql` — RLS на `public.homework` (student/teacher/admin)
- `70_messages.sql` — RLS на чат уроков и support-тикеты
- `80_referrals.sql` — invite_code visibility
- `90_clubs.sql` — speaking_clubs + club_hosts видимость

В CI запускать на каждом PR, который трогает миграции или RLS policies.
