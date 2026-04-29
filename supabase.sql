create extension if not exists pgcrypto;

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  meaning text not null,
  example_sentence text,
  source text,
  tags text[] not null default '{}',
  familiarity_level integer not null default 0 check (familiarity_level >= 0 and familiarity_level <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists words_user_id_idx on public.words(user_id);
create index if not exists words_next_review_at_idx on public.words(next_review_at);
create index if not exists words_tags_idx on public.words using gin(tags);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_words_updated_at on public.words;
create trigger set_words_updated_at
before update on public.words
for each row
execute function public.set_updated_at();

alter table public.words enable row level security;

drop policy if exists "Users can read own words" on public.words;
create policy "Users can read own words"
on public.words for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own words" on public.words;
create policy "Users can insert own words"
on public.words for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own words" on public.words;
create policy "Users can update own words"
on public.words for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own words" on public.words;
create policy "Users can delete own words"
on public.words for delete
to authenticated
using (auth.uid() = user_id);
