<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

watch(
  () => auth.session,
  (session) => {
    if (isSupabaseConfigured && !session && route.name !== 'login') {
      void router.replace({ name: 'login' })
    }
  },
)
</script>

<template>
  <RouterView />
</template>
