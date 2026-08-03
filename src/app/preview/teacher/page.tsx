// Preview-роут без Supabase, чтобы просматривать /teacher дизайн
// пока Supabase не поднят. Никакой авторизации, только визуал.
import TeacherRawDashboard from "@/app/(dashboard)/teacher/new/TeacherRawDashboard"

export const dynamic = "force-static"

export default function TeacherPreviewPage() {
  return <TeacherRawDashboard />
}
