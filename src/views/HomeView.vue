<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import '@/assets/Homeview.css'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check,
  ChevronDown, CreditCard, Filter, LayoutDashboard,
  Leaf, LogOut, Menu, Moon, Plus, Settings2, ShieldCheck, Sun, Target,
  TrendingUp, Wallet, X, Trash2, Pencil, PiggyBank,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import {
  budgetDefaults,
  savingDefaults,
  type MonthlyBudget,
  type MonthlySaving,
  type RecurringBill,
  type RecurringBillPayment,
  type Transaction,
  type TransactionType,
} from '@/types/finance'
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
const theme = useThemeStore()
const mobileMenuOpen = ref(false)
const activePeriodDropdown = ref<'month' | 'year' | null>(null)
const busy = ref(false)
const pageError = ref('')
const toastMessage = ref('')
const transactions = ref<Transaction[]>([])
const budgets = ref<MonthlyBudget[]>([])
const savings = ref<MonthlySaving[]>([])
const recurringBills = ref<RecurringBill[]>([])
const recurringBillPayments = ref<RecurringBillPayment[]>([])
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
  is_recurring: false,
  due_day: '',
  is_paid: false,
})
const savedInputs = reactive<Record<number, string>>({})

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error !== 'object' || error === null) return 'Kesalahan tidak diketahui.'

  const parts = ['message', 'details', 'hint']
    .map((key) => Reflect.get(error, key))
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
  const code = Reflect.get(error, 'code')
  if (typeof code === 'string') parts.push(`Kode: ${code}`)
  return parts.join(' — ') || 'Kesalahan tidak diketahui.'
}

function togglePeriodDropdown(period: 'month' | 'year') {
  activePeriodDropdown.value = activePeriodDropdown.value === period ? null : period
}

const isDark = computed(() => theme.isDark)
const selectedMonthName = computed(() => monthNames[selectedMonth.value - 1] ?? monthNames[0])

async function loadData() {
  pageError.value = ''
  if (!supabase) {
    transactions.value = []
    budgets.value = []
    savings.value = []
    recurringBills.value = []
    recurringBillPayments.value = []
    pageError.value = 'Koneksi Supabase belum dikonfigurasi. Silakan hubungi administrator.'
    return
  }
  busy.value = true
  const start = `${selectedYear.value}-01-01`
  const end = `${selectedYear.value + 1}-01-01`
  try {
    const [transactionResult, budgetResult, savingResult, billResult, paymentResult] = await Promise.all([
      supabase.from('transactions').select('*').gte('transaction_date', start).lt('transaction_date', end).order('transaction_date', { ascending: false }),
      supabase.from('monthly_budgets').select('*').eq('year', selectedYear.value),
      supabase.from('monthly_savings').select('*').eq('year', selectedYear.value),
      supabase.from('recurring_bills').select('*').eq('is_active', true).order('due_day'),
      supabase.from('recurring_bill_payments').select('*').eq('year', selectedYear.value),
    ])
    if (transactionResult.error) throw new Error(`Tabel transactions: ${describeError(transactionResult.error)}`)
    if (budgetResult.error) throw new Error(`Tabel monthly_budgets: ${describeError(budgetResult.error)}`)
    if (savingResult.error) throw new Error(`Tabel monthly_savings: ${describeError(savingResult.error)}`)
    if (billResult.error) throw new Error(`Tabel recurring_bills: ${describeError(billResult.error)}`)
    if (paymentResult.error) throw new Error(`Tabel recurring_bill_payments: ${describeError(paymentResult.error)}`)
    transactions.value = transactionResult.data as Transaction[]
    budgets.value = budgetResult.data as MonthlyBudget[]
    savings.value = savingResult.data as MonthlySaving[]
    recurringBills.value = billResult.data as RecurringBill[]
    recurringBillPayments.value = paymentResult.data as RecurringBillPayment[]
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
    pageError.value = `Tidak dapat memuat data Supabase: ${describeError(error)}`
  } finally {
    busy.value = false
  }
}

watch([selectedMonth, selectedYear], () => {
  Object.keys(savedInputs).forEach((month) => { delete savedInputs[Number(month)] })
  void loadData()
})
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

