<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, Mail } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { isSupabaseConfigured } from '@/lib/supabase'

interface LoginAttemptState {
  attempts: number
  lockedUntil: number
}

const loginAttemptKey = 'fintrack-login-attempts'
const maxLoginAttempts = 3
const lockoutDurationMs = 15 * 60 * 1000

function isLoginAttemptState(value: unknown): value is LoginAttemptState {
  return typeof value === 'object'
    && value !== null
    && typeof Reflect.get(value, 'attempts') === 'number'
    && typeof Reflect.get(value, 'lockedUntil') === 'number'
}

function readLoginAttemptState(): LoginAttemptState | null {
  const saved = sessionStorage.getItem(loginAttemptKey)
  if (!saved) return null
  try {
    const parsed: unknown = JSON.parse(saved)
    return isLoginAttemptState(parsed) ? parsed : null
  } catch (error) {
    console.warn('Status percobaan login tidak dapat dibaca:', error)
    sessionStorage.removeItem(loginAttemptKey)
    return null
  }
}

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const emailError = ref('')
const passwordError = ref('')
const isRegister = ref(false)
const showPassword = ref(false)
const busy = ref(false)
const attemptState = ref<LoginAttemptState | null>(readLoginAttemptState())
const currentTime = ref(Date.now())
let lockoutTimer: number | undefined
const normalizedEmail = computed(() => email.value.trim().toLowerCase())
const failedAttempts = computed(() => {
  if (!attemptState.value) return 0
  if (attemptState.value.lockedUntil && attemptState.value.lockedUntil <= currentTime.value) return 0
  return attemptState.value.attempts
})
const lockoutRemainingSeconds = computed(() => {
  if (!attemptState.value?.lockedUntil) return 0
  return Math.max(0, Math.ceil((attemptState.value.lockedUntil - currentTime.value) / 1000))
})
const isLoginLocked = computed(() => lockoutRemainingSeconds.value > 0)
const lockoutMessage = computed(() => {
  if (!lockoutRemainingSeconds.value) return ''
  const minutes = Math.floor(lockoutRemainingSeconds.value / 60)
  const seconds = lockoutRemainingSeconds.value % 60
  return `Batas ${maxLoginAttempts} percobaan tercapai. Coba lagi dalam ${minutes}:${String(seconds).padStart(2, '0')}.`
})
const errorMessage = ref(
  !isSupabaseConfigured
    ? 'Koneksi Supabase belum dikonfigurasi. Atur URL dan publishable key untuk mengaktifkan login.'
    : route.query.error
      ? 'Sesi tidak dapat dimuat. Silakan masuk kembali.'
      : '',
)
const successMessage = ref('')

