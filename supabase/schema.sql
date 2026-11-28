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

create unique index if not exists transactions_id_user_idx
  on public.transactions (id, user_id);

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

create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  due_day int not null check (due_day between 1 and 31),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, title, category)
);

create unique index if not exists recurring_bills_id_user_idx
  on public.recurring_bills (id, user_id);

create table if not exists public.recurring_bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bill_id uuid not null,
  month int not null check (month between 1 and 12),
  year int not null,
  due_date date not null,
  is_paid boolean not null default false,
  paid_at timestamptz,
  transaction_id uuid,
  created_at timestamptz not null default now(),
  unique (bill_id, month, year),
  check (
    (is_paid = true and paid_at is not null and transaction_id is not null)
    or (is_paid = false and paid_at is null and transaction_id is null)
  ),
  check (
    extract(month from due_date) = month
    and extract(year from due_date) = year
  ),
  foreign key (bill_id, user_id)
    references public.recurring_bills (id, user_id)
    on delete cascade,
  foreign key (transaction_id, user_id)
    references public.transactions (id, user_id)
    on delete set null
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);
create index if not exists monthly_budgets_user_year_idx
  on public.monthly_budgets (user_id, year, month);
create index if not exists monthly_savings_user_year_idx
  on public.monthly_savings (user_id, year, month);
create index if not exists recurring_bills_user_active_idx
  on public.recurring_bills (user_id, is_active);
create index if not exists recurring_bill_payments_user_due_date_idx
  on public.recurring_bill_payments (user_id, due_date);
create index if not exists recurring_bill_payments_bill_period_idx
  on public.recurring_bill_payments (bill_id, year, month);

alter table public.transactions enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.monthly_savings enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.recurring_bill_payments enable row level security;

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

create policy "Users manage their own recurring bills"
  on public.recurring_bills for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own recurring bill payments"
  on public.recurring_bill_payments for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select, insert, update, delete on table public.monthly_budgets to authenticated;
grant select, insert, update, delete on table public.monthly_savings to authenticated;
grant select, insert, update, delete on table public.recurring_bills to authenticated;
grant select, insert, update, delete on table public.recurring_bill_payments to authenticated;
