-- User account password hardening migration
-- Run this in Supabase SQL editor.

begin;

alter table public.user_accounts
  add column if not exists password_hash text;

alter table public.user_accounts
  alter column password drop not null;

comment on column public.user_accounts.password_hash is
  'BCrypt hash for account password. During migration, login writes this first and clears plaintext password when possible.';

commit;
