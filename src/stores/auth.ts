import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const initialized = ref(false)

  async function initialize() {
    if (!isSupabaseConfigured || !supabase || initialized.value) {
      initialized.value = true
      return
    }

    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    session.value = data.session
    supabase.auth.onAuthStateChange((_event, nextSession) => {
      session.value = nextSession
    })
    initialized.value = true
  }

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error('Koneksi Supabase belum dikonfigurasi.')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    session.value = data.session
  }

  async function signUp(email: string, password: string) {
    if (!supabase) throw new Error('Koneksi Supabase belum dikonfigurasi.')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    session.value = data.session
    return data.user
  }

  async function signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    }
    session.value = null
  }

  return { session, initialized, initialize, signIn, signUp, signOut }
})
