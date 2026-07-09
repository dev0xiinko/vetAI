-- Chatbot: per-user chat sessions and messages. Scoped strictly to the user who
-- owns them (RLS on user_id = auth.uid()). The assistant answers FAQ/how-to
-- questions and defers clinical/medication decisions to the vet (ai-features.md).
--
-- RBAC (data-and-rls.md → Chatbot): admin/vet/staff all have full use — but a
-- session is personal, so each user only ever sees their OWN chats.

create table public.chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index chat_sessions_user_id_idx on public.chat_sessions (user_id);
create index chat_messages_session_id_idx on public.chat_messages (session_id);
create index chat_messages_user_id_idx on public.chat_messages (user_id);

create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- chat_sessions: a user fully manages ONLY their own sessions.
-- Denies: reading or touching another user's sessions; anonymous.
create policy chat_sessions_own
  on public.chat_sessions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- chat_messages: a user reads/creates ONLY their own messages. No UPDATE policy
-- (messages are immutable). Denies: other users' messages; anonymous.
create policy chat_messages_select_own
  on public.chat_messages for select
  to authenticated
  using (user_id = auth.uid());

create policy chat_messages_insert_own
  on public.chat_messages for insert
  to authenticated
  with check (user_id = auth.uid());

create policy chat_messages_delete_own
  on public.chat_messages for delete
  to authenticated
  using (user_id = auth.uid());
