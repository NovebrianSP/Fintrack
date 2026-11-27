<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check,
  ChevronDown, CreditCard, Filter, LayoutDashboard,
  Leaf, LogOut, Menu, Moon, Plus, Settings2, ShieldCheck, Sun, Target,
  TrendingUp, Wallet, X, Trash2, Pencil, PiggyBank,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { budgetDefaults, savingDefaults, type MonthlyBudget, type MonthlySaving, type Transaction, type TransactionType } from '@/types/finance'
import { currentDate, formatDate, formatRupiah } from '@/utils/formatters'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'vue-router'

type Section = 'overview' | 'transactions' | 'savings'
const auth = useAuthStore()
const router = useRouter()
const section = ref<Section>('overview')
const now = new Date()
const selectedMonth = ref(now.getMonth() + 1)
const selectedYear = ref(now.getFullYear())
const currentYear = now.getFullYear()
const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const yearOptions = Array.from({ length: 6 }, (_item, index) => currentYear - 2 + index)
const theme = ref<'light' | 'dark'>(localStorage.getItem('fintrack-theme') === 'dark' ? 'dark' : 'light')
const mobileMenuOpen = ref(false)
const busy = ref(false)
const pageError = ref('')
const toastMessage = ref('')
const transactions = ref<Transaction[]>([])
const budgets = ref<MonthlyBudget[]>([])
const savings = ref<MonthlySaving[]>([])
const modalOpen = ref(false)
const editingTransactionId = ref<string | null>(null)
const formError = ref('')
const form = reactive({
  transaction_date: currentDate(),
  type: 'Pengeluaran' as TransactionType,
  category: 'Makan',
  title: '',
  amount: '',
  notes: '',
})
const savedInputs = reactive<Record<number, string>>({})

const isDark = computed(() => theme.value === 'dark')
const selectedMonthName = computed(() => monthNames[selectedMonth.value - 1] ?? monthNames[0])

async function loadData() {
  pageError.value = ''
  if (!supabase) {
    transactions.value = []
    budgets.value = []
    savings.value = []
    pageError.value = 'Koneksi Supabase belum dikonfigurasi. Silakan hubungi administrator.'
    return
  }
  busy.value = true
  const start = `${selectedYear.value}-01-01`
  const end = `${selectedYear.value + 1}-01-01`
  try {
    const [transactionResult, budgetResult, savingResult] = await Promise.all([
      supabase.from('transactions').select('*').gte('transaction_date', start).lt('transaction_date', end).order('transaction_date', { ascending: false }),
      supabase.from('monthly_budgets').select('*').eq('year', selectedYear.value),
      supabase.from('monthly_savings').select('*').eq('year', selectedYear.value),
    ])
    if (transactionResult.error) throw transactionResult.error
    if (budgetResult.error) throw budgetResult.error
    if (savingResult.error) throw savingResult.error
    transactions.value = transactionResult.data as Transaction[]
    budgets.value = budgetResult.data as MonthlyBudget[]
    savings.value = savingResult.data as MonthlySaving[]
    if (!budgets.value.some((budget) => budget.month === selectedMonth.value)) {
      const monthDefaults = budgetDefaults.map((budget) => ({
        ...budget, month: selectedMonth.value, year: selectedYear.value,
      }))
      const { error } = await supabase.from('monthly_budgets').upsert(
        monthDefaults.map((budget) => ({ ...budget, user_id: auth.session?.user.id })),
        { onConflict: 'user_id,month,year,category' },
      )
      if (error) throw error
      budgets.value.push(...monthDefaults)
    }
  } catch (error) {
    console.error('Gagal memuat data keuangan:', error)
    pageError.value = error instanceof Error ? `Tidak dapat memuat data Supabase: ${error.message}` : 'Tidak dapat memuat data Supabase.'
  } finally {
    busy.value = false
  }
}

watch([selectedMonth, selectedYear], () => {
  Object.keys(savedInputs).forEach((month) => { delete savedInputs[Number(month)] })
  void loadData()
})
watch(theme, (value) => {
  document.documentElement.classList.toggle('dark', value === 'dark')
  localStorage.setItem('fintrack-theme', value)
}, { immediate: true })
onMounted(() => { void loadData() })

const visibleTransactions = computed(() =>
  transactions.value
    .filter((item) => Number(item.transaction_date.slice(5, 7)) === selectedMonth.value && Number(item.transaction_date.slice(0, 4)) === selectedYear.value)
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || (a.created_at ?? '').localeCompare(b.created_at ?? '')),
)
const transactionBalances = computed(() => {
  let balance = 0
  const balances = new Map<string, number>()
  visibleTransactions.value.forEach((item) => {
    balance += item.type === 'Pemasukan' ? Number(item.amount) : -Number(item.amount)
    balances.set(item.id, balance)
  })
  return balances
})
const recentTransactions = computed(() => [...visibleTransactions.value].reverse().slice(0, 5))
const totalIncome = computed(() => visibleTransactions.value.filter((item) => item.type === 'Pemasukan').reduce((sum, item) => sum + Number(item.amount), 0))
const totalExpense = computed(() => visibleTransactions.value.filter((item) => item.type === 'Pengeluaran').reduce((sum, item) => sum + Number(item.amount), 0))
const cashBalance = computed(() => totalIncome.value - totalExpense.value)
const totalBudget = computed(() => budgetProgress.value.reduce((sum, item) => sum + item.target_amount, 0))
const distributable = computed(() => Math.max(totalIncome.value - totalBudget.value, 0))
const totalSaved = computed(() => savings.value.filter((item) => item.month === selectedMonth.value).reduce((sum, item) => sum + Number(item.saved_amount), 0))
const budgetProgress = computed(() => budgetDefaults.map((budget) => {
  const targetAmount = budgets.value.find((item) => item.month === selectedMonth.value && item.category === budget.category)?.target_amount ?? budget.target_amount
  const spent = visibleTransactions.value
    .filter((item) => item.type === 'Pengeluaran' && item.category === budget.category)
    .reduce((sum, item) => sum + Number(item.amount), 0)
  return { ...budget, target_amount: targetAmount, spent, remaining: targetAmount - spent, percent: targetAmount ? Math.min(spent / targetAmount * 100, 100) : 0 }
}))
function targetForMonth(month: number): number {
  const monthIncome = transactions.value
    .filter((item) => item.type === 'Pemasukan' && Number(item.transaction_date.slice(5, 7)) === month && Number(item.transaction_date.slice(0, 4)) === selectedYear.value)
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const monthBudget = budgetDefaults.reduce((sum, item) => {
    const target = budgets.value.find((budget) => budget.month === month && budget.category === item.category)?.target_amount ?? item.target_amount
    return sum + target
  }, 0)
  return Math.max(monthIncome - monthBudget, 0)
}
const monthlySavingTotals = computed(() => monthNames.map((name, index) => {
  const month = index + 1
  const rows = savings.value.filter((item) => item.month === month)
  const totalSavedForMonth = rows.reduce((sum, item) => sum + Number(item.saved_amount), 0)
  const target = rows.length ? rows.reduce((sum, item) => sum + Number(item.target_amount), 0) : targetForMonth(month)
  return { month, name, target, saved: totalSavedForMonth }
}))
const savingPostTotals = computed(() => savingDefaults.map((post) => ({
  ...post,
  total: savings.value.filter((item) => item.allocation_post === post.allocation_post).reduce((sum, item) => sum + Number(item.saved_amount), 0),
})))
const annualTotalSaved = computed(() => monthlySavingTotals.value.reduce((sum, item) => sum + item.saved, 0))
const savingRate = computed(() => totalIncome.value ? Math.round(totalSaved.value / totalIncome.value * 100) : 0)

