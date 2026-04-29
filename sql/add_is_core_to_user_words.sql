alter table public.user_words
add column if not exists is_core boolean not null default false;

create index if not exists user_words_user_core_idx
on public.user_words (user_id, is_core, first_learned_at desc);
