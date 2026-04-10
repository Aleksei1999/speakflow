export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; email: string; full_name: string; avatar_url: string | null
          role: 'student' | 'teacher' | 'admin'; phone: string | null
          telegram_chat_id: number | null; telegram_username: string | null
          timezone: string; is_active: boolean; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; email: string; full_name: string }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      teacher_profiles: {
        Row: {
          id: string; user_id: string; bio: string | null; specializations: string[]
          experience_years: number; hourly_rate: number; trial_rate: number | null
          languages: string[]; education: string | null; certificates: string[]
          video_intro_url: string | null; rating: number; total_reviews: number
          total_lessons: number; is_verified: boolean; is_listed: boolean
          created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['teacher_profiles']['Row']> & { user_id: string; hourly_rate: number }
        Update: Partial<Database['public']['Tables']['teacher_profiles']['Row']>
      }
      teacher_availability: {
        Row: {
          id: string; teacher_id: string; day_of_week: number
          start_time: string; end_time: string
          is_active: boolean; created_at: string
        }
        Insert: Partial<Database['public']['Tables']['teacher_availability']['Row']> & { teacher_id: string; day_of_week: number; start_time: string; end_time: string }
        Update: Partial<Database['public']['Tables']['teacher_availability']['Row']>
      }
      lessons: {
        Row: {
          id: string; student_id: string; teacher_id: string; scheduled_at: string
          duration_minutes: number; status: 'pending_payment' | 'booked' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
          jitsi_room_name: string | null; price: number; cancelled_by: string | null
          cancellation_reason: string | null; teacher_notes: string | null
          created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['lessons']['Row']> & { student_id: string; teacher_id: string; scheduled_at: string; price: number }
        Update: Partial<Database['public']['Tables']['lessons']['Row']>
      }
      payments: {
        Row: {
          id: string; lesson_id: string; student_id: string
          yookassa_payment_id: string | null; amount: number; currency: string
          status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'cancelled' | 'refunded'
          payment_method: string | null; paid_at: string | null; refunded_at: string | null
          metadata: Json; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['payments']['Row']> & { lesson_id: string; student_id: string; amount: number }
        Update: Partial<Database['public']['Tables']['payments']['Row']>
      }
      teacher_earnings: {
        Row: {
          id: string; teacher_id: string; lesson_id: string; payment_id: string
          gross_amount: number; platform_fee: number; net_amount: number
          status: 'pending' | 'available' | 'paid_out' | 'cancelled'
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['teacher_earnings']['Row']> & { teacher_id: string; lesson_id: string; payment_id: string; gross_amount: number; platform_fee: number; net_amount: number }
        Update: Partial<Database['public']['Tables']['teacher_earnings']['Row']>
      }
      lesson_summaries: {
        Row: {
          id: string; lesson_id: string; student_id: string; teacher_id: string
          teacher_input: string | null; summary_text: string
          vocabulary: string[] | null; grammar_points: string[] | null
          homework: string | null; strengths: string[] | null; areas_to_improve: string[] | null
          ai_model: string | null; tokens_used: number | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['lesson_summaries']['Row']> & { lesson_id: string; student_id: string; teacher_id: string; summary_text: string }
        Update: Partial<Database['public']['Tables']['lesson_summaries']['Row']>
      }
      reviews: {
        Row: {
          id: string; lesson_id: string; student_id: string; teacher_id: string
          rating: number; comment: string | null; is_visible: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['reviews']['Row']> & { lesson_id: string; student_id: string; teacher_id: string; rating: number }
        Update: Partial<Database['public']['Tables']['reviews']['Row']>
      }
      level_tests: {
        Row: {
          id: string; user_id: string | null; email: string | null
          answers: Json; score: number; level: string
          completed_at: string
        }
        Insert: Partial<Database['public']['Tables']['level_tests']['Row']> & { answers: Json; score: number; level: string }
        Update: Partial<Database['public']['Tables']['level_tests']['Row']>
      }
      achievement_definitions: {
        Row: {
          id: string; slug: string; title: string; description: string
          icon_url: string | null; category: string; threshold: number
          xp_reward: number; sort_order: number; created_at: string
        }
        Insert: Partial<Database['public']['Tables']['achievement_definitions']['Row']> & { slug: string; title: string; description: string }
        Update: Partial<Database['public']['Tables']['achievement_definitions']['Row']>
      }
      user_achievements: {
        Row: {
          id: string; user_id: string; achievement_id: string
          earned_at: string
        }
        Insert: Partial<Database['public']['Tables']['user_achievements']['Row']> & { user_id: string; achievement_id: string }
        Update: Partial<Database['public']['Tables']['user_achievements']['Row']>
      }
      user_progress: {
        Row: {
          id: string; user_id: string; total_xp: number; current_level: number
          lessons_completed: number; current_streak: number; longest_streak: number
          last_lesson_date: string | null; english_level: string | null; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['user_progress']['Row']> & { user_id: string }
        Update: Partial<Database['public']['Tables']['user_progress']['Row']>
      }
      materials: {
        Row: {
          id: string; teacher_id: string; lesson_id: string | null
          title: string; description: string | null; file_url: string
          file_type: string | null; file_size: number | null
          is_public: boolean; created_at: string
        }
        Insert: Partial<Database['public']['Tables']['materials']['Row']> & { teacher_id: string; title: string; file_url: string }
        Update: Partial<Database['public']['Tables']['materials']['Row']>
      }
      notifications: {
        Row: {
          id: string; user_id: string; type: string
          channel: 'email' | 'telegram' | 'in_app'
          title: string; body: string; metadata: Json
          is_read: boolean; sent_at: string
        }
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & { user_id: string; type: string; channel: 'email' | 'telegram' | 'in_app'; title: string; body: string }
        Update: Partial<Database['public']['Tables']['notifications']['Row']>
      }
      telegram_linking_codes: {
        Row: {
          id: string; user_id: string; code: string
          expires_at: string; used: boolean; created_at: string
        }
        Insert: Partial<Database['public']['Tables']['telegram_linking_codes']['Row']> & { user_id: string; code: string; expires_at: string }
        Update: Partial<Database['public']['Tables']['telegram_linking_codes']['Row']>
      }
      homework: {
        Row: {
          id: string; student_id: string; teacher_id: string; lesson_id: string | null
          title: string; description: string | null; due_date: string
          status: 'pending' | 'in_progress' | 'submitted' | 'reviewed' | 'overdue'
          submission_text: string | null; teacher_feedback: string | null
          grade: number | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['homework']['Row']> & { student_id: string; teacher_id: string; title: string; due_date: string }
        Update: Partial<Database['public']['Tables']['homework']['Row']>
      }
      skill_progress: {
        Row: {
          id: string; user_id: string
          skill: 'grammar' | 'vocabulary' | 'speaking' | 'listening'
          percentage: number; target_level: string | null; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['skill_progress']['Row']> & { user_id: string; skill: 'grammar' | 'vocabulary' | 'speaking' | 'listening' }
        Update: Partial<Database['public']['Tables']['skill_progress']['Row']>
      }
      calendar_events: {
        Row: {
          id: string; user_id: string; title: string
          event_type: 'lesson' | 'speaking_club' | 'workshop' | 'challenge' | 'other'
          starts_at: string; ends_at: string; lesson_id: string | null
          metadata: Json; created_at: string
        }
        Insert: Partial<Database['public']['Tables']['calendar_events']['Row']> & { user_id: string; title: string; starts_at: string; ends_at: string }
        Update: Partial<Database['public']['Tables']['calendar_events']['Row']>
      }
      lesson_messages: {
        Row: {
          id: string; lesson_id: string; sender_id: string
          message: string; created_at: string
        }
        Insert: Partial<Database['public']['Tables']['lesson_messages']['Row']> & { lesson_id: string; sender_id: string; message: string }
        Update: Partial<Database['public']['Tables']['lesson_messages']['Row']>
      }
      lesson_notes: {
        Row: {
          id: string; lesson_id: string; user_id: string
          content: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['lesson_notes']['Row']> & { lesson_id: string; user_id: string }
        Update: Partial<Database['public']['Tables']['lesson_notes']['Row']>
      }
      lesson_materials: {
        Row: {
          id: string; lesson_id: string; teacher_id: string
          title: string; file_url: string | null; content: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['lesson_materials']['Row']> & { lesson_id: string; teacher_id: string; title: string }
        Update: Partial<Database['public']['Tables']['lesson_materials']['Row']>
      }
    }
    Functions: {
      is_slot_available: {
        Args: { p_teacher_id: string; p_scheduled_at: string; p_duration: number }
        Returns: boolean
      }
    }
  }
}
