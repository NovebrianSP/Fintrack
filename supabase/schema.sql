create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_date date not null default current_date,
  type text not null check (type in ('Pemasukan', 'Pengeluaran')),
  category text not null,
  title text not null,
  amount numeric(14, 2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month int not null check (month between 1 and 12),
  year int not null,
  category text not null,
  target_amount numeric(14, 2) not null check (target_amount >= 0),
  unique (user_id, month, year, category)
);

create table if not exists public.monthly_savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month int not null check (month between 1 and 12),
  year int not null,
  allocation_post text not null,
  target_percentage numeric(5, 4) not null check (target_percentage between 0 and 1),
  target_amount numeric(14, 2) not null check (target_amount >= 0),
  saved_amount numeric(14, 2) not null default 0 check (saved_amount >= 0),
  storage_note text,
  unique (user_id, month, year, allocation_post)
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);
create index if not exists monthly_budgets_user_year_idx
  on public.monthly_budgets (user_id, year, month);
create index if not exists monthly_savings_user_year_idx
  on public.monthly_savings (user_id, year, month);

alter table public.transactions enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.monthly_savings enable row level security;

create policy "Users manage their own transactions"
  on public.transactions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own budgets"
  on public.monthly_budgets for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own savings"
  on public.monthly_savings for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