function setSection(value: Section) {
  section.value = value
  mobileMenuOpen.value = false
}

function showToast(message: string) {
  toastMessage.value = message
  window.setTimeout(() => { toastMessage.value = '' }, 3000)
}

function openTransaction(item?: Transaction) {
  formError.value = ''
  if (item) {
    editingTransactionId.value = item.id
    form.transaction_date = item.transaction_date
    form.type = item.type
    form.category = item.category
    form.title = item.title
    form.amount = String(item.amount)
    form.notes = item.notes ?? ''
  } else {
    editingTransactionId.value = null
    form.transaction_date = currentDate()
    form.type = 'Pengeluaran'
    form.category = 'Makan'
    form.title = ''
    form.amount = ''
    form.notes = ''
  }
  modalOpen.value = true
}

async function saveTransaction() {
  const amount = Number(form.amount)
  if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
    formError.value = 'Isi keterangan dan nominal yang valid terlebih dahulu.'
    return
  }
  const payload = {
    transaction_date: form.transaction_date,
    type: form.type,
    category: form.type === 'Pemasukan' ? 'Uang Saku Magang' : form.category,
    title: form.title.trim(),
    amount,
    notes: form.notes.trim() || null,
  }
  busy.value = true
  try {
    if (!supabase || !auth.session) throw new Error('Sesi login tidak tersedia. Silakan masuk kembali.')
    if (editingTransactionId.value) {
      const { data, error } = await supabase.from('transactions').update(payload).eq('id', editingTransactionId.value).select().single()
      if (error) throw error
      transactions.value = transactions.value.map((item) => item.id === editingTransactionId.value ? data as Transaction : item)
    } else {
      const { data, error } = await supabase.from('transactions').insert({ ...payload, user_id: auth.session.user.id }).select().single()
      if (error) throw error
      transactions.value.push(data as Transaction)
    }
    modalOpen.value = false
    showToast(editingTransactionId.value ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil ditambahkan.')
  } catch (error) {
    console.error('Gagal menyimpan transaksi:', error)
    formError.value = error instanceof Error ? `Transaksi gagal disimpan: ${error.message}` : 'Transaksi gagal disimpan.'
  } finally {
    busy.value = false
  }
}

async function deleteTransaction(item: Transaction) {
  try {
    if (!supabase || !auth.session) throw new Error('Sesi login tidak tersedia. Silakan masuk kembali.')
    const { error } = await supabase.from('transactions').delete().eq('id', item.id)
    if (error) throw error
    transactions.value = transactions.value.filter((transaction) => transaction.id !== item.id)
    showToast('Transaksi dihapus.')
  } catch (error) {
    console.error('Gagal menghapus transaksi:', error)
    pageError.value = error instanceof Error ? `Transaksi gagal dihapus: ${error.message}` : 'Transaksi gagal dihapus.'
  }
}

async function updateMonthlySaving(month: number) {
  const value = Number(savedInputs[month] ?? monthlySavingTotals.value[month - 1]?.saved ?? 0)
  if (!Number.isFinite(value) || value < 0) {
    showToast('Masukkan nominal tabungan yang valid.')
    return
  }
  const rows: MonthlySaving[] = savingDefaults.map((post, index) => ({
    month,
    year: selectedYear.value,
    allocation_post: post.allocation_post,
    target_percentage: post.target_percentage,
    target_amount: Math.round(targetForMonth(month) * post.target_percentage),
    saved_amount: index === savingDefaults.length - 1
      ? value - savingDefaults.slice(0, -1).reduce((sum, part) => sum + Math.round(value * part.target_percentage), 0)
      : Math.round(value * post.target_percentage),
    storage_note: null,
  }))
  try {
    if (!supabase || !auth.session) throw new Error('Sesi login tidak tersedia. Silakan masuk kembali.')
    const values = rows.map((row) => ({ ...row, user_id: auth.session?.user.id }))
    const { error } = await supabase.from('monthly_savings').upsert(values, { onConflict: 'user_id,month,year,allocation_post' })
    if (error) throw error
    savings.value = savings.value.filter((item) => item.month !== month).concat(rows)
    showToast(`Tabungan ${monthNames[month - 1]} tersimpan.`)
  } catch (error) {
    console.error('Gagal menyimpan tabungan:', error)
    pageError.value = error instanceof Error ? `Tabungan gagal disimpan: ${error.message}` : 'Tabungan gagal disimpan.'
  }
}

async function signOut() {
  try {
    await auth.signOut()
    transactions.value = []
    budgets.value = []
    savings.value = []
    await router.replace({ name: 'login' })
  } catch (error) {
    pageError.value = error instanceof Error ? `Gagal keluar: ${error.message}` : 'Gagal keluar dari akun.'
  }
}

function categoryColor(category: string) {
  if (category === 'Sewa Kos') return 'mint'
  if (category === 'Makan') return 'orange'
  if (category === 'Air Mineral') return 'blue'
  if (category === 'Token Listrik Kos') return 'yellow'
  if (category.includes('Uang Saku')) return 'green'
  return 'purple'
}

function monthInput(month: number): string {
  return savedInputs[month] ?? String(monthlySavingTotals.value[month - 1]?.saved ?? 0)
}

