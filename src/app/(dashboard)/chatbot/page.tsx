import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getLatestChat, listPetOptions } from "@/server/chat/queries";
import { ChatWindow } from "@/components/chat/chat-window";

const uuidSchema = z.string().uuid();

export default async function ChatbotPage({
  searchParams,
}: {
  searchParams: Promise<{ pet?: string }>;
}) {
  const session = await requireSession();
  const canPredict = session.role === "admin" || session.role === "veterinarian";

  const sp = await searchParams;
  const paramPetId = uuidSchema.safeParse(sp.pet).success ? sp.pet! : null;

  const [{ sessionId, petId, messages }, pets] = await Promise.all([
    getLatestChat(),
    canPredict ? listPetOptions() : Promise.resolve([]),
  ]);

  // A ?pet= link (e.g. from a pet's profile) wins over whatever pet the
  // session was already linked to.
  const initialPetId = paramPetId ?? petId;

  return (
    <ChatWindow
      initialSessionId={sessionId}
      initialPetId={initialPetId}
      pets={pets}
      canPredict={canPredict}
      initialMessages={messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }))}
    />
  );
}
