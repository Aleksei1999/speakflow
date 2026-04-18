-- Enable Supabase Realtime on public.lessons so clients can subscribe to
-- INSERT/UPDATE/DELETE events (booking by student, assigning by teacher,
-- cancellations, status transitions).
--
-- Note: REPLICA IDENTITY defaults to USING INDEX (primary key) on Supabase,
-- which is sufficient for DELETE payloads to include the id. If we need full
-- old-row payload for UPDATE/DELETE, set REPLICA IDENTITY FULL — but that
-- increases WAL volume. Stick with default for now.

ALTER PUBLICATION supabase_realtime ADD TABLE public.lessons;
