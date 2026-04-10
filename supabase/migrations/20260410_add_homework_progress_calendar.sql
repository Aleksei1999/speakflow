-- Homework assignments
CREATE TABLE IF NOT EXISTS homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  due_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'reviewed', 'overdue')),
  submission_text text,
  teacher_feedback text,
  grade integer CHECK (grade >= 0 AND grade <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Skill progress tracking (grammar, vocabulary, speaking, listening)
CREATE TABLE IF NOT EXISTS skill_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill text NOT NULL CHECK (skill IN ('grammar', 'vocabulary', 'speaking', 'listening')),
  percentage integer NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  target_level text DEFAULT 'B2',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, skill)
);

-- Calendar events (lessons, clubs, events)
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'lesson' CHECK (event_type IN ('lesson', 'speaking_club', 'workshop', 'challenge', 'other')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Lesson chat messages (for lesson room)
CREATE TABLE IF NOT EXISTS lesson_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Lesson notes
CREATE TABLE IF NOT EXISTS lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- Lesson materials
CREATE TABLE IF NOT EXISTS lesson_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_url text,
  content text,
  created_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_materials ENABLE ROW LEVEL SECURITY;

-- Homework: students see their own, teachers see their students'
CREATE POLICY "Students view own homework" ON homework FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Teachers view assigned homework" ON homework FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers create homework" ON homework FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers update homework" ON homework FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Students update own homework" ON homework FOR UPDATE USING (auth.uid() = student_id);

-- Skill progress: users see their own
CREATE POLICY "Users view own progress" ON skill_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON skill_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System inserts progress" ON skill_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Calendar: users see their own events
CREATE POLICY "Users view own events" ON calendar_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own events" ON calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Lesson messages: participants can read and write
CREATE POLICY "Lesson participants view messages" ON lesson_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM lessons WHERE lessons.id = lesson_id AND (lessons.student_id = auth.uid() OR lessons.teacher_id = auth.uid())));
CREATE POLICY "Lesson participants send messages" ON lesson_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM lessons WHERE lessons.id = lesson_id AND (lessons.student_id = auth.uid() OR lessons.teacher_id = auth.uid())));

-- Lesson notes: users manage their own
CREATE POLICY "Users manage own notes" ON lesson_notes FOR ALL USING (auth.uid() = user_id);

-- Lesson materials: teacher creates, both see
CREATE POLICY "Participants view materials" ON lesson_materials FOR SELECT
  USING (EXISTS (SELECT 1 FROM lessons WHERE lessons.id = lesson_id AND (lessons.student_id = auth.uid() OR lessons.teacher_id = auth.uid())));
CREATE POLICY "Teachers create materials" ON lesson_materials FOR INSERT WITH CHECK (auth.uid() = teacher_id);

-- Enable realtime for lesson messages
ALTER PUBLICATION supabase_realtime ADD TABLE lesson_messages;

-- Indexes
CREATE INDEX idx_homework_student ON homework(student_id);
CREATE INDEX idx_homework_teacher ON homework(teacher_id);
CREATE INDEX idx_skill_progress_user ON skill_progress(user_id);
CREATE INDEX idx_calendar_events_user ON calendar_events(user_id, starts_at);
CREATE INDEX idx_lesson_messages_lesson ON lesson_messages(lesson_id, created_at);
CREATE INDEX idx_lesson_notes_lesson ON lesson_notes(lesson_id, user_id);
