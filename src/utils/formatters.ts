const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function formatRupiah(amount: number): string {
  return rupiahFormatter.format(amount)
}

export function formatCompactRupiah(amount: number): string {
  if (Math.abs(amount) < 1_000_000) return formatRupiah(amount)
  return `Rp ${(amount / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}): string {
  return new Intl.DateTimeFormat('id-ID', options).format(new Date(`${date}T00:00:00`))
}

export function currentDate(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
