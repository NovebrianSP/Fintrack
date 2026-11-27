export type TransactionType = 'Pemasukan' | 'Pengeluaran'

export type ExpenseCategory =
  | 'Sewa Kos'
  | 'Makan'
  | 'Air Mineral'
  | 'Token Listrik Kos'
  | 'Kebutuhan Pribadi'
  | 'Transportasi'
  | 'Lainnya'

export type SavingPost =
  | 'Dana Darurat'
  | 'Tabungan Utama'
  | 'Kebutuhan Pribadi & Transport'
  | 'Self-Reward / Cadangan'

export interface Transaction {
  id: string
  user_id?: string
  transaction_date: string
  type: TransactionType
  category: string
  title: string
  amount: number
  notes: string | null
  created_at?: string
}

export interface MonthlyBudget {
  id?: string
  user_id?: string
  month: number
  year: number
  category: ExpenseCategory
  target_amount: number
}

export interface MonthlySaving {
  id?: string
  user_id?: string
  month: number
  year: number
  allocation_post: SavingPost
  target_percentage: number
  target_amount: number
  saved_amount: number
  storage_note: string | null
}

export const budgetDefaults: Array<{ category: ExpenseCategory; target_amount: number }> = [
  { category: 'Sewa Kos', target_amount: 400_000 },
  { category: 'Makan', target_amount: 638_000 },
  { category: 'Air Mineral', target_amount: 132_000 },
  { category: 'Token Listrik Kos', target_amount: 35_000 },
]

export const savingDefaults: Array<{ allocation_post: SavingPost; target_percentage: number }> = [
  { allocation_post: 'Dana Darurat', target_percentage: 0.4 },
  { allocation_post: 'Tabungan Utama', target_percentage: 0.35 },
  { allocation_post: 'Kebutuhan Pribadi & Transport', target_percentage: 0.15 },
  { allocation_post: 'Self-Reward / Cadangan', target_percentage: 0.1 },
]
