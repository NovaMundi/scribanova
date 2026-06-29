-- Schema voor de roosterimport-tool. Plak dit in Supabase: SQL Editor -> New query -> Run.

-- Credits per gebruiker
create table if not exists public.credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  balance int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.credits enable row level security;

-- Gebruiker mag alleen eigen saldo lezen (front-end gebruikt de anon-key + JWT)
drop policy if exists "eigen saldo lezen" on public.credits;
create policy "eigen saldo lezen" on public.credits
  for select using (auth.uid() = user_id);

-- Nieuwe gebruiker krijgt automatisch een (lege) creditsrij
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.credits (user_id, email, balance)
  values (new.id, new.email, 0)
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Credit uitgeven (atomisch). Geeft het nieuwe saldo terug, of null als er geen credit was.
create or replace function public.spend_credit(p_user uuid)
returns int language plpgsql security definer set search_path = public as $$
declare new_balance int;
begin
  update public.credits set balance = balance - 1, updated_at = now()
   where user_id = p_user and balance > 0
   returning balance into new_balance;
  return new_balance;
end; $$;

-- Credits bijschrijven na betaling
create or replace function public.add_credits(p_user uuid, p_n int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.credits (user_id, balance) values (p_user, p_n)
  on conflict (user_id) do update
    set balance = public.credits.balance + p_n, updated_at = now();
end; $$;

-- Aankopen, voor idempotentie van de Stripe-webhook (geen dubbele credits bij retries)
create table if not exists public.purchases (
  stripe_session_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  credits int not null,
  amount int,
  created_at timestamptz not null default now()
);
alter table public.purchases enable row level security; -- geen policies: alleen de service-role mag erbij

-- Gratis gebruik per IP per dag (anti-misbruik backstop voor anonieme analyses)
create table if not exists public.free_uses (
  ip text not null,
  day date not null,
  count int not null default 0,
  primary key (ip, day)
);
alter table public.free_uses enable row level security; -- alleen service-role

create or replace function public.bump_free_use(p_ip text)
returns int language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.free_uses (ip, day, count) values (p_ip, current_date, 1)
  on conflict (ip, day) do update set count = public.free_uses.count + 1
  returning count into c;
  return c;
end; $$;
