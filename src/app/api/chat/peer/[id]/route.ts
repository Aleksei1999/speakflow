import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET /api/chat/peer/[id] — публичный (для авторизованного) профиль
// собеседника в чате. Возвращает только те поля, которые уместно показать:
// имя, аватар, роль, город, uv-мета (english_level, hourly_rate) — без
// приватных полей типа phone / email (их пока не показываем).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: prof, error } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, first_name, last_name, avatar_url, role, city, timezone, occupation, english_goal, interests, created_at")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!prof) return NextResponse.json({ error: "not found" }, { status: 404 })

  let englishLevel: string | null = null
  let teacher: {
    bio: string | null
    education: string | null
    experienceYears: number | null
    hourlyRate: number
    rating: number
    totalLessons: number
    specializations: string[]
    languages: string[]
  } | null = null

  if (prof.role === "student") {
    const { data: pr } = await (supabase as any)
      .from("user_progress")
      .select("english_level")
      .eq("user_id", id)
      .maybeSingle()
    englishLevel = pr?.english_level ?? null
  } else if (prof.role === "teacher") {
    const { data: tp } = await (supabase as any)
      .from("teacher_profiles")
      .select("bio, education, experience_years, hourly_rate, rating, total_lessons, specializations, languages")
      .eq("user_id", id)
      .maybeSingle()
    if (tp) {
      teacher = {
        bio: tp.bio,
        education: tp.education,
        experienceYears: tp.experience_years,
        hourlyRate: tp.hourly_rate,
        rating: tp.rating,
        totalLessons: tp.total_lessons,
        specializations: tp.specializations ?? [],
        languages: tp.languages ?? [],
      }
    }
  }

  return NextResponse.json({
    profile: {
      id: prof.id,
      fullName: prof.full_name,
      firstName: prof.first_name,
      lastName: prof.last_name,
      avatarUrl: prof.avatar_url,
      role: prof.role,
      city: prof.city,
      timezone: prof.timezone,
      occupation: prof.occupation,
      englishGoal: prof.english_goal,
      interests: prof.interests ?? [],
      createdAt: prof.created_at,
      englishLevel,
      teacher,
    },
  })
}
