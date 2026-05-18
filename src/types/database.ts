export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      achievement_definitions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon_emoji: string | null
          icon_url: string | null
          id: string
          is_hidden: boolean
          rarity: string
          reward_label: string | null
          reward_type: string
          slug: string
          sort_order: number
          threshold: number
          title: string
          xp_reward: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          icon_emoji?: string | null
          icon_url?: string | null
          id?: string
          is_hidden?: boolean
          rarity?: string
          reward_label?: string | null
          reward_type?: string
          slug: string
          sort_order?: number
          threshold?: number
          title: string
          xp_reward?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon_emoji?: string | null
          icon_url?: string | null
          id?: string
          is_hidden?: boolean
          rarity?: string
          reward_label?: string | null
          reward_type?: string
          slug?: string
          sort_order?: number
          threshold?: number
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string | null
          ends_at: string
          event_type: string
          id: string
          lesson_id: string | null
          metadata: Json | null
          starts_at: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          ends_at: string
          event_type?: string
          id?: string
          lesson_id?: string | null
          metadata?: Json | null
          starts_at: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          ends_at?: string
          event_type?: string
          id?: string
          lesson_id?: string | null
          metadata?: Json | null
          starts_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_hosts: {
        Row: {
          club_id: string
          host_id: string
          role: string
          seen_at: string | null
          sort_order: number
        }
        Insert: {
          club_id: string
          host_id: string
          role?: string
          seen_at?: string | null
          sort_order?: number
        }
        Update: {
          club_id?: string
          host_id?: string
          role?: string
          seen_at?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_hosts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_hosts_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_payments: {
        Row: {
          amount_kopecks: number
          club_id: string
          created_at: string
          currency: string
          id: string
          metadata: Json
          paid_at: string | null
          refunded_at: string | null
          registration_id: string
          status: string
          updated_at: string
          user_id: string
          yookassa_payment_id: string | null
        }
        Insert: {
          amount_kopecks: number
          club_id: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          refunded_at?: string | null
          registration_id: string
          status?: string
          updated_at?: string
          user_id: string
          yookassa_payment_id?: string | null
        }
        Update: {
          amount_kopecks?: number
          club_id?: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          refunded_at?: string | null
          registration_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          yookassa_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_payments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "club_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_registrations: {
        Row: {
          attended_at: string | null
          cancelled_at: string | null
          club_id: string
          id: string
          notes: string | null
          registered_at: string
          status: string
          user_id: string
        }
        Insert: {
          attended_at?: string | null
          cancelled_at?: string | null
          club_id: string
          id?: string
          notes?: string | null
          registered_at?: string
          status?: string
          user_id: string
        }
        Update: {
          attended_at?: string | null
          cancelled_at?: string | null
          club_id?: string
          id?: string
          notes?: string | null
          registered_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_registrations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          assigned_by: string | null
          badge: string | null
          cancelled_at: string | null
          capacity: number | null
          category: string
          cover_emoji: string | null
          created_at: string
          created_by: string | null
          created_by_role: string
          description: string | null
          duration_min: number
          format: string
          id: string
          is_published: boolean
          level_max: string | null
          level_min: string | null
          location: string | null
          max_seats: number
          meeting_url: string | null
          price_kopecks: number
          seats_taken: number
          starts_at: string
          timezone: string
          topic: string
          updated_at: string
          xp_reward: number
        }
        Insert: {
          assigned_by?: string | null
          badge?: string | null
          cancelled_at?: string | null
          capacity?: number | null
          category: string
          cover_emoji?: string | null
          created_at?: string
          created_by?: string | null
          created_by_role?: string
          description?: string | null
          duration_min: number
          format: string
          id?: string
          is_published?: boolean
          level_max?: string | null
          level_min?: string | null
          location?: string | null
          max_seats: number
          meeting_url?: string | null
          price_kopecks?: number
          seats_taken?: number
          starts_at: string
          timezone?: string
          topic: string
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          assigned_by?: string | null
          badge?: string | null
          cancelled_at?: string | null
          capacity?: number | null
          category?: string
          cover_emoji?: string | null
          created_at?: string
          created_by?: string | null
          created_by_role?: string
          description?: string | null
          duration_min?: number
          format?: string
          id?: string
          is_published?: boolean
          level_max?: string | null
          level_min?: string | null
          location?: string | null
          max_seats?: number
          meeting_url?: string | null
          price_kopecks?: number
          seats_taken?: number
          starts_at?: string
          timezone?: string
          topic?: string
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "clubs_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          current_lesson_id: string | null
          id: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          current_lesson_id?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          current_lesson_id?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_current_lesson_id_fkey"
            columns: ["current_lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lesson_progress: {
        Row: {
          completed_at: string
          course_id: string
          course_lesson_id: string
          time_spent_sec: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string
          course_id: string
          course_lesson_id: string
          time_spent_sec?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string
          course_id?: string
          course_lesson_id?: string
          time_spent_sec?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_lesson_progress_course_lesson_id_fkey"
            columns: ["course_lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          audio_url: string | null
          content_md: string | null
          course_id: string
          created_at: string
          estimated_minutes: number | null
          id: string
          position: number
          title: string
          updated_at: string
          video_url: string | null
          xp_reward: number
        }
        Insert: {
          audio_url?: string | null
          content_md?: string | null
          course_id: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          position: number
          title: string
          updated_at?: string
          video_url?: string | null
          xp_reward?: number
        }
        Update: {
          audio_url?: string | null
          content_md?: string | null
          course_id?: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          position?: number
          title?: string
          updated_at?: string
          video_url?: string | null
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_payments: {
        Row: {
          amount_kopecks: number
          course_id: string
          created_at: string
          currency: string
          enrollment_id: string
          id: string
          metadata: Json
          paid_at: string | null
          refunded_at: string | null
          status: string
          updated_at: string
          user_id: string
          yookassa_payment_id: string | null
        }
        Insert: {
          amount_kopecks: number
          course_id: string
          created_at?: string
          currency?: string
          enrollment_id: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          refunded_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          yookassa_payment_id?: string | null
        }
        Update: {
          amount_kopecks?: number
          course_id?: string
          created_at?: string
          currency?: string
          enrollment_id?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          refunded_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          yookassa_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_payments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          author_id: string | null
          cover_variant: string
          cover_word: string | null
          created_at: string
          description: string | null
          duration_hours: number
          goal_tag: string
          id: string
          is_published: boolean
          lesson_count: number
          level: string | null
          price_kopecks: number
          released_at: string | null
          required_level: string | null
          slug: string
          title: string
          updated_at: string
          xp_reward: number
        }
        Insert: {
          author_id?: string | null
          cover_variant?: string
          cover_word?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number
          goal_tag?: string
          id?: string
          is_published?: boolean
          lesson_count?: number
          level?: string | null
          price_kopecks?: number
          released_at?: string | null
          required_level?: string | null
          slug: string
          title: string
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          author_id?: string | null
          cover_variant?: string
          cover_word?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number
          goal_tag?: string
          id?: string
          is_published?: boolean
          lesson_count?: number
          level?: string | null
          price_kopecks?: number
          released_at?: string | null
          required_level?: string | null
          slug?: string
          title?: string
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "courses_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      csp_violations: {
        Row: {
          blocked: string
          created_at: string
          directive: string
          document_uri: string | null
          id: number
          sample: string | null
          user_agent: string | null
        }
        Insert: {
          blocked: string
          created_at?: string
          directive: string
          document_uri?: string | null
          id?: number
          sample?: string | null
          user_agent?: string | null
        }
        Update: {
          blocked?: string
          created_at?: string
          directive?: string
          document_uri?: string | null
          id?: number
          sample?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      homework: {
        Row: {
          attachments: Json
          created_at: string | null
          description: string | null
          due_date: string
          grade: number | null
          id: string
          last_reminded_at: string | null
          lesson_id: string | null
          reminders_count: number
          reviewed_at: string | null
          score_10: number | null
          status: string
          student_id: string
          submission_text: string | null
          submitted_at: string | null
          teacher_feedback: string | null
          teacher_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json
          created_at?: string | null
          description?: string | null
          due_date: string
          grade?: number | null
          id?: string
          last_reminded_at?: string | null
          lesson_id?: string | null
          reminders_count?: number
          reviewed_at?: string | null
          score_10?: number | null
          status?: string
          student_id: string
          submission_text?: string | null
          submitted_at?: string | null
          teacher_feedback?: string | null
          teacher_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json
          created_at?: string | null
          description?: string | null
          due_date?: string
          grade?: number | null
          id?: string
          last_reminded_at?: string | null
          lesson_id?: string | null
          reminders_count?: number
          reviewed_at?: string | null
          score_10?: number | null
          status?: string
          student_id?: string
          submission_text?: string | null
          submitted_at?: string | null
          teacher_feedback?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_materials: {
        Row: {
          content: string | null
          created_at: string | null
          file_url: string | null
          id: string
          lesson_id: string
          teacher_id: string
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          lesson_id: string
          teacher_id: string
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          lesson_id?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_materials_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_messages: {
        Row: {
          created_at: string | null
          id: string
          lesson_id: string
          message: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lesson_id: string
          message: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lesson_id?: string
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_messages_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          content: string
          id: string
          lesson_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string
          id?: string
          lesson_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          id?: string
          lesson_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          quiz_id: string
          score: number
          student_id: string
          total: number
          xp_awarded: number
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: string
          quiz_id: string
          score: number
          student_id: string
          total: number
          xp_awarded?: number
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          quiz_id?: string
          score?: number
          student_id?: string
          total?: number
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "lesson_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_quizzes: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          question_count: number
          questions: Json
          summary_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          question_count: number
          questions: Json
          summary_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          question_count?: number
          questions?: Json
          summary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_quizzes_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: true
            referencedRelation: "lesson_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_recordings: {
        Row: {
          chunks_count: number
          created_at: string
          duration_sec: number | null
          error_message: string | null
          finalized_at: string | null
          id: string
          lesson_id: string
          mime_type: string
          next_seq_s: number
          next_seq_t: number
          started_at: string
          status: string
          storage_prefix: string
          total_bytes: number
          updated_at: string
        }
        Insert: {
          chunks_count?: number
          created_at?: string
          duration_sec?: number | null
          error_message?: string | null
          finalized_at?: string | null
          id?: string
          lesson_id: string
          mime_type?: string
          next_seq_s?: number
          next_seq_t?: number
          started_at?: string
          status?: string
          storage_prefix: string
          total_bytes?: number
          updated_at?: string
        }
        Update: {
          chunks_count?: number
          created_at?: string
          duration_sec?: number | null
          error_message?: string | null
          finalized_at?: string | null
          id?: string
          lesson_id?: string
          mime_type?: string
          next_seq_s?: number
          next_seq_t?: number
          started_at?: string
          status?: string
          storage_prefix?: string
          total_bytes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_recordings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_subscriptions: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          price_kopecks: number
          starts_on: string
          status: string
          student_id: string
          teacher_id: string
          timezone: string
          updated_at: string
          weekly_pattern: Json
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          price_kopecks?: number
          starts_on: string
          status?: string
          student_id: string
          teacher_id: string
          timezone?: string
          updated_at?: string
          weekly_pattern: Json
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          price_kopecks?: number
          starts_on?: string
          status?: string
          student_id?: string
          teacher_id?: string
          timezone?: string
          updated_at?: string
          weekly_pattern?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lesson_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_subscriptions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_summaries: {
        Row: {
          ai_model: string
          areas_to_improve: string[]
          created_at: string
          grammar_points: string[]
          homework: string | null
          id: string
          lesson_id: string
          recording_id: string | null
          source: string
          strengths: string[]
          student_id: string
          summary_text: string
          teacher_id: string
          teacher_input: string | null
          tokens_used: number | null
          transcript_id: string | null
          vocabulary: string[]
        }
        Insert: {
          ai_model?: string
          areas_to_improve?: string[]
          created_at?: string
          grammar_points?: string[]
          homework?: string | null
          id?: string
          lesson_id: string
          recording_id?: string | null
          source?: string
          strengths?: string[]
          student_id: string
          summary_text: string
          teacher_id: string
          teacher_input?: string | null
          tokens_used?: number | null
          transcript_id?: string | null
          vocabulary?: string[]
        }
        Update: {
          ai_model?: string
          areas_to_improve?: string[]
          created_at?: string
          grammar_points?: string[]
          homework?: string | null
          id?: string
          lesson_id?: string
          recording_id?: string | null
          source?: string
          strengths?: string[]
          student_id?: string
          summary_text?: string
          teacher_id?: string
          teacher_input?: string | null
          tokens_used?: number | null
          transcript_id?: string | null
          vocabulary?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "lesson_summaries_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_summaries_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "lesson_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_summaries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_summaries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_summaries_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "lesson_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_transcripts: {
        Row: {
          attempts: number
          created_at: string
          duration_sec: number | null
          error_message: string | null
          full_text: string
          id: string
          language: string
          lesson_id: string
          model: string
          prompt_tokens: number | null
          recording_id: string
          segments: Json
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          duration_sec?: number | null
          error_message?: string | null
          full_text: string
          id?: string
          language?: string
          lesson_id: string
          model?: string
          prompt_tokens?: number | null
          recording_id: string
          segments?: Json
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          duration_sec?: number | null
          error_message?: string | null
          full_text?: string
          id?: string
          language?: string
          lesson_id?: string
          model?: string
          prompt_tokens?: number | null
          recording_id?: string
          segments?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_transcripts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_transcripts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "lesson_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          cancellation_reason: string | null
          cancelled_by: string | null
          created_at: string
          duration_minutes: number
          id: string
          jitsi_room_name: string | null
          price: number
          scheduled_at: string
          status: string
          student_id: string
          subscription_id: string | null
          teacher_id: string
          teacher_notes: string | null
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          jitsi_room_name?: string | null
          price: number
          scheduled_at: string
          status?: string
          student_id: string
          subscription_id?: string | null
          teacher_id: string
          teacher_notes?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          jitsi_room_name?: string | null
          price?: number
          scheduled_at?: string
          status?: string
          student_id?: string
          subscription_id?: string | null
          teacher_id?: string
          teacher_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "lesson_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      level_tests: {
        Row: {
          answers: Json
          completed_at: string
          correct_count: number
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          level: string
          score: number
          total_questions: number
          user_id: string | null
          xp: number
        }
        Insert: {
          answers: Json
          completed_at?: string
          correct_count?: number
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          level: string
          score: number
          total_questions?: number
          user_id?: string | null
          xp?: number
        }
        Update: {
          answers?: Json
          completed_at?: string
          correct_count?: number
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          level?: string
          score?: number
          total_questions?: number
          user_id?: string | null
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "level_tests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_shares: {
        Row: {
          created_at: string
          id: string
          material_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_shares_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          created_at: string
          description: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_public: boolean
          lesson_id: string | null
          level: string | null
          mime_type: string | null
          storage_path: string | null
          tags: string[]
          teacher_id: string
          title: string
          updated_at: string
          use_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_public?: boolean
          lesson_id?: string | null
          level?: string | null
          mime_type?: string | null
          storage_path?: string | null
          tags?: string[]
          teacher_id: string
          title: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_public?: boolean
          lesson_id?: string | null
          level?: string | null
          mime_type?: string | null
          storage_path?: string | null
          tags?: string[]
          teacher_id?: string
          title?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_badges: {
        Row: {
          category: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          seen_at: string | null
          target_url: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          seen_at?: string | null
          target_url?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          seen_at?: string | null
          target_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: string
          id: string
          is_read: boolean
          metadata: Json
          sent_at: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          channel: string
          id?: string
          is_read?: boolean
          metadata?: Json
          sent_at?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          id?: string
          is_read?: boolean
          metadata?: Json
          sent_at?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_queue: {
        Row: {
          created_at: string
          error: string | null
          id: number
          payload: Json
          processed_at: string | null
          retries: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: number
          payload?: Json
          processed_at?: string | null
          retries?: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: number
          payload?: Json
          processed_at?: string | null
          retries?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          lesson_id: string
          metadata: Json
          paid_at: string | null
          payment_method: string | null
          refunded_at: string | null
          status: string
          student_id: string
          updated_at: string
          yookassa_payment_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          lesson_id: string
          metadata?: Json
          paid_at?: string | null
          payment_method?: string | null
          refunded_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
          yookassa_payment_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          lesson_id?: string
          metadata?: Json
          paid_at?: string | null
          payment_method?: string | null
          refunded_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          yookassa_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance_rub: number
          city: string | null
          created_at: string
          email: string
          email_verified: boolean
          english_goal: string | null
          first_name: string | null
          full_name: string
          full_name_ru: string | null
          id: string
          interests: string[]
          invite_code: string | null
          is_active: boolean
          language: string
          last_name: string | null
          notification_prefs: Json
          occupation: string | null
          onboarding_completed_at: string | null
          onboarding_step: string
          phone: string | null
          profile_visibility: Json
          referred_by_user_id: string | null
          role: string
          subscription_tier: string
          subscription_until: string | null
          telegram_chat_id: number | null
          telegram_username: string | null
          timezone: string
          ui_prefs: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          balance_rub?: number
          city?: string | null
          created_at?: string
          email: string
          email_verified?: boolean
          english_goal?: string | null
          first_name?: string | null
          full_name: string
          full_name_ru?: string | null
          id: string
          interests?: string[]
          invite_code?: string | null
          is_active?: boolean
          language?: string
          last_name?: string | null
          notification_prefs?: Json
          occupation?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: string
          phone?: string | null
          profile_visibility?: Json
          referred_by_user_id?: string | null
          role?: string
          subscription_tier?: string
          subscription_until?: string | null
          telegram_chat_id?: number | null
          telegram_username?: string | null
          timezone?: string
          ui_prefs?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          balance_rub?: number
          city?: string | null
          created_at?: string
          email?: string
          email_verified?: boolean
          english_goal?: string | null
          first_name?: string | null
          full_name?: string
          full_name_ru?: string | null
          id?: string
          interests?: string[]
          invite_code?: string | null
          is_active?: boolean
          language?: string
          last_name?: string | null
          notification_prefs?: Json
          occupation?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: string
          phone?: string | null
          profile_visibility?: Json
          referred_by_user_id?: string | null
          role?: string
          subscription_tier?: string
          subscription_until?: string | null
          telegram_chat_id?: number | null
          telegram_username?: string | null
          timezone?: string
          ui_prefs?: Json
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          bucket: string
          id: number
          occurred_at: string
        }
        Insert: {
          bucket: string
          id?: number
          occurred_at?: string
        }
        Update: {
          bucket?: string
          id?: number
          occurred_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          activated_at: string | null
          channel: string
          created_at: string
          expires_at: string | null
          id: string
          invite_code: string
          invited_email: string | null
          inviter_id: string
          ip_hash: string | null
          registered_at: string | null
          registered_user_id: string | null
          status: string
          xp_awarded: number
        }
        Insert: {
          activated_at?: string | null
          channel?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          invite_code: string
          invited_email?: string | null
          inviter_id: string
          ip_hash?: string | null
          registered_at?: string | null
          registered_user_id?: string | null
          status?: string
          xp_awarded?: number
        }
        Update: {
          activated_at?: string | null
          channel?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          invite_code?: string
          invited_email?: string | null
          inviter_id?: string
          ip_hash?: string | null
          registered_at?: string | null
          registered_user_id?: string | null
          status?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          is_visible: boolean
          lesson_id: string
          rating: number
          student_id: string
          teacher_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          lesson_id: string
          rating: number
          student_id: string
          teacher_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          lesson_id?: string
          rating?: number
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_definitions: {
        Row: {
          claim_criteria: Json
          created_at: string
          description: string | null
          icon_emoji: string | null
          id: string
          is_active: boolean
          reward_type: string
          slug: string
          sort_order: number
          title: string
        }
        Insert: {
          claim_criteria: Json
          created_at?: string
          description?: string | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean
          reward_type: string
          slug: string
          sort_order?: number
          title: string
        }
        Update: {
          claim_criteria?: Json
          created_at?: string
          description?: string | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean
          reward_type?: string
          slug?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      skill_progress: {
        Row: {
          id: string
          percentage: number
          skill: string
          target_level: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          percentage?: number
          skill: string
          target_level?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          percentage?: number
          skill?: string
          target_level?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_preferred_slots: {
        Row: {
          created_at: string
          duration_minutes: number
          hour: number
          id: string
          minute: number
          student_id: string
          teacher_id: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          hour: number
          id?: string
          minute?: number
          student_id: string
          teacher_id?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          hour?: number
          id?: string
          minute?: number
          student_id?: string
          teacher_id?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_preferred_slots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_preferred_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          sender_id: string | null
          sender_role: string
          thread_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role: string
          thread_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          admin_last_seen_at: string | null
          created_at: string
          id: string
          last_message_at: string
          last_user_message_at: string | null
          priority: string
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_last_seen_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_user_message_at?: string | null
          priority?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_last_seen_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_user_message_at?: string | null
          priority?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_applications: {
        Row: {
          contact: string
          created_at: string
          email: string
          first_name: string
          full_name_ru: string | null
          id: string
          last_name: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact: string
          created_at?: string
          email: string
          first_name: string
          full_name_ru?: string | null
          id?: string
          last_name: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact?: string
          created_at?: string
          email?: string
          first_name?: string
          full_name_ru?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_availability: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          teacher_id: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          teacher_id: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_earnings: {
        Row: {
          created_at: string
          gross_amount: number
          id: string
          lesson_id: string
          net_amount: number
          payment_id: string
          platform_fee: number
          status: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          gross_amount: number
          id?: string
          lesson_id: string
          net_amount: number
          payment_id: string
          platform_fee: number
          status?: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          gross_amount?: number
          id?: string
          lesson_id?: string
          net_amount?: number
          payment_id?: string
          platform_fee?: number
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_earnings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_earnings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_earnings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_group_members: {
        Row: {
          added_at: string
          group_id: string
          student_id: string
        }
        Insert: {
          added_at?: string
          group_id: string
          student_id: string
        }
        Update: {
          added_at?: string
          group_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "teacher_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_groups_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_profiles: {
        Row: {
          bio: string | null
          certificates: string[]
          created_at: string
          education: string | null
          experience_years: number | null
          hourly_rate: number
          id: string
          is_listed: boolean
          is_verified: boolean
          languages: string[]
          rating: number
          specializations: string[]
          total_lessons: number
          total_reviews: number
          trial_rate: number | null
          updated_at: string
          user_id: string
          video_intro_url: string | null
        }
        Insert: {
          bio?: string | null
          certificates?: string[]
          created_at?: string
          education?: string | null
          experience_years?: number | null
          hourly_rate: number
          id?: string
          is_listed?: boolean
          is_verified?: boolean
          languages?: string[]
          rating?: number
          specializations?: string[]
          total_lessons?: number
          total_reviews?: number
          trial_rate?: number | null
          updated_at?: string
          user_id: string
          video_intro_url?: string | null
        }
        Update: {
          bio?: string | null
          certificates?: string[]
          created_at?: string
          education?: string | null
          experience_years?: number | null
          hourly_rate?: number
          id?: string
          is_listed?: boolean
          is_verified?: boolean
          languages?: string[]
          rating?: number
          specializations?: string[]
          total_lessons?: number
          total_reviews?: number
          trial_rate?: number | null
          updated_at?: string
          user_id?: string
          video_intro_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_linking_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_linking_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_lesson_requests: {
        Row: {
          assigned_lesson_id: string | null
          assigned_teacher_id: string | null
          created_at: string
          id: string
          level_test_id: string | null
          notes: string | null
          preferred_slot: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_lesson_id?: string | null
          assigned_teacher_id?: string | null
          created_at?: string
          id?: string
          level_test_id?: string | null
          notes?: string | null
          preferred_slot?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_lesson_id?: string | null
          assigned_teacher_id?: string | null
          created_at?: string
          id?: string
          level_test_id?: string | null
          notes?: string | null
          preferred_slot?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_lesson_requests_assigned_lesson_id_fkey"
            columns: ["assigned_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_lesson_requests_assigned_teacher_id_fkey"
            columns: ["assigned_teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_lesson_requests_level_test_id_fkey"
            columns: ["level_test_id"]
            isOneToOne: false
            referencedRelation: "level_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievement_progress: {
        Row: {
          achievement_id: string
          current_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          current_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          current_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievement_progress_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievement_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_friends: {
        Row: {
          created_at: string
          friend_id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          responded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_friends_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_friends_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          current_level: number
          current_streak: number
          english_level: string | null
          id: string
          last_lesson_date: string | null
          lessons_completed: number
          longest_streak: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_level?: number
          current_streak?: number
          english_level?: string | null
          id?: string
          last_lesson_date?: string | null
          lessons_completed?: number
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_level?: number
          current_streak?: number
          english_level?: string | null
          id?: string
          last_lesson_date?: string | null
          lessons_completed?: number
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rewards: {
        Row: {
          admin_notes: string | null
          awarded_at: string
          delivery_json: Json | null
          fulfilled_at: string | null
          id: string
          reward_id: string
          status: string
          tracking_number: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          awarded_at?: string
          delivery_json?: Json | null
          fulfilled_at?: string | null
          id?: string
          reward_id: string
          status?: string
          tracking_number?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          awarded_at?: string
          delivery_json?: Json | null
          fulfilled_at?: string | null
          id?: string
          reward_id?: string
          status?: string
          tracking_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "reward_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          metadata: Json
          source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          source_id?: string | null
          source_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard_all_time: {
        Row: {
          rank: number | null
          user_id: string | null
          xp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_monthly: {
        Row: {
          rank: number | null
          user_id: string | null
          xp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_weekly: {
        Row: {
          rank: number | null
          user_id: string | null
          xp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_referral: { Args: { p_user_id: string }; Returns: boolean }
      admin_has_mfa: { Args: never; Returns: boolean }
      are_friends: { Args: { me: string; other: string }; Returns: boolean }
      audit_log_event: {
        Args: {
          p_action: string
          p_category: string
          p_ip?: unknown
          p_payload?: Json
          p_request_id?: string
          p_target_id?: string
          p_target_type?: string
          p_user_agent?: string
        }
        Returns: number
      }
      award_xp: {
        Args: {
          p_amount: number
          p_description?: string
          p_metadata?: Json
          p_source: string
          p_source_id: string
          p_user_id: string
        }
        Returns: {
          awarded: boolean
          reason: string
        }[]
      }
      can_access_support_thread: {
        Args: { p_thread_id: string }
        Returns: boolean
      }
      cancel_lesson_subscription: {
        Args: { p_from?: string; p_sub_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      claim_referral: {
        Args: { p_code: string; p_invitee_user_id: string }
        Returns: boolean
      }
      cleanup_old_csp_violations: { Args: never; Returns: number }
      cleanup_old_lesson_recordings: {
        Args: never
        Returns: {
          deleted_lesson_id: string
          deleted_objects: number
          deleted_recording_id: string
        }[]
      }
      club_hosts_mark_seen: { Args: never; Returns: number }
      complete_finished_lessons: {
        Args: never
        Returns: {
          lesson_id: string
          scheduled_at: string
        }[]
      }
      create_lesson_subscription: {
        Args: {
          p_pattern: Json
          p_starts_on: string
          p_teacher_id: string
          p_weeks: number
        }
        Returns: Json
      }
      csp_hour_bucket: { Args: { ts: string }; Returns: number }
      extend_lesson_subscriptions: { Args: never; Returns: Json }
      find_trial_teacher: {
        Args: { p_duration?: number; p_slot: string; p_tz?: string }
        Returns: {
          teacher_profile_id: string
          teacher_user_id: string
        }[]
      }
      generate_invite_code: { Args: never; Returns: string }
      get_leaderboard: {
        Args: {
          p_friends_only?: boolean
          p_level?: string
          p_limit?: number
          p_period?: string
        }
        Returns: {
          out_avatar_url: string
          out_clubs_attended: number
          out_current_streak: number
          out_english_level: string
          out_full_name: string
          out_longest_streak: number
          out_rank: number
          out_user_id: string
          out_xp: number
        }[]
      }
      get_student_dashboard: { Args: { p_user_id: string }; Returns: Json }
      get_teacher_dashboard: { Args: { p_user_id: string }; Returns: Json }
      get_teacher_profile_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      increment_material_use: {
        Args: { p_material_id: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      is_group_owner: { Args: { p_group_id: string }; Returns: boolean }
      is_lesson_participant: { Args: { p_lesson_id: string }; Returns: boolean }
      is_material_owner: { Args: { p_material_id: string }; Returns: boolean }
      is_slot_available: {
        Args: {
          p_duration?: number
          p_scheduled_at: string
          p_teacher_id: string
        }
        Returns: boolean
      }
      lesson_recordings_next_seq: {
        Args: { p_recording_id: string; p_role: string }
        Returns: number
      }
      lesson_slot_range: {
        Args: { mins: number; ts: string }
        Returns: unknown
      }
      list_trial_teachers: {
        Args: { p_duration?: number; p_slot: string; p_tz?: string }
        Returns: {
          avatar_url: string
          bio: string
          experience_years: number
          full_name: string
          rating: number
          specializations: string[]
          teacher_profile_id: string
          teacher_user_id: string
          total_lessons: number
          total_reviews: number
        }[]
      }
      mark_missed_lessons: {
        Args: never
        Returns: {
          lesson_id: string
          scheduled_at: string
        }[]
      }
      notifications_emit: {
        Args: {
          p_category: string
          p_event_type: string
          p_payload?: Json
          p_target_url?: string
          p_user_id: string
        }
        Returns: string
      }
      notifications_mark_seen: {
        Args: { p_category?: string; p_user_id: string }
        Returns: number
      }
      notifications_unread_counts: {
        Args: { p_user_id: string }
        Returns: Json
      }
      refresh_leaderboards: { Args: never; Returns: undefined }
      support_mark_thread_read: {
        Args: { p_thread_id: string }
        Returns: {
          admin_last_seen_at: string | null
          created_at: string
          id: string
          last_message_at: string
          last_user_message_at: string | null
          priority: string
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "support_threads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sweep_stuck_lesson_recordings: {
        Args: never
        Returns: {
          recording_id: string
          started_at: string
        }[]
      }
      transliterate_ru: { Args: { input: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
