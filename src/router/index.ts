import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView },
  ],
})

router.beforeEach(async (to) => {
  if (!isSupabaseConfigured) {
    return to.name === 'login' ? true : { name: 'login', query: { error: 'config' } }
  }

  const auth = useAuthStore()
  try {
    await auth.initialize()
  } catch (error) {
    console.error('Gagal memuat sesi Supabase:', error)
    return { name: 'login', query: { error: 'session' } }
  }

  if (to.name !== 'login' && !auth.session) return { name: 'login' }
  if (to.name === 'login' && auth.session) return { name: 'home' }
  return true
})

export default router