onMounted(() => {
  lockoutTimer = window.setInterval(() => {
    currentTime.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (lockoutTimer !== undefined) window.clearInterval(lockoutTimer)
})

function clearFieldError(field: 'email' | 'password') {
  if (field === 'email') emailError.value = ''
  else passwordError.value = ''
  errorMessage.value = ''
}

function toggleAuthMode() {
  isRegister.value = !isRegister.value
  emailError.value = ''
  passwordError.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string') return message
  }
  return 'Terjadi kesalahan saat autentikasi.'
}

function isInvalidCredentials(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const code = Reflect.get(error, 'code')
  const message = getErrorMessage(error).toLowerCase()
  return code === 'invalid_credentials' || message.includes('invalid login credentials')
}

function recordFailedAttempt() {
  const attempts = failedAttempts.value + 1
  const lockedUntil = attempts >= maxLoginAttempts ? Date.now() + lockoutDurationMs : 0
  const nextState = { attempts, lockedUntil }
  attemptState.value = nextState
  sessionStorage.setItem(loginAttemptKey, JSON.stringify(nextState))
  currentTime.value = Date.now()
  errorMessage.value = attempts >= maxLoginAttempts
    ? ''
    : `Email atau password salah. Sisa percobaan: ${maxLoginAttempts - attempts}.`
}

async function submit() {
  emailError.value = ''
  passwordError.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  if (!isSupabaseConfigured) {
    errorMessage.value = 'Koneksi Supabase belum dikonfigurasi. Atur URL dan publishable key untuk mengaktifkan login.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail.value)) {
    emailError.value = 'Format email salah. Periksa kembali alamat email.'
    return
  }
  if (password.value.length < 6) {
    passwordError.value = 'Password salah. Masukkan minimal 6 karakter.'
    return
  }
  if (!isRegister.value && isLoginLocked.value) return

  busy.value = true
  try {
    if (isRegister.value) {
      const user = await auth.signUp(normalizedEmail.value, password.value)
      if (!user || !auth.session) {
        successMessage.value = 'Akun dibuat. Periksa email untuk konfirmasi sebelum masuk.'
        return
      }
    } else {
      await auth.signIn(normalizedEmail.value, password.value)
      sessionStorage.removeItem(loginAttemptKey)
      attemptState.value = null
    }
    await router.replace('/')
  } catch (error) {
    if (!isRegister.value && isInvalidCredentials(error)) {
      recordFailedAttempt()
    } else {
      errorMessage.value = getErrorMessage(error)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-visual">
      <a class="brand login-brand" href="/"><span class="brand-icon"><Leaf :size="19" /></span> fintrack</a>
      <div class="visual-copy">
        <span class="eyebrow">MONEY, WITH A LITTLE MORE MEANING</span>
        <h1>Small steps.<br />A <em>brighter</em> future.</h1>
        <p>Kelola uang magangmu dengan lebih tenang. Satu catatan kecil hari ini, untuk rencana besar nanti.</p>
        <div class="login-note"><span class="note-icon">✳</span><span>Keuanganmu, tumbuh sesuai caramu.</span></div>
      </div>
      <div class="visual-bottom">PERSONAL FINANCE, MADE SIMPLE <span>© FINTRACK 2026</span></div>
    </section>
    <section class="login-form-wrap">
      <div class="login-form">
        <div class="login-mobile-brand brand"><span class="brand-icon"><Leaf :size="19" /></span> fintrack</div>
        <span class="eyebrow">SELAMAT DATANG</span>
        <h2>{{ isRegister ? 'Buat akunmu' : 'Senang bertemu lagi' }}</h2>
        <p class="login-subtitle">{{ isRegister ? 'Mulai perjalanan finansial yang lebih terencana.' : 'Masuk dan lihat progres keuanganmu hari ini.' }}</p>

        <form novalidate @submit.prevent="submit">
          <label for="email">Email</label>
          <div class="input-wrap" :class="{ 'input-invalid': emailError }"><Mail :size="17" /><input id="email" v-model="email" type="email" autocomplete="email" placeholder="nama@email.com" aria-describedby="email-error" :aria-invalid="Boolean(emailError)" required @input="clearFieldError('email')" /></div>
          <p v-if="emailError" id="email-error" class="field-error">{{ emailError }}</p>
          <label for="password">Kata sandi</label>
          <div class="input-wrap" :class="{ 'input-invalid': passwordError }"><LockKeyhole :size="17" /><input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Minimal 6 karakter" minlength="6" aria-describedby="password-error" :aria-invalid="Boolean(passwordError)" required @input="clearFieldError('password')" /><button class="password-toggle" type="button" aria-label="Tampilkan kata sandi" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="17" /><Eye v-else :size="17" /></button></div>
          <p v-if="passwordError" id="password-error" class="field-error">{{ passwordError }}</p>
          <p v-if="errorMessage" class="form-message error-message">{{ errorMessage }}</p>
          <p v-if="!isRegister && isLoginLocked" class="form-message error-message" aria-live="polite">{{ lockoutMessage }}</p>
          <p v-if="successMessage" class="form-message success-message">{{ successMessage }}</p>
          <button class="primary-button login-submit" :disabled="busy || !isSupabaseConfigured || (!isRegister && isLoginLocked)">{{ busy ? 'Memproses...' : isRegister ? 'Buat akun' : 'Masuk ke Fintrack' }} <ArrowRight :size="17" /></button>
        </form>

        <p class="switch-auth">{{ isRegister ? 'Sudah punya akun?' : 'Belum punya akun?' }} <button type="button" @click="toggleAuthMode">{{ isRegister ? 'Masuk' : 'Daftar gratis' }}</button></p>
        <p class="secure-note"><LockKeyhole :size="13" /> Data keuanganmu tersimpan dengan aman dan privat.</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page{display:grid;min-height:100vh;grid-template-columns:1fr 1fr;background:var(--surface)}
.login-visual{position:relative;display:flex;min-height:100vh;flex-direction:column;justify-content:space-between;overflow:hidden;padding:32px 8%;background:#1b4935;color:#fff}
.login-visual:after{position:absolute;right:-130px;bottom:-180px;width:540px;height:540px;border:1px solid #ffffff15;border-radius:50%;box-shadow:0 0 0 45px #ffffff08,0 0 0 95px #ffffff05;content:''}
.login-brand,.login-mobile-brand{display:flex;align-items:center;gap:9px;font-family:Manrope,sans-serif;font-size:20px;font-weight:800;letter-spacing:-.8px}.login-brand{position:relative;z-index:1;color:#fff}.login-brand .brand-icon,.login-mobile-brand .brand-icon{background:#ffffff1a;color:#a6e2bf}
.visual-copy{position:relative;z-index:1;max-width:510px;margin:auto 0;padding:75px 0}
.eyebrow{color:#8fcca9;font-size:10px;font-weight:700;letter-spacing:1.55px}
.visual-copy h1{margin:19px 0 15px;font-family:Manrope,sans-serif;font-size:clamp(42px,5vw,68px);font-weight:700;letter-spacing:-3.7px;line-height:1.09}
.visual-copy h1 em{color:#93d0a8;font-weight:500}
.visual-copy>p{max-width:380px;color:#c0d8c8;font-size:13px;line-height:1.8}
.login-note{display:flex;align-items:center;gap:10px;margin-top:35px;color:#daefe1;font-size:11px}.note-icon{display:grid;width:29px;height:29px;place-items:center;border:1px solid #ffffff38;border-radius:50%;color:#a6e2bf;font-size:17px}
.visual-bottom{position:relative;z-index:1;display:flex;justify-content:space-between;color:#91b5a0;font-size:8px;font-weight:600;letter-spacing:1px}
.login-form-wrap{display:grid;place-items:center;padding:35px 9%}
.login-form{width:min(100%,370px)}.login-mobile-brand{display:none;margin-bottom:48px}
.login-form>.eyebrow{color:var(--green)}.login-form h2{margin:10px 0 5px;font-family:Manrope,sans-serif;font-size:27px;font-weight:750;letter-spacing:-1px}.login-subtitle{margin:0 0 27px;color:var(--muted);font-size:12px}
.login-form form{display:grid;gap:9px}.login-form label{margin-top:5px;font-size:10px;font-weight:700}
.input-wrap{display:flex;height:42px;align-items:center;gap:9px;padding:0 11px;border:1px solid var(--border);border-radius:7px;background:var(--surface-muted);color:var(--muted)}.input-wrap:focus-within{border-color:var(--green)}.input-wrap.input-invalid{border-color:var(--red)}.input-wrap input{width:100%;height:100%;border:0;outline:0;background:transparent;font-size:11px}.password-toggle{display:grid;width:25px;height:25px;flex:none;place-items:center;background:transparent;color:var(--muted)}.field-error{margin:-4px 0 2px;color:var(--red);font-size:10px;line-height:1.45}
.login-submit{display:flex;width:100%;height:42px;align-items:center;justify-content:center;gap:8px;margin-top:8px;padding:0 14px;border:0;border-radius:7px;background:var(--green);color:#fff;font-size:11px;font-weight:700;cursor:pointer;transition:background .16s,transform .16s}.login-submit:hover:not(:disabled){background:var(--green-dark);transform:translateY(-1px)}.login-submit:focus-visible{outline:3px solid color-mix(in srgb,var(--green) 35%,transparent);outline-offset:2px}.login-submit:disabled{cursor:not-allowed;opacity:.6}
.switch-auth{margin:20px 0;color:var(--muted);font-size:10px;text-align:center}.switch-auth button{padding:0;background:transparent;color:var(--green);font-size:10px;font-weight:700}.secure-note{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:37px;color:var(--muted);font-size:9px}
@media(max-width:760px){.login-page{grid-template-columns:1fr}.login-visual{display:none}.login-form-wrap{min-height:100vh;padding:32px 24px}.login-mobile-brand{display:flex}.login-form{max-width:390px}.login-form h2{font-size:25px}}
</style>
