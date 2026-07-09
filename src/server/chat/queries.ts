import { createClient } from "@/lib/supabase/server";

export type ChatMessageRow = { id: string; role: string; content: string };

/** The user's most recent chat session and its messages (RLS-scoped to them). */
export async function getLatestChat(): Promise<{
  sessionId: string | null;
  petId: string | null;
  messages: ChatMessageRow[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sessionId: null, petId: null, messages: [] };

  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id, pet_id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const sessionId = sessions?.[0]?.id ?? null;
  const petId = sessions?.[0]?.pet_id ?? null;
  if (!sessionId) return { sessionId: null, petId: null, messages: [] };

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return { sessionId, petId, messages: messages ?? [] };
}

export type ChatPetOption = { id: string; name: string; species: string };

/** Active pets a chat may be linked to, for the pet-select in the chat header. */
export async function listPetOptions(): Promise<ChatPetOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pets")
    .select("id, name, species")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return data ?? [];
}
