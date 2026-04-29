create extension if not exists pgcrypto;

create table if not exists public.vocabulary_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  meaning text not null,
  example_sentence text,
  source text,
  tags text[] not null default '{}',
  difficulty_level integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_bank_id uuid not null references public.vocabulary_bank(id) on delete cascade,
  word text not null,
  meaning text not null,
  example_sentence text,
  source text,
  tags text[] not null default '{}',
  is_core boolean not null default false,
  familiarity_level integer not null default 0 check (familiarity_level between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  first_learned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, vocabulary_bank_id)
);

create table if not exists public.daily_training_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content_markdown text not null,
  source_words jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_vocabulary_bank_updated_at on public.vocabulary_bank;
create trigger set_vocabulary_bank_updated_at
before update on public.vocabulary_bank
for each row execute function public.set_updated_at();

drop trigger if exists set_user_words_updated_at on public.user_words;
create trigger set_user_words_updated_at
before update on public.user_words
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_training_packs_updated_at on public.daily_training_packs;
create trigger set_daily_training_packs_updated_at
before update on public.daily_training_packs
for each row execute function public.set_updated_at();

alter table public.vocabulary_bank enable row level security;
alter table public.user_words enable row level security;
alter table public.daily_training_packs enable row level security;

drop policy if exists "vocabulary_bank_select_own" on public.vocabulary_bank;
create policy "vocabulary_bank_select_own"
on public.vocabulary_bank for select
using (user_id = auth.uid());

drop policy if exists "vocabulary_bank_insert_own" on public.vocabulary_bank;
create policy "vocabulary_bank_insert_own"
on public.vocabulary_bank for insert
with check (user_id = auth.uid());

drop policy if exists "vocabulary_bank_update_own" on public.vocabulary_bank;
create policy "vocabulary_bank_update_own"
on public.vocabulary_bank for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "vocabulary_bank_delete_own" on public.vocabulary_bank;
create policy "vocabulary_bank_delete_own"
on public.vocabulary_bank for delete
using (user_id = auth.uid());

drop policy if exists "user_words_select_own" on public.user_words;
create policy "user_words_select_own"
on public.user_words for select
using (user_id = auth.uid());

drop policy if exists "user_words_insert_own" on public.user_words;
create policy "user_words_insert_own"
on public.user_words for insert
with check (user_id = auth.uid());

drop policy if exists "user_words_update_own" on public.user_words;
create policy "user_words_update_own"
on public.user_words for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_words_delete_own" on public.user_words;
create policy "user_words_delete_own"
on public.user_words for delete
using (user_id = auth.uid());

drop policy if exists "packs_select_own" on public.daily_training_packs;
create policy "packs_select_own"
on public.daily_training_packs for select
using (user_id = auth.uid());

drop policy if exists "packs_insert_own" on public.daily_training_packs;
create policy "packs_insert_own"
on public.daily_training_packs for insert
with check (user_id = auth.uid());

drop policy if exists "packs_update_own" on public.daily_training_packs;
create policy "packs_update_own"
on public.daily_training_packs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "packs_delete_own" on public.daily_training_packs;
create policy "packs_delete_own"
on public.daily_training_packs for delete
using (user_id = auth.uid());

create index if not exists vocabulary_bank_user_created_idx on public.vocabulary_bank (user_id, created_at desc);
create index if not exists vocabulary_bank_user_difficulty_idx on public.vocabulary_bank (user_id, difficulty_level);
create index if not exists user_words_user_next_review_idx on public.user_words (user_id, next_review_at);
create index if not exists user_words_user_core_idx on public.user_words (user_id, is_core, first_learned_at desc);
create index if not exists user_words_user_first_learned_idx on public.user_words (user_id, first_learned_at desc);
create index if not exists user_words_user_last_reviewed_idx on public.user_words (user_id, last_reviewed_at desc);
create index if not exists packs_user_created_idx on public.daily_training_packs (user_id, created_at desc);
