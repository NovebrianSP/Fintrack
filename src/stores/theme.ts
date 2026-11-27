import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'

const storageKey = 'fintrack-theme-preference'

export const useThemeStore = defineStore('theme', () => {
  const savedPreference = localStorage.getItem(storageKey)
  const preference = ref<ThemePreference>(
    savedPreference === 'light' || savedPreference === 'dark' ? savedPreference : 'system',
  )
  const systemPrefersDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isDark = computed(() => preference.value === 'system' ? systemPrefersDark.value : preference.value === 'dark')
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')

  systemTheme.addEventListener('change', (event) => {
    systemPrefersDark.value = event.matches
  })

  watch([preference, isDark], ([selectedPreference, dark]) => {
    document.documentElement.classList.toggle('dark', dark)
    if (selectedPreference === 'system') {
      localStorage.removeItem(storageKey)
    } else {
      localStorage.setItem(storageKey, selectedPreference)
    }
  }, { immediate: true })

  function toggle() {
    if (preference.value === 'system') {
      preference.value = isDark.value ? 'light' : 'dark'
    } else if (preference.value === 'dark') {
      preference.value = 'light'
    } else {
      preference.value = 'system'
    }
  }

  return { preference, isDark, toggle }
})
