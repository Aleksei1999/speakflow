'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import type { User } from '@supabase/supabase-js'

type Profile = Database['public']['Tables']['profiles']['Row']

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function getUser() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) {
          setError(`auth: ${authError.message}`)
          setIsLoading(false)
          return
        }
        setUser(user)
        if (user) {
          const { data, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single()
          if (profileError) {
            setError(`profile: ${profileError.message}`)
          } else {
            setProfile(data)
          }
        }
      } catch (e: any) {
        setError(`catch: ${e?.message ?? 'unknown'}`)
      }
      setIsLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
          setProfile(data)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, profile, role: profile?.role ?? null, isLoading, isAuthenticated: !!user, error }
}