function dueDateForMonth(year: number, month: number, dueDay: number): string {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`
}

const billReminders = computed(() => recurringBills.value
  .map((bill) => {
    const payment = recurringBillPayments.value.find((item) =>
      item.bill_id === bill.id
      && item.month === selectedMonth.value
      && item.year === selectedYear.value,
    )
    const dueDate = dueDateForMonth(selectedYear.value, selectedMonth.value, bill.due_day)
    return {
      bill,
      payment,
      dueDate,
      isPaid: payment?.is_paid ?? false,
      isOverdue: !payment?.is_paid && dueDate < currentDate(),
    }
  })
  .sort((a, b) => a.dueDate.localeCompare(b.dueDate)))

function setSection(value: Section) {
  section.value = value
  mobileMenuOpen.value = false
}

function handleShellClick(event: MouseEvent) {
  activePeriodDropdown.value = null
  if (!mobileMenuOpen.value || !(event.target instanceof Element)) return
  if (!event.target.closest('.sidebar') && !event.target.closest('.mobile-menu-button')) {
    mobileMenuOpen.value = false
  }
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
    form.is_recurring = false
    form.due_day = ''
    form.is_paid = false
  } else {
    editingTransactionId.value = null
    form.transaction_date = currentDate()
    form.type = 'Pengeluaran'
    form.category = 'Makan'
    form.title = ''
    form.amount = ''
    form.notes = ''
    form.is_recurring = false
    form.due_day = ''
    form.is_paid = false
  }
  modalOpen.value = true
}

async function saveTransaction() {
  const amount = Number(form.amount)
  if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
    formError.value = 'Isi keterangan dan nominal yang valid terlebih dahulu.'
    return
  }

  const dueDay = Number(form.due_day)
  if (form.type === 'Pengeluaran' && form.is_recurring && (
    !Number.isInteger(dueDay)
    || dueDay < 1
    || dueDay > 31
  )) {
    formError.value = 'Tanggal jatuh tempo harus diisi antara 1 sampai 31.'
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
    let savedTransaction: Transaction | null = null

    if (editingTransactionId.value) {
      const { data, error } = await supabase.from('transactions').update(payload).eq('id', editingTransactionId.value).select().single()
      if (error) throw error
      savedTransaction = data as Transaction
      transactions.value = transactions.value.map((item) => item.id === editingTransactionId.value ? savedTransaction! : item)
    } else if (!(form.type === 'Pengeluaran' && form.is_recurring && !form.is_paid)) {
      const { data, error } = await supabase.from('transactions').insert({ ...payload, user_id: auth.session.user.id }).select().single()
      if (error) throw error
      savedTransaction = data as Transaction
      transactions.value.push(savedTransaction)
    }

    if (!editingTransactionId.value && form.type === 'Pengeluaran' && form.is_recurring) {
      const recurringPayload = {
        title: form.title.trim(),
        category: form.category,
        amount,
        due_day: dueDay,
        is_active: true,
        user_id: auth.session.user.id,
      }

      const { data: bill, error: billError } = await supabase
        .from('recurring_bills')
        .upsert(recurringPayload, { onConflict: 'user_id,title,category' })
        .select()
        .single()
      if (billError) throw billError

      const year = Number(form.transaction_date.slice(0, 4))
      const month = Number(form.transaction_date.slice(5, 7))
      const paymentPayload = {
        bill_id: (bill as RecurringBill).id,
        user_id: auth.session.user.id,
        month,
        year,
        due_date: dueDateForMonth(year, month, dueDay),
        is_paid: form.is_paid,
        paid_at: form.is_paid ? new Date().toISOString() : null,
        transaction_id: form.is_paid ? savedTransaction?.id ?? null : null,
      }

      const { data: payment, error: paymentError } = await supabase
        .from('recurring_bill_payments')
        .upsert(paymentPayload, { onConflict: 'bill_id,month,year' })
        .select()
        .single()
      if (paymentError) throw paymentError

      const savedBill = bill as RecurringBill
      recurringBills.value = recurringBills.value
        .filter((item) => item.id !== savedBill.id)
        .concat(savedBill)
      const savedPayment = payment as RecurringBillPayment
      recurringBillPayments.value = recurringBillPayments.value
        .filter((item) => !(item.bill_id === savedPayment.bill_id && item.month === month && item.year === year))
        .concat(savedPayment)
    }

    modalOpen.value = false
    showToast(editingTransactionId.value
      ? 'Transaksi berhasil diperbarui.'
      : form.is_recurring && !form.is_paid
        ? 'Pengingat tagihan berhasil ditambahkan.'
        : 'Transaksi berhasil ditambahkan.')
  } catch (error) {
    console.error('Gagal menyimpan transaksi:', error)
    formError.value = `Transaksi gagal disimpan: ${describeError(error)}`
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
    pageError.value = `Transaksi gagal dihapus: ${describeError(error)}`
  }
}

async function setBillPaid(bill: RecurringBill, payment: RecurringBillPayment | undefined) {
  try {
    if (!supabase || !auth.session) throw new Error('Sesi login tidak tersedia. Silakan masuk kembali.')
    const year = payment?.year ?? selectedYear.value
    const month = payment?.month ?? selectedMonth.value
    const dueDate = payment?.due_date ?? dueDateForMonth(year, month, bill.due_day)

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        transaction_date: dueDate,
        type: 'Pengeluaran',
        category: bill.category,
        title: bill.title,
        amount: bill.amount,
        notes: 'Pembayaran tagihan rutin',
        user_id: auth.session.user.id,
      })
      .select()
      .single()
    if (transactionError) throw transactionError

    const { data: updatedPayment, error: paymentError } = await supabase
      .from('recurring_bill_payments')
      .upsert({
        bill_id: bill.id,
        user_id: auth.session.user.id,
        month,
        year,
        due_date: dueDate,
        is_paid: true,
        paid_at: new Date().toISOString(),
        transaction_id: (transaction as Transaction).id,
      }, { onConflict: 'bill_id,month,year' })
      .select()
      .single()
    if (paymentError) throw paymentError

    transactions.value.push(transaction as Transaction)
    recurringBillPayments.value = recurringBillPayments.value
      .filter((item) => !(item.bill_id === bill.id && item.month === month && item.year === year))
      .concat(updatedPayment as RecurringBillPayment)
    showToast(`${bill.title} ditandai lunas.`)
  } catch (error) {
    console.error('Gagal memperbarui status tagihan:', error)
    pageError.value = `Status tagihan gagal diperbarui: ${describeError(error)}`
  }
}

async function setBillUnpaid(bill: RecurringBill, payment: RecurringBillPayment) {
  try {
    if (!supabase || !auth.session) throw new Error('Sesi login tidak tersedia. Silakan masuk kembali.')

    if (payment.transaction_id) {
      const { error: transactionError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', payment.transaction_id)
      if (transactionError) throw transactionError
      transactions.value = transactions.value.filter((item) => item.id !== payment.transaction_id)
    }

    const { data: updatedPayment, error: paymentError } = await supabase
      .from('recurring_bill_payments')
      .update({
        is_paid: false,
        paid_at: null,
        transaction_id: null,
      })
      .eq('id', payment.id)
      .select()
      .single()
    if (paymentError) throw paymentError

    recurringBillPayments.value = recurringBillPayments.value
      .filter((item) => item.id !== payment.id)
      .concat(updatedPayment as RecurringBillPayment)
    showToast(`${bill.title} ditandai belum lunas.`)
  } catch (error) {
    console.error('Gagal memperbarui status tagihan:', error)
    pageError.value = `Status tagihan gagal diperbarui: ${describeError(error)}`
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
    pageError.value = `Tabungan gagal disimpan: ${describeError(error)}`
  }
}

async function signOut() {
  try {
    await auth.signOut()
    transactions.value = []
    budgets.value = []
    savings.value = []
    recurringBills.value = []
    recurringBillPayments.value = []
    await router.replace({ name: 'login' })
  } catch (error) {
    pageError.value = `Gagal keluar: ${describeError(error)}`
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
  <div class="app-shell" @click="handleShellClick" @keydown.esc="activePeriodDropdown = null">
    <aside class="sidebar" :class="{ 'sidebar-open': mobileMenuOpen }" @click.stop>
      <a class="brand" href="#" @click.prevent="setSection('overview')"><span class="brand-icon">
          <Leaf :size="19" />
        </span> fintrack</a>
      <div class="workspace-label">WORKSPACE</div>
      <nav class="side-nav" aria-label="Navigasi utama">
        <button :class="{ active: section === 'overview' }" @click="setSection('overview')">
          <LayoutDashboard :size="18" /> Ringkasan
        </button>
        <button :class="{ active: section === 'transactions' }" @click="setSection('transactions')">
          <CreditCard :size="18" /> Transaksi <span class="nav-dot"></span>
        </button>
        <button :class="{ active: section === 'savings' }" @click="setSection('savings')">
          <PiggyBank :size="18" /> Tabungan
        </button>
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-tip">
        <div class="tip-icon">
          <ShieldCheck :size="18" />
        </div>
        <strong>Selangkah lebih baik</strong>
        <p>Kebiasaan kecil mengelola uang, dampak besar untuk masa depan.</p>
        <button @click="setSection('savings')">Lihat progres
          <ArrowRight :size="14" />
        </button>
      </div>
      <div class="sidebar-bottom">
        <div class="avatar">{{ auth.session?.user.email?.slice(0, 1).toUpperCase() ?? 'U' }}</div>
        <div class="profile-copy"><strong>{{ auth.session?.user.email?.split('@')[0] ?? 'Pengguna' }}</strong><span>Akun
            personal</span></div>
        <button class="icon-button profile-menu" aria-label="Keluar" @click="signOut">
          <LogOut :size="17" />
        </button>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <button class="icon-button mobile-menu-button" aria-label="Buka menu" @click="mobileMenuOpen = !mobileMenuOpen">
          <Menu :size="20" />
        </button>
        <div class="breadcrumb"><span>Workspace</span><span class="crumb-separator">/</span><strong>{{ section ===
          'overview' ? 'Ringkasan' : section === 'transactions' ? 'Transaksi' : 'Tabungan' }}</strong></div>
        <div class="top-actions">
          <button class="icon-button theme-toggle"
            :aria-label="theme.preference === 'system' ? 'Tema mengikuti sistem; ubah mode warna' : isDark ? 'Ganti ke mode terang' : 'Ikuti setelan sistem'"
            :title="theme.preference === 'system' ? 'Mengikuti setelan sistem' : isDark ? 'Mode gelap' : 'Mode terang'"
            @click="theme.toggle()">
            <Sun v-if="isDark" :size="18" />
            <Moon v-else :size="18" />
          </button>
          <button class="icon-button notification-button" aria-label="Notifikasi"
            @click="showToast('Kamu sudah mengetahui semua kabar terbaru.')">
            <Bell :size="18" /><i></i>
          </button>
          <div class="top-avatar">{{ auth.session?.user.email?.slice(0, 1).toUpperCase() ?? 'A' }}</div>
        </div>
      </header>

      <section class="page-wrap">
        <div v-if="pageError" class="alert-banner"><span>{{ pageError }}</span><button aria-label="Tutup pesan"
            @click="pageError = ''">
            <X :size="16" />
          </button></div>
        <div class="page-heading">
          <div>
            <div class="greeting">{{ new Intl.DateTimeFormat('id-ID', {
              weekday: 'long', day: 'numeric', month: 'long'
            }).format(now) }}</div>
            <h1>{{ section === 'overview' ? 'Ruang finansialmu' : section === 'transactions' ? 'Catatan transaksi' :
              'Rencana tabungan' }}<span class="heading-period">.</span></h1>
            <p>{{ section === 'overview' ? 'Sedikit lebih dekat dengan tujuanmu hari ini.' : section === 'transactions'
              ? 'Semua arus uangmu, tercatat rapi.' : 'Lihat tabunganmu tumbuh, bulan demi bulan.' }}</p>
          </div>
          <div class="heading-actions">
            <div class="relative" @click.stop>
              <button type="button"
                class="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--green)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
                aria-haspopup="listbox" :aria-expanded="activePeriodDropdown === 'month'" aria-label="Pilih bulan"
                @click.stop="togglePeriodDropdown('month')">
                <span class="grid size-7 place-items-center rounded-lg bg-[var(--green-soft)] text-[var(--green)]">
                  <CalendarDays :size="15" />
                </span>
                <span class="min-w-[4.5rem] text-left">{{ selectedMonthName }}</span>
                <ChevronDown :size="14" class="text-[var(--muted)] transition-transform duration-200"
                  :class="{ 'rotate-180': activePeriodDropdown === 'month' }" />
              </button>
              <Transition name="dropdown-popover">
                <div v-if="activePeriodDropdown === 'month'"
                  class="absolute right-0 top-full z-40 mt-2 w-52 origin-top-right overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl shadow-black/10 ring-1 ring-black/5"
                  role="listbox" aria-label="Pilih bulan" @click.stop>
                  <p class="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Pilih
                    bulan</p>
                  <div class="max-h-72 overflow-y-auto">
                    <button v-for="(month, index) in monthNames" :key="month" type="button" role="option"
                      :aria-selected="selectedMonth === index + 1"
                      class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--green)]"
                      :class="{ 'bg-[var(--green-soft)] text-[var(--green)] hover:bg-[var(--green-soft)]': selectedMonth === index + 1 }"
                      @click.stop="selectedMonth = index + 1; activePeriodDropdown = null">
                      {{ month }}
                      <Check v-if="selectedMonth === index + 1" :size="14" />
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
            <div class="relative" @click.stop>
              <button type="button"
                class="inline-flex h-10 min-w-[5.5rem] items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--green)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
                aria-haspopup="listbox" :aria-expanded="activePeriodDropdown === 'year'" aria-label="Pilih tahun"
                @click.stop="togglePeriodDropdown('year')">
                {{ selectedYear }}
                <ChevronDown :size="14" class="text-[var(--muted)] transition-transform duration-200"
                  :class="{ 'rotate-180': activePeriodDropdown === 'year' }" />
              </button>
              <Transition name="dropdown-popover">
                <div v-if="activePeriodDropdown === 'year'"
                  class="absolute right-0 top-full z-40 mt-2 w-36 origin-top-right overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl shadow-black/10 ring-1 ring-black/5"
                  role="listbox" aria-label="Pilih tahun" @click.stop>
                  <p class="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Pilih
                    tahun</p>
                  <button v-for="year in yearOptions" :key="year" type="button" role="option"
                    :aria-selected="selectedYear === year"
                    class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--green)]"
                    :class="{ 'bg-[var(--green-soft)] text-[var(--green)] hover:bg-[var(--green-soft)]': selectedYear === year }"
                    @click.stop="selectedYear = year; activePeriodDropdown = null">
                    {{ year }}
                    <Check v-if="selectedYear === year" :size="14" />
                  </button>
                </div>
              </Transition>
            </div>
            <button class="primary-button add-button" @click="openTransaction()">
              <Plus :size="17" /> Catat transaksi
            </button>
          </div>
        </div>

        <template v-if="section === 'overview'">
          <div class="summary-grid">
            <article class="summary-card">
              <div class="summary-top"><span class="summary-label">Total pemasukan</span><span
                  class="summary-icon income-icon">
                  <ArrowDownLeft :size="18" />
                </span></div>
              <div class="summary-value">{{ formatRupiah(totalIncome) }}</div>
              <div class="summary-foot"><span class="status-pill positive">
                  <TrendingUp :size="13" /> Bulan ini
                </span><span class="summary-caption">Uang saku & pemasukan</span></div>
              <div class="sparkline income-spark"><svg viewBox="0 0 160 38" preserveAspectRatio="none">
                  <path d="M0 29 C18 26 19 17 34 21 S54 30 68 18 S91 21 104 13 S126 19 140 7 S151 9 160 3" />
                </svg></div>
            </article>
            <article class="summary-card">
              <div class="summary-top"><span class="summary-label">Total pengeluaran</span><span
                  class="summary-icon expense-icon">
                  <ArrowUpRight :size="18" />
                </span></div>
              <div class="summary-value">{{ formatRupiah(totalExpense) }}</div>
              <div class="summary-foot"><span class="status-pill neutral">
                  <Wallet :size="13" /> {{ totalIncome ? Math.round(totalExpense / totalIncome * 100) : 0 }}%
                </span><span class="summary-caption">dari pemasukan</span></div>
              <div class="sparkline expense-spark"><svg viewBox="0 0 160 38" preserveAspectRatio="none">
                  <path d="M0 8 C18 14 22 5 38 16 S56 8 71 22 S94 10 108 20 S126 14 142 30 S153 21 160 34" />
                </svg></div>
            </article>
            <article class="summary-card balance-card">
              <div class="summary-top"><span class="summary-label">Saldo kas aktif</span><span
                  class="summary-icon balance-icon">
                  <Wallet :size="18" />
                </span></div>
              <div class="summary-value">{{ formatRupiah(cashBalance) }}</div>
              <div class="summary-foot"><span class="status-pill positive">
                  <Check :size="13" /> Tersedia
                </span><span class="summary-caption">setelah pengeluaran</span></div>
              <div class="sparkline balance-spark"><svg viewBox="0 0 160 38" preserveAspectRatio="none">
                  <path d="M0 31 C17 28 20 24 34 26 S52 13 68 19 S84 9 102 15 S126 4 139 12 S151 4 160 2" />
                </svg></div>
            </article>
          </div>

          <div class="dashboard-grid">
            <section class="panel budget-panel">
              <div class="panel-heading">
                <div>
                  <div class="panel-kicker">
                    <Target :size="15" /> ANGGARAN WAJIB KOS
                  </div>
                  <h2>Jaga pengeluaran tetap seimbang</h2>
                </div>
                <button class="subtle-button" @click="setSection('transactions')">Semua transaksi
                  <ArrowRight :size="14" />
                </button>
              </div>
              <div class="budget-overview">
                <div><strong>{{formatRupiah(budgetProgress.reduce((sum, item) => sum + item.spent, 0))
                    }}</strong><span> dari {{ formatRupiah(totalBudget) }} terpakai</span></div>
                <div class="budget-total-pill">{{Math.round(budgetProgress.reduce((sum, item) => sum + item.spent, 0) /
                  totalBudget * 100)}}% terpakai</div>
              </div>
              <div class="budget-list">
                <div v-for="budget in budgetProgress" :key="budget.category" class="budget-item">
                  <div class="budget-item-head"><span class="category-mark"
                      :class="categoryColor(budget.category)"></span><strong>{{ budget.category }}</strong><span
                      class="budget-values">{{ formatRupiah(budget.spent) }} <i>/</i> {{
                        formatRupiah(budget.target_amount) }}</span></div>
                  <div class="progress-track">
                    <div class="progress-value" :class="{ over: budget.remaining < 0 }"
                      :style="{ width: `${budget.percent}%` }"></div>
                  </div>
                  <div class="budget-item-foot" :class="{ 'over-text': budget.remaining < 0 }">{{ budget.remaining >= 0
                    ? `Hemat ${formatRupiah(budget.remaining)}` : `Melebihi ${formatRupiah(Math.abs(budget.remaining))}`
                    }}<span>{{ Math.round(budget.spent / budget.target_amount * 100) }}%</span></div>
                </div>
              </div>
            </section>

            <section class="panel savings-panel">
              <div class="panel-heading">
                <div>
                  <div class="panel-kicker">
                    <PiggyBank :size="15" /> TABUNGAN BULANAN
                  </div>
                  <h2>Tabunganmu bertumbuh</h2>
                </div>
                <button class="icon-button more-button" aria-label="Lihat tabungan" @click="setSection('savings')">
                  <ArrowRight :size="17" />
                </button>
              </div>
              <div class="savings-highlight">
                <div><span class="muted-copy">Terkumpul bulan ini</span>
                  <div class="highlight-amount">{{ formatRupiah(totalSaved) }}</div>
                </div>
                <div class="saving-ring" :style="{ '--ring-progress': `${Math.min(savingRate, 100)}%` }"><span>{{
                  savingRate }}<small>%</small></span></div>
              </div>
              <div class="saving-subtitle"><span>Target alokasi</span><strong>{{ formatRupiah(distributable) }}</strong>
              </div>
              <div class="saving-distributions">
                <div v-for="post in savingDefaults" :key="post.allocation_post" class="distribution-row">
                  <span class="distribution-dot" :class="categoryColor(post.allocation_post)"></span><span>{{
                    post.allocation_post }}</span><strong>{{ Math.round(post.target_percentage * 100) }}%</strong>
                </div>
              </div>
              <button class="wide-link" @click="setSection('savings')">Lihat rekap tahunan
                <ArrowRight :size="15" />
              </button>
            </section>
          </div>

          <section v-if="billReminders.length" class="panel bill-reminders-panel">
            <div class="panel-heading transaction-heading">
              <div>
                <div class="panel-kicker"><Bell :size="15" /> PENGINGAT TAGIHAN</div>
                <h2>Tagihan rutin bulan ini</h2>
              </div>
              <span class="record-count">{{ billReminders.filter(item => item.isPaid).length }}/{{ billReminders.length }} lunas</span>
            </div>
            <div class="bill-reminder-list">
              <article v-for="item in billReminders" :key="item.bill.id" class="bill-reminder-item"
                :class="{ overdue: item.isOverdue }">
                <span class="transaction-icon" :class="categoryColor(item.bill.category)">
                  <CalendarDays :size="16" />
                </span>
                <div class="bill-reminder-copy">
                  <strong>{{ item.bill.title }}</strong>
                  <small>
                    Jatuh tempo {{ formatDate(item.dueDate) }}
                    <span v-if="item.isOverdue"> · Terlambat</span>
                  </small>
                </div>
                <strong class="bill-reminder-amount">{{ formatRupiah(item.bill.amount) }}</strong>
                <button v-if="item.isPaid" type="button" class="bill-status-button paid"
                  @click="item.payment && setBillUnpaid(item.bill, item.payment)">
                  <Check :size="14" /> Lunas
                </button>
                <button v-else type="button" class="bill-status-button unpaid"
                  @click="setBillPaid(item.bill, item.payment)">
                  Belum lunas
                </button>
              </article>
            </div>
          </section>

          <section class="panel transactions-panel">
            <div class="panel-heading transaction-heading">
              <div>
                <div class="panel-kicker">
                  <CreditCard :size="15" /> AKTIVITAS TERBARU
                </div>
                <h2>Transaksi terakhir</h2>
              </div>
              <button class="subtle-button" @click="setSection('transactions')">Lihat semua
                <ArrowRight :size="14" />
              </button>
            </div>
            <div v-if="recentTransactions.length" class="transaction-table-wrap">
              <table class="transaction-table">
                <thead>
                  <tr>
                    <th>TRANSAKSI</th>
                    <th>KATEGORI</th>
                    <th>TANGGAL</th>
                    <th>JUMLAH</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in recentTransactions" :key="item.id">
                    <td>
                      <div class="transaction-name"><span class="transaction-icon"
                          :class="item.type === 'Pemasukan' ? 'tx-income' : categoryColor(item.category)">
                          <ArrowDownLeft v-if="item.type === 'Pemasukan'" :size="16" />
                          <ArrowUpRight v-else :size="16" />
                        </span>
                        <div><strong>{{ item.title }}</strong><small>{{ item.notes || (item.type === 'Pemasukan' ?
                          'Pemasukan' : 'Pengeluaran') }}</small></div>
                      </div>
                    </td>
                    <td><span class="category-chip" :class="categoryColor(item.category)">{{ item.category }}</span>
                    </td>
                    <td class="muted-cell">{{ formatDate(item.transaction_date, { day: 'numeric', month: 'short' }) }}
                    </td>
                    <td class="amount-cell" :class="item.type === 'Pemasukan' ? 'amount-positive' : ''">{{ item.type ===
                      'Pemasukan' ? '+' : '−' }}{{ formatRupiah(item.amount) }}</td>
                    <td><button class="row-menu icon-button" aria-label="Edit transaksi" @click="openTransaction(item)">
                        <Pencil :size="15" />
                      </button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state">Belum ada transaksi di bulan ini. <button @click="openTransaction()">Catat
                transaksi pertama</button></div>
          </section>
          <div class="footer-note">
            <ShieldCheck :size="14" /> Data keuanganmu tetap privat dan aman.
          </div>
        </template>
        <template v-else-if="section === 'transactions'">
          <div class="transaction-stats">
            <div class="mini-stat"><span class="mini-stat-icon green">
                <ArrowDownLeft :size="17" />
              </span>
              <div><span>Pemasukan</span><strong>{{ formatRupiah(totalIncome) }}</strong></div>
            </div>
            <div class="mini-stat"><span class="mini-stat-icon coral">
                <ArrowUpRight :size="17" />
              </span>
              <div><span>Pengeluaran</span><strong>{{ formatRupiah(totalExpense) }}</strong></div>
            </div>
            <div class="mini-stat"><span class="mini-stat-icon blue">
                <Wallet :size="17" />
              </span>
              <div><span>Saldo kas</span><strong>{{ formatRupiah(cashBalance) }}</strong></div>
            </div>
          </div>
          <section class="panel transactions-panel full-transactions">
            <div class="panel-heading transaction-heading">
              <div>
                <div class="panel-kicker">
                  <CreditCard :size="15" /> RIWAYAT HARIAN
                </div>
                <h2>{{ selectedMonthName }} {{ selectedYear }}</h2>
              </div>
              <div class="table-actions"><span class="record-count">{{ visibleTransactions.length }}
                  transaksi</span><button class="filter-button"
                  @click="showToast('Gunakan pemilih bulan di atas untuk memfilter transaksi.')">
                  <Filter :size="15" /> Filter
                </button><button class="primary-button compact-button" @click="openTransaction()">
                  <Plus :size="16" /> Tambah
                </button></div>
            </div>
            <div v-if="visibleTransactions.length" class="transaction-table-wrap">
              <table class="transaction-table full-table">
                <thead>
                  <tr>
                    <th>TRANSAKSI</th>
                    <th>KATEGORI</th>
                    <th>TANGGAL</th>
                    <th>JUMLAH</th>
                    <th>SALDO BERJALAN</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in [...visibleTransactions].reverse()" :key="item.id">
                    <td>
                      <div class="transaction-name"><span class="transaction-icon"
                          :class="item.type === 'Pemasukan' ? 'tx-income' : categoryColor(item.category)">
                          <ArrowDownLeft v-if="item.type === 'Pemasukan'" :size="16" />
                          <ArrowUpRight v-else :size="16" />
                        </span>
                        <div><strong>{{ item.title }}</strong><small>{{ item.notes || item.type }}</small></div>
                      </div>
                    </td>
                    <td><span class="category-chip" :class="categoryColor(item.category)">{{ item.category }}</span>
                    </td>
                    <td class="muted-cell">{{ formatDate(item.transaction_date) }}</td>
                    <td class="amount-cell" :class="item.type === 'Pemasukan' ? 'amount-positive' : ''">{{ item.type ===
                      'Pemasukan' ? '+' : '−' }}{{ formatRupiah(item.amount) }}</td>
                    <td class="balance-cell">{{ formatRupiah(transactionBalances.get(item.id) ?? 0) }}</td>
                    <td>
                      <div class="row-actions"><button class="icon-button" aria-label="Edit transaksi"
                          @click="openTransaction(item)">
                          <Pencil :size="15" />
                        </button><button class="icon-button delete-action" aria-label="Hapus transaksi"
                          @click="deleteTransaction(item)">
                          <Trash2 :size="15" />
                        </button></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state">Belum ada transaksi di bulan ini. <button @click="openTransaction()">Catat
                transaksi pertama</button></div>
          </section>
          <section class="panel budget-panel transactions-budget">
            <div class="panel-heading">
              <div>
                <div class="panel-kicker">
                  <Target :size="15" /> PROGRES ANGGARAN WAJIB
                </div>
                <h2>Target kos bulan ini</h2>
              </div><span class="record-count">Total target {{ formatRupiah(totalBudget) }}</span>
            </div>
            <div class="budget-progress-grid">
              <div v-for="budget in budgetProgress" :key="budget.category" class="budget-item">
                <div class="budget-item-head"><span class="category-mark"
                    :class="categoryColor(budget.category)"></span><strong>{{ budget.category }}</strong></div>
                <div class="progress-track">
                  <div class="progress-value" :class="{ over: budget.remaining < 0 }"
                    :style="{ width: `${budget.percent}%` }"></div>
                </div>
                <div class="budget-item-foot">{{ formatRupiah(budget.spent) }} / {{ formatRupiah(budget.target_amount)
                  }}<span :class="{ 'over-text': budget.remaining < 0 }">{{ budget.remaining >= 0 ? `Sisa
                    ${formatRupiah(budget.remaining)}` : `Lebih ${formatRupiah(Math.abs(budget.remaining))}` }}</span>
                </div>
              </div>
            </div>
          </section>
        </template>

        <template v-else>
          <div class="savings-year-summary">
            <article class="annual-total-card">
              <div class="annual-icon">
                <PiggyBank :size="20" />
              </div>
              <div><span>Total tabungan terkumpul · {{ selectedYear }}</span><strong>{{ formatRupiah(annualTotalSaved)
                  }}</strong><small>
                  <TrendingUp :size="13" /> Terus tumbuh, satu bulan demi satu bulan
                </small></div>
              <div class="annual-decoration"><span></span><span></span><span></span><span></span><span></span></div>
            </article>
            <div class="saving-post-cards">
              <article v-for="post in savingPostTotals" :key="post.allocation_post" class="saving-post-card"><span
                  class="distribution-dot" :class="categoryColor(post.allocation_post)"></span><span>{{
                    post.allocation_post }}</span><strong>{{ formatRupiah(post.total) }}</strong><small>Target {{
                    Math.round(post.target_percentage * 100) }}% per bulan</small></article>
            </div>
          </div>
          <section class="panel annual-table-panel">
            <div class="panel-heading annual-table-heading">
              <div>
                <div class="panel-kicker">
                  <CalendarDays :size="15" /> REKAP TAHUNAN
                </div>
                <h2>Perjalanan tabunganmu</h2>
                <p>Masukkan total setoran bulanan untuk memperbarui alokasi ke empat pos.</p>
              </div><span class="year-badge">{{ selectedYear }}</span>
            </div>
            <div class="annual-table-wrap">
              <table class="annual-table">
                <thead>
                  <tr>
                    <th>BULAN</th>
                    <th>TARGET ALOKASI</th>
                    <th>TERKUMPUL</th>
                    <th>PROGRES</th>
                    <th>PERBARUI SETORAN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in monthlySavingTotals" :key="item.month">
                    <td><strong>{{ item.name }}</strong><span class="month-year">{{ selectedYear }}</span></td>
                    <td class="muted-cell">{{ formatRupiah(item.target) }}</td>
                    <td class="amount-cell">{{ formatRupiah(item.saved) }}</td>
                    <td>
                      <div class="annual-progress"><span class="progress-track"><span class="progress-value"
                            :style="{ width: `${Math.min(item.saved / item.target * 100, 100)}%` }"></span></span><small>{{
                              item.target ? Math.min(Math.round(item.saved / item.target * 100), 100) : 0 }}%</small></div>
                    </td>
                    <td>
                      <div class="saving-input-cell"><input :value="monthInput(item.month)" type="number" min="0"
                          step="10000" :aria-label="`Setoran bulan ${item.name}`"
                          @input="setSavedInput(item.month, $event)" /><button class="save-row-button"
                          aria-label="Simpan setoran" @click="updateMonthlySaving(item.month)">
                          <Check :size="15" />
                        </button></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="allocation-note">
              <div class="allocation-note-icon">
                <Settings2 :size="17" />
              </div>
              <div><strong>Alokasi otomatis berdasarkan sisa dana</strong>
                <p>Sisa dana siap dialokasikan bulan ini <b>{{ formatRupiah(distributable) }}</b>. Setoran dibagi
                  otomatis sesuai target: Dana Darurat 40%, Tabungan Utama 35%, Kebutuhan Pribadi & Transport 15%, dan
                  Self-Reward / Cadangan 10%.</p>
              </div>
            </div>
          </section>
        </template>
      </section>
      <nav class="mobile-bottom-nav" aria-label="Navigasi mobile">
        <button :class="{ active: section === 'overview' }" @click="setSection('overview')">
          <LayoutDashboard :size="19" /><span>Ringkasan</span>
        </button><button :class="{ active: section === 'transactions' }" @click="setSection('transactions')">
          <CreditCard :size="19" /><span>Transaksi</span>
        </button><button :class="{ active: section === 'savings' }" @click="setSection('savings')">
          <PiggyBank :size="19" /><span>Tabungan</span>
        </button><button @click="openTransaction()">
          <Plus :size="19" /><span>Catat</span>
        </button>
      </nav>
    </main>

    <Transition name="fade">
      <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
        <section class="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-heading">
            <div>
              <div class="panel-kicker">
                <CreditCard :size="15" /> TRANSAKSI BARU
              </div>
              <h2 id="modal-title">{{ editingTransactionId ? 'Edit transaksi' : 'Catat transaksi' }}</h2>
            </div><button class="icon-button" aria-label="Tutup dialog" @click="modalOpen = false">
              <X :size="19" />
            </button>
          </div>
          <form class="transaction-form" @submit.prevent="saveTransaction">
            <div class="type-toggle"><button type="button" :class="{ selected: form.type === 'Pengeluaran' }"
                @click="form.type = 'Pengeluaran'">
                <ArrowUpRight :size="16" /> Pengeluaran
              </button><button type="button" :class="{ selected: form.type === 'Pemasukan' }"
                @click="form.type = 'Pemasukan'">
                <ArrowDownLeft :size="16" /> Pemasukan
              </button></div>
            <label>Tanggal<input v-model="form.transaction_date" type="date" required /></label>
            <label v-if="form.type === 'Pengeluaran'">Kategori<select v-model="form.category">
                <option
                  v-for="category in ['Sewa Kos', 'Makan', 'Air Mineral', 'Token Listrik Kos', 'Kebutuhan Pribadi', 'Transportasi', 'Lainnya']"
                  :key="category">{{ category }}</option>
              </select></label>
            <label>Keterangan<input v-model="form.title" type="text" placeholder="Contoh: Makan siang" maxlength="80"
                required /></label>
            <label>Nominal (Rp)<input v-model="form.amount" type="number" min="1" step="1" placeholder="0"
                required /></label>
            <label>Catatan tambahan <span class="optional">(opsional)</span><input v-model="form.notes" type="text"
                placeholder="Tambahkan detail transaksi" maxlength="200" /></label>
            <label v-if="form.type === 'Pengeluaran'" class="recurring-option">
              <input v-model="form.is_recurring" type="checkbox" />
              Jadikan rutin bulanan
            </label>
            <template v-if="form.type === 'Pengeluaran' && form.is_recurring">
              <label>
                Tanggal jatuh tempo
                <input v-model="form.due_day" type="number" min="1" max="31" placeholder="Contoh: 5" required />
              </label>

              <div class="recurring-status">
                <span>Status pembayaran</span>

                <label>
                  <input v-model="form.is_paid" type="radio" :value="true" />
                  Sudah lunas
                </label>

                <label>
                  <input v-model="form.is_paid" type="radio" :value="false" />
                  Belum lunas
                </label>
              </div>
            </template>
            <p v-if="formError" class="form-message error-message">{{ formError }}</p>
            <div class="modal-actions"><button class="cancel-button" type="button"
                @click="modalOpen = false">Batal</button><button class="primary-button" type="submit"
                :disabled="busy">{{
                  busy ? 'Menyimpan...' : editingTransactionId ? 'Simpan perubahan' : 'Simpan transaksi' }}
                <ArrowRight :size="16" />
              </button></div>
          </form>
        </section>
      </div>
    </Transition>
    <Transition name="toast">
      <div v-if="toastMessage" class="toast-message">
        <Check :size="16" />{{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>