function setSavedInput(month: number, event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement) savedInputs[month] = target.value
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ 'sidebar-open': mobileMenuOpen }">
      <a class="brand" href="#" @click.prevent="setSection('overview')"><span class="brand-icon"><Leaf :size="19" /></span> fintrack</a>
      <div class="workspace-label">WORKSPACE</div>
      <nav class="side-nav" aria-label="Navigasi utama">
        <button :class="{ active: section === 'overview' }" @click="setSection('overview')"><LayoutDashboard :size="18" /> Ringkasan</button>
        <button :class="{ active: section === 'transactions' }" @click="setSection('transactions')"><CreditCard :size="18" /> Transaksi <span class="nav-dot"></span></button>
        <button :class="{ active: section === 'savings' }" @click="setSection('savings')"><PiggyBank :size="18" /> Tabungan</button>
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-tip">
        <div class="tip-icon"><ShieldCheck :size="18" /></div>
        <strong>Selangkah lebih baik</strong>
        <p>Kebiasaan kecil mengelola uang, dampak besar untuk masa depan.</p>
        <button @click="setSection('savings')">Lihat progres <ArrowRight :size="14" /></button>
      </div>
      <div class="sidebar-bottom">
        <div class="avatar">{{ auth.session?.user.email?.slice(0, 1).toUpperCase() ?? 'U' }}</div>
        <div class="profile-copy"><strong>{{ auth.session?.user.email?.split('@')[0] ?? 'Pengguna' }}</strong><span>Akun personal</span></div>
        <button class="icon-button profile-menu" aria-label="Keluar" @click="signOut"><LogOut :size="17" /></button>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <button class="icon-button mobile-menu-button" aria-label="Buka menu" @click="mobileMenuOpen = !mobileMenuOpen"><Menu :size="20" /></button>
        <div class="breadcrumb"><span>Workspace</span><span class="crumb-separator">/</span><strong>{{ section === 'overview' ? 'Ringkasan' : section === 'transactions' ? 'Transaksi' : 'Tabungan' }}</strong></div>
        <div class="top-actions">
          <div class="sync-state"><span class="sync-indicator"></span>Supabase aktif</div>
          <button class="icon-button theme-toggle" :aria-label="isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'" @click="theme = isDark ? 'light' : 'dark'"><Sun v-if="isDark" :size="18" /><Moon v-else :size="18" /></button>
          <button class="icon-button notification-button" aria-label="Notifikasi" @click="showToast('Kamu sudah mengetahui semua kabar terbaru.')"><Bell :size="18" /><i></i></button>
          <div class="top-avatar">{{ auth.session?.user.email?.slice(0, 1).toUpperCase() ?? 'A' }}</div>
        </div>
      </header>

      <section class="page-wrap">
        <div v-if="pageError" class="alert-banner"><span>{{ pageError }}</span><button aria-label="Tutup pesan" @click="pageError = ''"><X :size="16" /></button></div>
        <div class="page-heading">
          <div>
            <div class="greeting">{{ new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(now) }}</div>
            <h1>{{ section === 'overview' ? 'Ruang finansialmu' : section === 'transactions' ? 'Catatan transaksi' : 'Rencana tabungan' }}<span class="heading-period">.</span></h1>
            <p>{{ section === 'overview' ? 'Sedikit lebih dekat dengan tujuanmu hari ini.' : section === 'transactions' ? 'Semua arus uangmu, tercatat rapi.' : 'Lihat tabunganmu tumbuh, bulan demi bulan.' }}</p>
          </div>
          <div class="heading-actions">
            <label class="period-select"><CalendarDays :size="16" /><select v-model.number="selectedMonth" aria-label="Pilih bulan"><option v-for="(month, index) in monthNames" :key="month" :value="index + 1">{{ month }}</option></select><ChevronDown :size="14" /></label>
            <label class="period-select year-select"><select v-model.number="selectedYear" aria-label="Pilih tahun"><option v-for="year in yearOptions" :key="year" :value="year">{{ year }}</option></select><ChevronDown :size="14" /></label>
            <button class="primary-button add-button" @click="openTransaction()"><Plus :size="17" /> Catat transaksi</button>
          </div>
        </div>

        <template v-if="section === 'overview'">
          <div class="summary-grid">
            <article class="summary-card">
              <div class="summary-top"><span class="summary-label">Total pemasukan</span><span class="summary-icon income-icon"><ArrowDownLeft :size="18" /></span></div>
              <div class="summary-value">{{ formatRupiah(totalIncome) }}</div>
              <div class="summary-foot"><span class="status-pill positive"><TrendingUp :size="13" /> Bulan ini</span><span class="summary-caption">Uang saku & pemasukan</span></div>
              <div class="sparkline income-spark"><svg viewBox="0 0 160 38" preserveAspectRatio="none"><path d="M0 29 C18 26 19 17 34 21 S54 30 68 18 S91 21 104 13 S126 19 140 7 S151 9 160 3" /></svg></div>
            </article>
            <article class="summary-card">
              <div class="summary-top"><span class="summary-label">Total pengeluaran</span><span class="summary-icon expense-icon"><ArrowUpRight :size="18" /></span></div>
              <div class="summary-value">{{ formatRupiah(totalExpense) }}</div>
              <div class="summary-foot"><span class="status-pill neutral"><Wallet :size="13" /> {{ totalIncome ? Math.round(totalExpense / totalIncome * 100) : 0 }}%</span><span class="summary-caption">dari pemasukan</span></div>
              <div class="sparkline expense-spark"><svg viewBox="0 0 160 38" preserveAspectRatio="none"><path d="M0 8 C18 14 22 5 38 16 S56 8 71 22 S94 10 108 20 S126 14 142 30 S153 21 160 34" /></svg></div>
            </article>
            <article class="summary-card balance-card">
              <div class="summary-top"><span class="summary-label">Saldo kas aktif</span><span class="summary-icon balance-icon"><Wallet :size="18" /></span></div>
              <div class="summary-value">{{ formatRupiah(cashBalance) }}</div>
              <div class="summary-foot"><span class="status-pill positive"><Check :size="13" /> Tersedia</span><span class="summary-caption">setelah pengeluaran</span></div>
              <div class="sparkline balance-spark"><svg viewBox="0 0 160 38" preserveAspectRatio="none"><path d="M0 31 C17 28 20 24 34 26 S52 13 68 19 S84 9 102 15 S126 4 139 12 S151 4 160 2" /></svg></div>
            </article>
          </div>

          <div class="dashboard-grid">
            <section class="panel budget-panel">
              <div class="panel-heading">
                <div><div class="panel-kicker"><Target :size="15" /> ANGGARAN WAJIB KOS</div><h2>Jaga pengeluaran tetap seimbang</h2></div>
                <button class="subtle-button" @click="setSection('transactions')">Semua transaksi <ArrowRight :size="14" /></button>
              </div>
              <div class="budget-overview"><div><strong>{{ formatRupiah(budgetProgress.reduce((sum, item) => sum + item.spent, 0)) }}</strong><span> dari {{ formatRupiah(totalBudget) }} terpakai</span></div><div class="budget-total-pill">{{ Math.round(budgetProgress.reduce((sum, item) => sum + item.spent, 0) / totalBudget * 100) }}% terpakai</div></div>
              <div class="budget-list">
                <div v-for="budget in budgetProgress" :key="budget.category" class="budget-item">
                  <div class="budget-item-head"><span class="category-mark" :class="categoryColor(budget.category)"></span><strong>{{ budget.category }}</strong><span class="budget-values">{{ formatRupiah(budget.spent) }} <i>/</i> {{ formatRupiah(budget.target_amount) }}</span></div>
                  <div class="progress-track"><div class="progress-value" :class="{ over: budget.remaining < 0 }" :style="{ width: `${budget.percent}%` }"></div></div>
                  <div class="budget-item-foot" :class="{ 'over-text': budget.remaining < 0 }">{{ budget.remaining >= 0 ? `Hemat ${formatRupiah(budget.remaining)}` : `Melebihi ${formatRupiah(Math.abs(budget.remaining))}` }}<span>{{ Math.round(budget.spent / budget.target_amount * 100) }}%</span></div>
                </div>
              </div>
            </section>

            <section class="panel savings-panel">
              <div class="panel-heading">
                <div><div class="panel-kicker"><PiggyBank :size="15" /> TABUNGAN BULANAN</div><h2>Tabunganmu bertumbuh</h2></div>
                <button class="icon-button more-button" aria-label="Lihat tabungan" @click="setSection('savings')"><ArrowRight :size="17" /></button>
              </div>
              <div class="savings-highlight"><div><span class="muted-copy">Terkumpul bulan ini</span><div class="highlight-amount">{{ formatRupiah(totalSaved) }}</div></div><div class="saving-ring" :style="{ '--ring-progress': `${Math.min(savingRate, 100)}%` }"><span>{{ savingRate }}<small>%</small></span></div></div>
              <div class="saving-subtitle"><span>Target alokasi</span><strong>{{ formatRupiah(distributable) }}</strong></div>
              <div class="saving-distributions">
                <div v-for="post in savingDefaults" :key="post.allocation_post" class="distribution-row">
                  <span class="distribution-dot" :class="categoryColor(post.allocation_post)"></span><span>{{ post.allocation_post }}</span><strong>{{ Math.round(post.target_percentage * 100) }}%</strong>
                </div>
              </div>
              <button class="wide-link" @click="setSection('savings')">Lihat rekap tahunan <ArrowRight :size="15" /></button>
            </section>
          </div>

          <section class="panel transactions-panel">
            <div class="panel-heading transaction-heading">
              <div><div class="panel-kicker"><CreditCard :size="15" /> AKTIVITAS TERBARU</div><h2>Transaksi terakhir</h2></div>
              <button class="subtle-button" @click="setSection('transactions')">Lihat semua <ArrowRight :size="14" /></button>
            </div>
            <div v-if="recentTransactions.length" class="transaction-table-wrap">
              <table class="transaction-table"><thead><tr><th>TRANSAKSI</th><th>KATEGORI</th><th>TANGGAL</th><th>JUMLAH</th><th></th></tr></thead>
                <tbody><tr v-for="item in recentTransactions" :key="item.id">
                  <td><div class="transaction-name"><span class="transaction-icon" :class="item.type === 'Pemasukan' ? 'tx-income' : categoryColor(item.category)"><ArrowDownLeft v-if="item.type === 'Pemasukan'" :size="16" /><ArrowUpRight v-else :size="16" /></span><div><strong>{{ item.title }}</strong><small>{{ item.notes || (item.type === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran') }}</small></div></div></td>
                  <td><span class="category-chip" :class="categoryColor(item.category)">{{ item.category }}</span></td><td class="muted-cell">{{ formatDate(item.transaction_date, { day: 'numeric', month: 'short' }) }}</td>
                  <td class="amount-cell" :class="item.type === 'Pemasukan' ? 'amount-positive' : ''">{{ item.type === 'Pemasukan' ? '+' : '−' }}{{ formatRupiah(item.amount) }}</td><td><button class="row-menu icon-button" aria-label="Edit transaksi" @click="openTransaction(item)"><Pencil :size="15" /></button></td>
                </tr></tbody>
              </table>
            </div>
            <div v-else class="empty-state">Belum ada transaksi di bulan ini. <button @click="openTransaction()">Catat transaksi pertama</button></div>
          </section>
          <div class="footer-note"><ShieldCheck :size="14" /> Data keuanganmu tetap privat dan aman.</div>
        </template>

        <template v-else-if="section === 'transactions'">
          <div class="transaction-stats">
            <div class="mini-stat"><span class="mini-stat-icon green"><ArrowDownLeft :size="17" /></span><div><span>Pemasukan</span><strong>{{ formatRupiah(totalIncome) }}</strong></div></div>
            <div class="mini-stat"><span class="mini-stat-icon coral"><ArrowUpRight :size="17" /></span><div><span>Pengeluaran</span><strong>{{ formatRupiah(totalExpense) }}</strong></div></div>
            <div class="mini-stat"><span class="mini-stat-icon blue"><Wallet :size="17" /></span><div><span>Saldo kas</span><strong>{{ formatRupiah(cashBalance) }}</strong></div></div>
          </div>
          <section class="panel transactions-panel full-transactions">
            <div class="panel-heading transaction-heading"><div><div class="panel-kicker"><CreditCard :size="15" /> RIWAYAT HARIAN</div><h2>{{ selectedMonthName }} {{ selectedYear }}</h2></div><div class="table-actions"><span class="record-count">{{ visibleTransactions.length }} transaksi</span><button class="filter-button" @click="showToast('Gunakan pemilih bulan di atas untuk memfilter transaksi.')"><Filter :size="15" /> Filter</button><button class="primary-button compact-button" @click="openTransaction()"><Plus :size="16" /> Tambah</button></div></div>
            <div v-if="visibleTransactions.length" class="transaction-table-wrap">
              <table class="transaction-table full-table"><thead><tr><th>TRANSAKSI</th><th>KATEGORI</th><th>TANGGAL</th><th>JUMLAH</th><th>SALDO BERJALAN</th><th></th></tr></thead>
                <tbody><tr v-for="item in [...visibleTransactions].reverse()" :key="item.id">
                  <td><div class="transaction-name"><span class="transaction-icon" :class="item.type === 'Pemasukan' ? 'tx-income' : categoryColor(item.category)"><ArrowDownLeft v-if="item.type === 'Pemasukan'" :size="16" /><ArrowUpRight v-else :size="16" /></span><div><strong>{{ item.title }}</strong><small>{{ item.notes || item.type }}</small></div></div></td>
                  <td><span class="category-chip" :class="categoryColor(item.category)">{{ item.category }}</span></td><td class="muted-cell">{{ formatDate(item.transaction_date) }}</td>
                  <td class="amount-cell" :class="item.type === 'Pemasukan' ? 'amount-positive' : ''">{{ item.type === 'Pemasukan' ? '+' : '−' }}{{ formatRupiah(item.amount) }}</td>
                  <td class="balance-cell">{{ formatRupiah(transactionBalances.get(item.id) ?? 0) }}</td>
                  <td><div class="row-actions"><button class="icon-button" aria-label="Edit transaksi" @click="openTransaction(item)"><Pencil :size="15" /></button><button class="icon-button delete-action" aria-label="Hapus transaksi" @click="deleteTransaction(item)"><Trash2 :size="15" /></button></div></td>
                </tr></tbody>
              </table>
            </div>
            <div v-else class="empty-state">Belum ada transaksi di bulan ini. <button @click="openTransaction()">Catat transaksi pertama</button></div>
          </section>
          <section class="panel budget-panel transactions-budget">
            <div class="panel-heading"><div><div class="panel-kicker"><Target :size="15" /> PROGRES ANGGARAN WAJIB</div><h2>Target kos bulan ini</h2></div><span class="record-count">Total target {{ formatRupiah(totalBudget) }}</span></div>
            <div class="budget-progress-grid"><div v-for="budget in budgetProgress" :key="budget.category" class="budget-item"><div class="budget-item-head"><span class="category-mark" :class="categoryColor(budget.category)"></span><strong>{{ budget.category }}</strong></div><div class="progress-track"><div class="progress-value" :class="{ over: budget.remaining < 0 }" :style="{ width: `${budget.percent}%` }"></div></div><div class="budget-item-foot">{{ formatRupiah(budget.spent) }} / {{ formatRupiah(budget.target_amount) }}<span :class="{ 'over-text': budget.remaining < 0 }">{{ budget.remaining >= 0 ? `Sisa ${formatRupiah(budget.remaining)}` : `Lebih ${formatRupiah(Math.abs(budget.remaining))}` }}</span></div></div></div>
          </section>
        </template>

        <template v-else>
          <div class="savings-year-summary">
            <article class="annual-total-card"><div class="annual-icon"><PiggyBank :size="20" /></div><div><span>Total tabungan terkumpul · {{ selectedYear }}</span><strong>{{ formatRupiah(annualTotalSaved) }}</strong><small><TrendingUp :size="13" /> Terus tumbuh, satu bulan demi satu bulan</small></div><div class="annual-decoration"><span></span><span></span><span></span><span></span><span></span></div></article>
            <div class="saving-post-cards"><article v-for="post in savingPostTotals" :key="post.allocation_post" class="saving-post-card"><span class="distribution-dot" :class="categoryColor(post.allocation_post)"></span><span>{{ post.allocation_post }}</span><strong>{{ formatRupiah(post.total) }}</strong><small>Target {{ Math.round(post.target_percentage * 100) }}% per bulan</small></article></div>
          </div>
          <section class="panel annual-table-panel">
            <div class="panel-heading annual-table-heading"><div><div class="panel-kicker"><CalendarDays :size="15" /> REKAP TAHUNAN</div><h2>Perjalanan tabunganmu</h2><p>Masukkan total setoran bulanan untuk memperbarui alokasi ke empat pos.</p></div><span class="year-badge">{{ selectedYear }}</span></div>
            <div class="annual-table-wrap"><table class="annual-table"><thead><tr><th>BULAN</th><th>TARGET ALOKASI</th><th>TERKUMPUL</th><th>PROGRES</th><th>PERBARUI SETORAN</th></tr></thead><tbody>
              <tr v-for="item in monthlySavingTotals" :key="item.month"><td><strong>{{ item.name }}</strong><span class="month-year">{{ selectedYear }}</span></td><td class="muted-cell">{{ formatRupiah(item.target) }}</td><td class="amount-cell">{{ formatRupiah(item.saved) }}</td><td><div class="annual-progress"><span class="progress-track"><span class="progress-value" :style="{ width: `${Math.min(item.saved / item.target * 100, 100)}%` }"></span></span><small>{{ item.target ? Math.min(Math.round(item.saved / item.target * 100), 100) : 0 }}%</small></div></td><td><div class="saving-input-cell"><input :value="monthInput(item.month)" type="number" min="0" step="10000" :aria-label="`Setoran bulan ${item.name}`" @input="setSavedInput(item.month, $event)" /><button class="save-row-button" aria-label="Simpan setoran" @click="updateMonthlySaving(item.month)"><Check :size="15" /></button></div></td></tr>
            </tbody></table></div>
            <div class="allocation-note"><div class="allocation-note-icon"><Settings2 :size="17" /></div><div><strong>Alokasi otomatis berdasarkan sisa dana</strong><p>Sisa dana siap dialokasikan bulan ini <b>{{ formatRupiah(distributable) }}</b>. Setoran dibagi otomatis sesuai target: Dana Darurat 40%, Tabungan Utama 35%, Kebutuhan Pribadi & Transport 15%, dan Self-Reward / Cadangan 10%.</p></div></div>
          </section>
        </template>
      </section>
      <nav class="mobile-bottom-nav" aria-label="Navigasi mobile">
        <button :class="{ active: section === 'overview' }" @click="setSection('overview')"><LayoutDashboard :size="19" /><span>Ringkasan</span></button><button :class="{ active: section === 'transactions' }" @click="setSection('transactions')"><CreditCard :size="19" /><span>Transaksi</span></button><button :class="{ active: section === 'savings' }" @click="setSection('savings')"><PiggyBank :size="19" /><span>Tabungan</span></button><button @click="openTransaction()"><Plus :size="19" /><span>Catat</span></button>
      </nav>
    </main>

    <Transition name="fade"><div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false"><section class="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-heading"><div><div class="panel-kicker"><CreditCard :size="15" /> TRANSAKSI BARU</div><h2 id="modal-title">{{ editingTransactionId ? 'Edit transaksi' : 'Catat transaksi' }}</h2></div><button class="icon-button" aria-label="Tutup dialog" @click="modalOpen = false"><X :size="19" /></button></div>
      <form class="transaction-form" @submit.prevent="saveTransaction">
        <div class="type-toggle"><button type="button" :class="{ selected: form.type === 'Pengeluaran' }" @click="form.type = 'Pengeluaran'"><ArrowUpRight :size="16" /> Pengeluaran</button><button type="button" :class="{ selected: form.type === 'Pemasukan' }" @click="form.type = 'Pemasukan'"><ArrowDownLeft :size="16" /> Pemasukan</button></div>
        <label>Tanggal<input v-model="form.transaction_date" type="date" required /></label>
        <label v-if="form.type === 'Pengeluaran'">Kategori<select v-model="form.category"><option v-for="category in ['Sewa Kos', 'Makan', 'Air Mineral', 'Token Listrik Kos', 'Kebutuhan Pribadi', 'Transportasi', 'Lainnya']" :key="category">{{ category }}</option></select></label>
        <label>Keterangan<input v-model="form.title" type="text" placeholder="Contoh: Makan siang" maxlength="80" required /></label>
        <label>Nominal (Rp)<input v-model="form.amount" type="number" min="1" step="1" placeholder="0" required /></label>
        <label>Catatan tambahan <span class="optional">(opsional)</span><input v-model="form.notes" type="text" placeholder="Tambahkan detail transaksi" maxlength="200" /></label>
        <p v-if="formError" class="form-message error-message">{{ formError }}</p>
        <div class="modal-actions"><button class="cancel-button" type="button" @click="modalOpen = false">Batal</button><button class="primary-button" type="submit" :disabled="busy">{{ busy ? 'Menyimpan...' : editingTransactionId ? 'Simpan perubahan' : 'Simpan transaksi' }} <ArrowRight :size="16" /></button></div>
      </form>
    </section></div></Transition>
    <Transition name="toast"><div v-if="toastMessage" class="toast-message"><Check :size="16" />{{ toastMessage }}</div></Transition>
  </div>
</template>

<style scoped>
.app-shell{min-height:100vh;background:var(--page);color:var(--text)}
.sidebar{position:fixed;inset:0 auto 0 0;z-index:20;display:flex;width:250px;flex-direction:column;padding:27px 19px 16px;background:var(--surface);border-right:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:9px;color:var(--text);font-family:Manrope,sans-serif;font-size:20px;font-weight:800;letter-spacing:-.8px}
.brand-icon{display:grid;width:29px;height:29px;place-items:center;border-radius:9px;background:#e8f4ec;color:#218357}
.workspace-label{margin:44px 0 11px 9px;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:1.15px}
.side-nav{display:grid;gap:5px}.side-nav button{position:relative;display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;border-radius:8px;background:transparent;color:var(--muted);text-align:left;font-size:13px;font-weight:600;transition:.18s}
.side-nav button:hover{background:var(--surface-muted);color:var(--text)}.side-nav button.active{background:var(--green-soft);color:var(--green-dark)}.nav-dot{width:6px;height:6px;margin-left:auto;border-radius:50%;background:#c9d1cc}
.sidebar-spacer{flex:1}
.sidebar-tip{padding:15px 14px 14px;border:1px solid var(--border);border-radius:11px;background:var(--surface-muted)}.tip-icon{display:grid;width:30px;height:30px;place-items:center;margin-bottom:12px;border-radius:9px;background:var(--green-soft);color:var(--green)}.sidebar-tip strong{font-size:12px}.sidebar-tip p{margin:6px 0 11px;color:var(--muted);font-size:11px;line-height:1.65}.sidebar-tip button{display:flex;align-items:center;gap:5px;padding:0;background:transparent;color:var(--green);font-size:11px;font-weight:700}
.sidebar-bottom{display:flex;align-items:center;gap:10px;margin-top:17px;padding:15px 2px 0;border-top:1px solid var(--border)}.avatar,.top-avatar{display:grid;width:32px;height:32px;flex:none;place-items:center;border-radius:50%;background:#dcefe3;color:#23774f;font-size:12px;font-weight:700}.profile-copy{display:grid;min-width:0;gap:2px}.profile-copy strong{overflow:hidden;color:var(--text);font-size:11px;text-overflow:ellipsis}.profile-copy span{color:var(--muted);font-size:10px}.profile-menu{margin-left:auto}
.main-content{min-height:100vh;margin-left:250px}
.topbar{position:sticky;top:0;z-index:10;display:flex;height:65px;align-items:center;justify-content:space-between;padding:0 40px;border-bottom:1px solid var(--border);background:var(--surface)}
.breadcrumb{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:12px}.crumb-separator{color:#c3cbc5}.breadcrumb strong{color:var(--text);font-weight:600}
.top-actions{display:flex;align-items:center;gap:17px}.sync-state{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:11px}.sync-indicator{width:7px;height:7px;border-radius:50%;background:#52b980;box-shadow:0 0 0 3px #52b9801c}.icon-button{display:grid;width:32px;height:32px;flex:none;place-items:center;border-radius:8px;background:transparent;color:var(--muted);transition:.16s}.icon-button:hover{background:var(--surface-muted);color:var(--text)}.notification-button{position:relative}.notification-button i{position:absolute;top:6px;right:6px;width:6px;height:6px;border:1px solid var(--surface);border-radius:50%;background:#e78368}.top-avatar{width:29px;height:29px}
.mobile-menu-button,.mobile-bottom-nav{display:none}
.page-wrap{width:min(1200px,100%);margin:0 auto;padding:34px 40px 30px}
.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:27px}.greeting{margin-bottom:6px;color:var(--muted);font-size:11px;font-weight:500;letter-spacing:.15px}.page-heading h1{margin:0;font-family:Manrope,sans-serif;font-size:27px;font-weight:750;letter-spacing:-1.1px}.heading-period{color:var(--green)}.page-heading p{margin:5px 0 0;color:var(--muted);font-size:12px}.heading-actions{display:flex;align-items:center;gap:8px}.period-select{display:flex;height:37px;align-items:center;gap:7px;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--muted)}.period-select select{width:86px;appearance:none;border:0;outline:0;background:transparent;color:var(--text);font-size:11px;font-weight:600}.year-select select{width:45px}.primary-button{display:inline-flex;min-height:37px;align-items:center;justify-content:center;gap:7px;padding:0 13px;border-radius:7px;background:var(--green);color:white;font-size:11px;font-weight:700;transition:background .16s,transform .16s}.primary-button:hover{background:var(--green-dark);transform:translateY(-1px)}.primary-button:disabled{cursor:wait;opacity:.65}.add-button{margin-left:3px}
.summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin-bottom:17px}
.summary-card{position:relative;min-height:142px;overflow:hidden;padding:18px 19px 14px;border:1px solid var(--border);border-radius:11px;background:var(--surface);box-shadow:var(--shadow)}.summary-top{display:flex;align-items:center;justify-content:space-between}.summary-label{color:var(--muted);font-size:11px;font-weight:500}.summary-icon{display:grid;width:30px;height:30px;place-items:center;border-radius:9px}.income-icon{background:var(--green-soft);color:var(--green)}.expense-icon{background:#fff0ec;color:#d97c5d}.balance-icon{background:#eef1fc;color:#6878bf}.summary-value{margin-top:11px;font-family:Manrope,sans-serif;font-size:22px;font-weight:750;letter-spacing:-.8px}.summary-foot{display:flex;align-items:center;gap:8px;margin-top:10px}.status-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:5px;font-size:9px;font-weight:700}.status-pill.positive{background:var(--green-soft);color:var(--green)}.status-pill.neutral{background:var(--surface-muted);color:var(--muted)}.summary-caption{color:var(--muted);font-size:10px}.sparkline{position:absolute;right:0;bottom:-1px;width:39%;height:34px;opacity:.62}.sparkline svg{width:100%;height:100%;overflow:visible}.sparkline path{fill:none;stroke-width:2}.income-spark path,.balance-spark path{stroke:#5db98a}.expense-spark path{stroke:#dc9a7e}
.dashboard-grid{display:grid;grid-template-columns:minmax(0,1.52fr) minmax(270px,.9fr);gap:16px;margin-bottom:17px}
.panel{border:1px solid var(--border);border-radius:11px;background:var(--surface);box-shadow:var(--shadow)}.budget-panel,.savings-panel{padding:19px 20px}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.panel-kicker{display:flex;align-items:center;gap:6px;color:var(--green);font-size:9px;font-weight:700;letter-spacing:.8px}.panel-heading h2{margin:7px 0 0;font-family:Manrope,sans-serif;font-size:14px;font-weight:700;letter-spacing:-.2px}.subtle-button{display:inline-flex;align-items:center;gap:5px;padding:5px 0;background:transparent;color:var(--green);font-size:10px;font-weight:700;white-space:nowrap}.subtle-button:hover,.wide-link:hover{color:var(--green-dark)}
.budget-overview{display:flex;align-items:center;justify-content:space-between;margin:19px 0 14px}.budget-overview>div:first-child strong{font-size:13px}.budget-overview>div:first-child span{color:var(--muted);font-size:10px}.budget-total-pill{padding:5px 8px;border-radius:5px;background:var(--green-soft);color:var(--green);font-size:9px;font-weight:700}
.budget-list{display:grid;gap:13px}.budget-item-head{display:flex;align-items:center;gap:7px}.category-mark,.distribution-dot{width:8px;height:8px;flex:none;border-radius:3px}.category-mark.mint,.distribution-dot.mint{background:#59b790}.category-mark.orange,.distribution-dot.orange{background:#e7a26f}.category-mark.blue,.distribution-dot.blue{background:#77a9d0}.category-mark.yellow,.distribution-dot.yellow{background:#dfc06c}.category-mark.green,.distribution-dot.green{background:#58b77e}.category-mark.purple,.distribution-dot.purple{background:#a58fd2}.budget-item-head strong{font-size:10px;font-weight:600}.budget-values{margin-left:auto;color:var(--text);font-size:10px;font-weight:600}.budget-values i{padding:0 3px;color:#b4beb7;font-style:normal}.progress-track{display:block;height:5px;overflow:hidden;border-radius:9px;background:var(--surface-muted)}.budget-item .progress-track{margin-top:8px}.progress-value{display:block;height:100%;border-radius:9px;background:#58b68a;transition:width .3s}.progress-value.over{background:var(--red)}.budget-item-foot{display:flex;justify-content:space-between;margin-top:5px;color:var(--muted);font-size:9px}.budget-item-foot span{color:var(--green)}.budget-item-foot.over-text,.budget-item-foot .over-text{color:var(--red)}
.savings-highlight{display:flex;align-items:center;justify-content:space-between;margin:19px 0 12px;padding:13px;border:1px solid var(--border);border-radius:9px;background:var(--surface-muted)}.muted-copy{color:var(--muted);font-size:9px}.highlight-amount{margin-top:5px;font-family:Manrope,sans-serif;font-size:17px;font-weight:750;letter-spacing:-.5px}.saving-ring{display:grid;width:55px;height:55px;place-items:center;border-radius:50%;background:conic-gradient(#4fac80 var(--ring-progress),var(--border) 0);position:relative}.saving-ring:before{position:absolute;width:43px;height:43px;border-radius:50%;background:var(--surface-muted);content:''}.saving-ring span{z-index:1;font-size:12px;font-weight:700}.saving-ring small{font-size:8px}.saving-subtitle{display:flex;align-items:center;justify-content:space-between;padding:5px 0 10px;color:var(--muted);font-size:10px}.saving-subtitle strong{color:var(--text);font-size:10px}.saving-distributions{display:grid;gap:10px;padding:11px 0;border-top:1px solid var(--border)}.distribution-row{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:9px}.distribution-row strong{margin-left:auto;color:var(--text);font-size:9px}.wide-link{display:flex;width:100%;align-items:center;justify-content:space-between;padding:11px 0 0;border-top:1px solid var(--border);background:transparent;color:var(--green);font-size:10px;font-weight:700}
.transactions-panel{padding:19px 20px}.transaction-heading{align-items:center;margin-bottom:17px}.transaction-table-wrap{width:100%;overflow-x:auto}.transaction-table{width:100%;border-collapse:collapse;text-align:left;white-space:nowrap}.transaction-table th,.annual-table th{padding:0 12px 10px;color:var(--muted);font-size:8px;font-weight:700;letter-spacing:.65px}.transaction-table th:first-child,.transaction-table td:first-child{padding-left:0}.transaction-table th:last-child,.transaction-table td:last-child{padding-right:0}.transaction-table td{padding:11px 12px;border-top:1px solid var(--border);font-size:10px}.transaction-name{display:flex;align-items:center;gap:9px}.transaction-name>div{display:grid;gap:3px}.transaction-name strong{font-size:10px;font-weight:600}.transaction-name small{max-width:180px;overflow:hidden;color:var(--muted);font-size:9px;text-overflow:ellipsis}.transaction-icon{display:grid;width:29px;height:29px;flex:none;place-items:center;border-radius:8px;background:var(--surface-muted);color:#ab9274}.transaction-icon.tx-income{background:var(--green-soft);color:var(--green)}.transaction-icon.orange{background:#fff3e9;color:#db9b63}.transaction-icon.blue{background:#eef5fa;color:#709ec0}.transaction-icon.yellow{background:#faf5e8;color:#c5a849}.transaction-icon.mint{background:var(--green-soft);color:var(--green)}.transaction-icon.purple{background:#f4effb;color:#9c85c8}.category-chip{display:inline-block;padding:4px 7px;border-radius:5px;background:var(--surface-muted);color:var(--muted);font-size:9px}.category-chip.orange{background:#fff4eb;color:#bd8054}.category-chip.blue{background:#eff6fb;color:#6b94b2}.category-chip.yellow{background:#faf6e9;color:#ad954e}.category-chip.mint,.category-chip.green{background:var(--green-soft);color:var(--green)}.category-chip.purple{background:#f4effb;color:#8f78bf}.muted-cell{color:var(--muted)}.amount-cell{color:var(--text);font-size:10px;font-weight:700}.amount-positive{color:var(--green)}.balance-cell{font-size:10px;font-weight:600}.row-menu{width:27px;height:27px}.empty-state{padding:34px 10px;color:var(--muted);font-size:11px;text-align:center}.empty-state button{padding:0;background:transparent;color:var(--green);font-size:11px;font-weight:700}
.footer-note{display:flex;align-items:center;justify-content:center;gap:6px;padding:18px 0;color:var(--muted);font-size:9px}
.transaction-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}.mini-stat{display:flex;align-items:center;gap:11px;padding:15px 17px;border:1px solid var(--border);border-radius:10px;background:var(--surface);box-shadow:var(--shadow)}.mini-stat-icon{display:grid;width:34px;height:34px;place-items:center;border-radius:9px}.mini-stat-icon.green{background:var(--green-soft);color:var(--green)}.mini-stat-icon.coral{background:#fff0ec;color:#d97c5d}.mini-stat-icon.blue{background:#eef1fc;color:#6878bf}.mini-stat div{display:grid;gap:4px}.mini-stat div span{color:var(--muted);font-size:10px}.mini-stat strong{font-size:13px}.full-transactions{margin-bottom:16px}.table-actions{display:flex;align-items:center;gap:9px}.record-count{color:var(--muted);font-size:10px}.filter-button,.compact-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--muted);font-size:10px}.compact-button{height:32px;border-color:var(--green);background:var(--green);color:white}.row-actions{display:flex;gap:3px}.row-actions .icon-button{width:27px;height:27px}.delete-action:hover{background:#fff0ec;color:var(--red)}.full-table td{padding-top:12px;padding-bottom:12px}.transactions-budget{padding:19px 20px}.budget-progress-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 26px;margin-top:20px}.budget-progress-grid .budget-item-foot{font-size:9px}
.savings-year-summary{display:grid;gap:14px;margin-bottom:16px}.annual-total-card{position:relative;display:flex;min-height:130px;align-items:flex-start;gap:15px;overflow:hidden;padding:21px;border:1px solid #286a4d;border-radius:11px;background:#1a4935;color:#fff}.annual-icon{display:grid;width:39px;height:39px;flex:none;place-items:center;border:1px solid #ffffff27;border-radius:11px;background:#ffffff13;color:#a6e2bf}.annual-total-card>div:nth-child(2){z-index:1;display:grid;gap:6px}.annual-total-card>div:nth-child(2)>span{color:#b4d2bf;font-size:10px}.annual-total-card strong{font-family:Manrope,sans-serif;font-size:25px;letter-spacing:-.7px}.annual-total-card small{display:flex;align-items:center;gap:4px;color:#a6d7b8;font-size:9px}.annual-decoration{position:absolute;right:0;bottom:0;display:flex;height:100px;align-items:flex-end;gap:8px;opacity:.16;transform:skewX(-25deg);padding-right:40px}.annual-decoration span{width:22px;border-radius:4px 4px 0 0;background:#b8f1cf}.annual-decoration span:nth-child(1){height:34%}.annual-decoration span:nth-child(2){height:52%}.annual-decoration span:nth-child(3){height:65%}.annual-decoration span:nth-child(4){height:78%}.annual-decoration span:nth-child(5){height:100%}.saving-post-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.saving-post-card{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:8px 7px;padding:13px 12px;border:1px solid var(--border);border-radius:9px;background:var(--surface)}.saving-post-card>span:nth-child(2){overflow:hidden;color:var(--muted);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.saving-post-card strong{grid-column:1/-1;font-size:13px}.saving-post-card small{grid-column:1/-1;color:var(--muted);font-size:9px}.annual-table-panel{padding:20px}.annual-table-heading{align-items:center;margin-bottom:18px}.annual-table-heading p{margin:6px 0 0;color:var(--muted);font-size:10px}.year-badge{padding:6px 9px;border:1px solid var(--border);border-radius:6px;color:var(--muted);font-size:10px;font-weight:600}.annual-table-wrap{overflow:auto}.annual-table{width:100%;border-collapse:collapse;text-align:left;white-space:nowrap}.annual-table th{padding:0 12px 10px}.annual-table th:first-child,.annual-table td:first-child{padding-left:0}.annual-table td{padding:9px 12px;border-top:1px solid var(--border);font-size:10px}.annual-table td:first-child{display:grid;gap:2px}.annual-table td:first-child strong{font-size:10px}.month-year{color:var(--muted);font-size:8px}.annual-progress{display:flex;align-items:center;gap:8px}.annual-progress .progress-track{width:80px;height:5px}.annual-progress small{color:var(--muted);font-size:9px}.saving-input-cell{display:flex;align-items:center;gap:5px}.saving-input-cell input{width:96px;height:27px;padding:0 7px;border:1px solid var(--border);border-radius:5px;outline:none;background:var(--surface-muted);font-size:10px}.saving-input-cell input:focus{border-color:var(--green)}.save-row-button{display:grid;width:27px;height:27px;place-items:center;border-radius:5px;background:var(--green-soft);color:var(--green)}.save-row-button:hover{background:var(--green);color:white}.allocation-note{display:flex;gap:11px;margin-top:17px;padding:13px;border:1px solid var(--border);border-radius:8px;background:var(--surface-muted)}.allocation-note-icon{display:grid;width:29px;height:29px;flex:none;place-items:center;border-radius:7px;background:var(--green-soft);color:var(--green)}.allocation-note strong{font-size:10px}.allocation-note p{margin:5px 0 0;color:var(--muted);font-size:9px;line-height:1.7}.allocation-note b{color:var(--text)}
.alert-banner{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:17px;padding:10px 12px;border:1px solid #edc8bd;border-radius:7px;background:#fff2ee;color:#a34f43;font-size:11px}.alert-banner button{display:grid;place-items:center;background:transparent;color:inherit}
.modal-backdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:20px;background:#13201972;backdrop-filter:blur(3px)}.transaction-modal{width:min(100%,440px);padding:22px;border:1px solid var(--border);border-radius:13px;background:var(--surface);box-shadow:0 24px 80px #0002}.modal-heading{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:19px}.modal-heading h2{margin:7px 0 0;font-family:Manrope,sans-serif;font-size:19px}.transaction-form{display:grid;gap:12px}.transaction-form label{display:grid;gap:6px;color:var(--text);font-size:10px;font-weight:600}.transaction-form input,.transaction-form select{width:100%;height:39px;padding:0 10px;border:1px solid var(--border);border-radius:6px;outline:none;background:var(--surface-muted);font-size:11px}.transaction-form input:focus,.transaction-form select:focus{border-color:var(--green)}.type-toggle{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:4px;border-radius:8px;background:var(--surface-muted)}.type-toggle button{display:flex;height:34px;align-items:center;justify-content:center;gap:6px;border-radius:6px;background:transparent;color:var(--muted);font-size:10px;font-weight:600}.type-toggle button.selected{background:var(--surface);color:var(--green);box-shadow:var(--shadow)}.optional{color:var(--muted);font-weight:400}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}.cancel-button{padding:0 13px;border:1px solid var(--border);border-radius:7px;background:var(--surface);font-size:10px}.form-message{margin:0;font-size:10px}.error-message{color:var(--red)}.success-message{color:var(--green)}.toast-message{position:fixed;right:25px;bottom:24px;z-index:70;display:flex;align-items:center;gap:8px;padding:11px 15px;border:1px solid var(--border);border-radius:8px;background:var(--surface);box-shadow:var(--shadow);color:var(--text);font-size:11px}.fade-enter-active,.fade-leave-active{transition:opacity .2s}.fade-enter-from,.fade-leave-to{opacity:0}.toast-enter-active,.toast-leave-active{transition:all .2s}.toast-enter-from,.toast-leave-to{opacity:0;transform:translateY(8px)}
@media(max-width:1100px){.sidebar{width:220px}.main-content{margin-left:220px}.topbar{padding:0 26px}.page-wrap{padding-right:26px;padding-left:26px}.dashboard-grid{grid-template-columns:minmax(0,1.3fr) minmax(250px,.9fr)}.saving-post-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:800px){.sidebar{width:250px;transform:translateX(-101%);transition:transform .22s;box-shadow:none}.sidebar.sidebar-open{transform:translateX(0);box-shadow:15px 0 50px #0002}.main-content{margin-left:0;padding-bottom:65px}.topbar{height:58px;padding:0 20px}.mobile-menu-button{display:grid;margin-right:8px}.breadcrumb{margin-right:auto}.top-actions{gap:12px}.mobile-bottom-nav{position:fixed;inset:auto 0 0;z-index:15;display:flex;height:63px;align-items:center;justify-content:space-around;border-top:1px solid var(--border);background:var(--surface);padding-bottom:env(safe-area-inset-bottom)}.mobile-bottom-nav button{display:grid;min-width:58px;justify-items:center;gap:3px;background:transparent;color:var(--muted);font-size:9px}.mobile-bottom-nav button.active{color:var(--green)}.page-wrap{padding:27px 22px 25px}.page-heading{align-items:flex-start}.heading-actions{flex-wrap:wrap;justify-content:flex-end}.dashboard-grid{grid-template-columns:minmax(0,1.25fr) minmax(235px,.9fr)}.summary-grid{gap:10px}.summary-card{padding:15px 13px}.summary-value{font-size:18px}.saving-post-cards{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:620px){.topbar{padding:0 14px}.breadcrumb{font-size:11px}.sync-state{font-size:0}.sync-indicator{width:8px;height:8px}.top-actions{gap:7px}.page-wrap{padding:22px 14px 20px}.page-heading{display:block;margin-bottom:19px}.page-heading h1{font-size:24px}.heading-actions{justify-content:flex-start;margin-top:14px}.period-select{height:34px}.period-select select{width:76px}.year-select select{width:43px}.add-button{margin-left:auto;height:34px}.summary-grid{grid-template-columns:1fr 1fr;gap:9px}.summary-card{min-height:128px;padding:14px 12px}.summary-card:last-child{grid-column:1/-1;min-height:113px}.summary-value{font-size:17px}.summary-caption{font-size:9px}.dashboard-grid{grid-template-columns:1fr;gap:11px}.budget-panel,.savings-panel,.transactions-panel{padding:16px 13px}.panel-heading h2{font-size:13px}.budget-values{font-size:9px}.budget-list{gap:12px}.savings-highlight{margin-top:14px}.transactions-panel{margin-top:0}.transaction-table th,.transaction-table td{padding-right:8px;padding-left:8px}.transaction-table td{font-size:9px}.transaction-name{gap:6px}.transaction-name strong{font-size:9px}.transaction-icon{width:26px;height:26px}.category-chip{font-size:8px;padding:4px 5px}.transaction-stats{gap:7px}.mini-stat{gap:7px;padding:11px 9px}.mini-stat-icon{width:28px;height:28px}.mini-stat div span{font-size:8px}.mini-stat strong{font-size:10px}.table-actions{gap:5px}.record-count{font-size:9px}.filter-button,.compact-button{height:29px;padding:0 7px;font-size:9px}.budget-progress-grid{grid-template-columns:1fr;gap:15px}.saving-post-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.annual-total-card{min-height:112px;padding:17px 14px}.annual-total-card strong{font-size:21px}.annual-table-panel{padding:16px 12px}.annual-table-heading p{max-width:270px;line-height:1.5}.annual-table td{padding-right:8px;padding-left:8px}.annual-progress .progress-track{width:52px}.saving-input-cell input{width:76px}.allocation-note{padding:11px}.toast-message{right:12px;bottom:76px;left:12px;justify-content:center}.footer-note{padding-bottom:6px}.full-transactions .transaction-heading{align-items:flex-start;flex-wrap:wrap}.full-transactions .table-actions{width:100%;justify-content:flex-end}.full-table{min-width:770px}.transaction-table:not(.full-table){min-width:590px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
</style>
