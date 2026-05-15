// ============================================================
// Cache invalidation helpers
// ------------------------------------------------------------
// Thin wrappers around `revalidateTag` so call-sites don't have
// to know about tag naming conventions. Keeping the tag format
// in one file means renames stay consistent.
//
// Next.js 16 changed `revalidateTag` to require a profile arg
// (string profile name or `{ expire }` object). We pass the
// `'default'` profile — the cache entries themselves still
// honour their own `revalidate` TTL set in unstable_cache.
// ============================================================
import 'server-only'

import { revalidateTag } from 'next/cache'
import {
  profileTag,
  progressTag,
  teacherStatsTag,
  studentMaterialsTag,
  studentHomeworkTag,
  teacherStudentsTag,
  teacherClubsTag,
  teacherHomeworkTag,
  teacherMaterialsTag,
  adminTrialRequestsTag,
  adminStudentsTag,
  adminClubsTag,
  adminSupportTag,
  adminTeachersListTag,
} from './dashboard'
import { studentDashboardTag } from '@/lib/dashboard/student'
import { teacherDashboardTag } from '@/lib/dashboard/teacher'

const PROFILE = 'default'

function safeRevalidate(tag: string, label: string): void {
  try {
    revalidateTag(tag, PROFILE)
  } catch (err) {
    // revalidateTag should never throw in normal flow, but log defensively
    console.error(`[cache] revalidateTag ${label} failed`, err)
  }
}

/** Profile fields shown in the dashboard sidebar (full_name, avatar_url, role). */
export function invalidateProfile(userId: string): void {
  if (!userId) return
  safeRevalidate(profileTag(userId), 'profile')
}

/** Student gamification: total_xp, english_level, current_streak. */
export function invalidateUserProgress(userId: string): void {
  if (!userId) return
  safeRevalidate(progressTag(userId), 'progress')
}

/** Teacher hero stats: rating, total_reviews, experience_years. */
export function invalidateTeacherStats(userId: string): void {
  if (!userId) return
  safeRevalidate(teacherStatsTag(userId), 'teacher-stats')
}

/**
 * Student dashboard JSONB snapshot (миграция 073, RPC get_student_dashboard).
 * Включает profile/progress/stats/upcoming_lessons/achievements/leaderboard/
 * recent_xp_events/trial_request/referral. Триггерим на любую мутацию,
 * меняющую любое из этих полей у конкретного студента.
 */
export function invalidateStudentDashboard(userId: string): void {
  if (!userId) return
  safeRevalidate(studentDashboardTag(userId), 'student-dashboard')
}

/**
 * Teacher dashboard JSONB snapshot (миграция 074, RPC get_teacher_dashboard).
 * Включает profile/teacher_profile/today/upcoming/today_clubs/week_stats/
 * month_stats/active_lesson/club_hosts_unread/pending_trial_count.
 * Триггерим на любую мутацию, меняющую любое из этих полей у учителя:
 *  - booking create/cancel/teacher-create (today/upcoming/week/month/students)
 *  - admin clubs assign / club_hosts mutations (today_clubs/unread)
 *  - lesson recording finalize (status может стать completed → earnings/week)
 */
export function invalidateTeacherDashboard(userId: string): void {
  if (!userId) return
  safeRevalidate(teacherDashboardTag(userId), 'teacher-dashboard')
}

// ============================================================
// List-page invalidators
// ============================================================

/** Materials visible to a student (public + lessons + shares). */
export function invalidateStudentMaterials(userId: string): void {
  if (!userId) return
  safeRevalidate(studentMaterialsTag(userId), 'student-materials')
}

/** Homework rows belonging to a student. */
export function invalidateStudentHomework(userId: string): void {
  if (!userId) return
  safeRevalidate(studentHomeworkTag(userId), 'student-homework')
}

/** Aggregated students list for a teacher (derived from lessons). */
export function invalidateTeacherStudents(teacherUserId: string): void {
  if (!teacherUserId) return
  safeRevalidate(teacherStudentsTag(teacherUserId), 'teacher-students')
}

/** Speaking clubs where this teacher is a host. */
export function invalidateTeacherClubs(teacherUserId: string): void {
  if (!teacherUserId) return
  safeRevalidate(teacherClubsTag(teacherUserId), 'teacher-clubs')
}

/**
 * Homework rows assigned by a teacher.
 *
 * Reserved for future teacher-side homework cache loaders.
 * Already wired into mutation endpoints so the tag is consistent
 * if/when a `getCachedTeacherHomework` loader gets added.
 */
export function invalidateTeacherHomework(teacherUserId: string): void {
  if (!teacherUserId) return
  safeRevalidate(teacherHomeworkTag(teacherUserId), 'teacher-homework')
}

/**
 * Materials owned by a teacher (their personal library).
 *
 * Reserved for future teacher/materials cache loader.
 */
export function invalidateTeacherMaterials(teacherUserId: string): void {
  if (!teacherUserId) return
  safeRevalidate(teacherMaterialsTag(teacherUserId), 'teacher-materials')
}

/** Admin: teacher applications / trial requests global list. */
export function invalidateAdminTrialRequests(): void {
  safeRevalidate(adminTrialRequestsTag(), 'admin-trial-requests')
}

/** Admin: students global list. */
export function invalidateAdminStudents(): void {
  safeRevalidate(adminStudentsTag(), 'admin-students')
}

/** Admin: clubs global list. */
export function invalidateAdminClubs(): void {
  safeRevalidate(adminClubsTag(), 'admin-clubs')
}

/** Admin: support threads global list. */
export function invalidateAdminSupport(): void {
  safeRevalidate(adminSupportTag(), 'admin-support')
}

/** Admin: teachers dropdown source (used in admin/clubs UI etc). */
export function invalidateAdminTeachersList(): void {
  safeRevalidate(adminTeachersListTag(), 'admin-teachers-list')
}
