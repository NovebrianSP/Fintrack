<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, Mail } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { isSupabaseConfigured } from '@/lib/supabase'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const isRegister = ref(false)
const showPassword = ref(false)
const busy = ref(false)
const errorMessage = ref(
  !isSupabaseConfigured
    ? 'Koneksi Supabase belum dikonfigurasi. Atur URL dan publishable key untuk mengaktifkan login.'
    : route.query.error
      ? 'Sesi tidak dapat dimuat. Silakan masuk kembali.'
      : '',
)
const successMessage = ref('')

async function submit() {
  busy.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    if (isRegister.value) {
      const user = await auth.signUp(email.value, password.value)
      if (!user || !auth.session) {
        successMessage.value = 'Akun dibuat. Periksa email untuk konfirmasi sebelum masuk.'
        return
      }
    } else {
      await auth.signIn(email.value, password.value)
    }
    await router.replace('/')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Terjadi kesalahan saat autentikasi.'
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

        <form @submit.prevent="submit">
          <label for="email">Email</label>
          <div class="input-wrap"><Mail :size="17" /><input id="email" v-model="email" type="email" autocomplete="email" placeholder="nama@email.com" required /></div>
          <label for="password">Kata sandi</label>
          <div class="input-wrap"><LockKeyhole :size="17" /><input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Minimal 6 karakter" minlength="6" required /><button class="password-toggle" type="button" aria-label="Tampilkan kata sandi" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="17" /><Eye v-else :size="17" /></button></div>
          <p v-if="errorMessage" class="form-message error-message">{{ errorMessage }}</p>
          <p v-if="successMessage" class="form-message success-message">{{ successMessage }}</p>
          <button class="primary-button login-submit" :disabled="busy || !isSupabaseConfigured">{{ busy ? 'Memproses...' : isRegister ? 'Buat akun' : 'Masuk ke Fintrack' }} <ArrowRight :size="17" /></button>
        </form>

        <p class="switch-auth">{{ isRegister ? 'Sudah punya akun?' : 'Belum punya akun?' }} <button type="button" @click="isRegister = !isRegister; errorMessage = ''; successMessage = ''">{{ isRegister ? 'Masuk' : 'Daftar gratis' }}</button></p>
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
.input-wrap{display:flex;height:42px;align-items:center;gap:9px;padding:0 11px;border:1px solid var(--border);border-radius:7px;background:var(--surface-muted);color:var(--muted)}.input-wrap:focus-within{border-color:var(--green)}.input-wrap input{width:100%;height:100%;border:0;outline:0;background:transparent;font-size:11px}.password-toggle{display:grid;width:25px;height:25px;flex:none;place-items:center;background:transparent;color:var(--muted)}
.login-submit{height:42px;margin-top:8px}.switch-auth{margin:20px 0;color:var(--muted);font-size:10px;text-align:center}.switch-auth button{padding:0;background:transparent;color:var(--green);font-size:10px;font-weight:700}.secure-note{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:37px;color:var(--muted);font-size:9px}
@media(max-width:760px){.login-page{grid-template-columns:1fr}.login-visual{display:none}.login-form-wrap{min-height:100vh;padding:32px 24px}.login-mobile-brand{display:flex}.login-form{max-width:390px}.login-form h2{font-size:25px}}
</style>
