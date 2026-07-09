-- Link a chat session to a pet so the AI assistant can carry pet context and
-- (vet/admin only) run an audited disease prediction from within the chat.
-- Nullable: general chats have no pet. on delete set null: removing a pet must
-- not destroy the user's chat history.
--
-- RLS: unchanged — chat_sessions_own already scopes every operation to
-- user_id = auth.uid(), and the new column inherits that.

alter table public.chat_sessions
  add column pet_id uuid references public.pets (id) on delete set null;

create index chat_sessions_pet_id_idx on public.chat_sessions (pet_id);
