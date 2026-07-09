import type { NextRequest } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createClient } from "@/lib/supabase/server";
import { chatSendSchema, predictionToolArgsSchema } from "@/lib/validation/chat";
import { predictionInputSchema } from "@/lib/validation/prediction";
import { streamChatDeltas, streamChatWithTools } from "@/lib/ai/chatbot";
import {
  buildChatMessages,
  PREDICTION_TOOL,
  type ChatTurn,
  type PetChatContext,
} from "@/lib/ai/prompts/chatbot";
import {
  encodePredictionBlock,
  stripPredictionBlocks,
  type ChatPredictionBlock,
} from "@/lib/chat-protocol";
import { executePrediction } from "@/server/predictions/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 20;

/** Whole months between a date of birth and now — floors partial months, never negative. */
function monthsSinceBirth(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  const now = new Date();
  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 +
    (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return Math.max(0, months);
}

type PetRow = {
  id: string;
  name: string;
  species: string;
  date_of_birth: string | null;
  weight_kg: number | null;
};

type VetRole = "admin" | "veterinarian";
function asVetRole(role: string | null | undefined): VetRole | null {
  return role === "admin" || role === "veterinarian" ? role : null;
}

/** Fetch typed pet columns only (no owner data, no free-text notes), RLS-scoped. */
async function fetchPetRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  petId: string | null,
): Promise<PetRow | null> {
  if (!petId) return null;
  const { data } = await supabase
    .from("pets")
    .select("id, name, species, date_of_birth, weight_kg")
    .eq("id", petId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

/**
 * Streaming chatbot endpoint. Validates input, resolves an owned session
 * (optionally linked to a pet), persists the user turn, streams the
 * assistant reply, and persists the assistant turn. A model outage degrades
 * to a fallback line, not a crash. RLS keeps every read/write scoped to the
 * caller.
 *
 * When the caller is a vet/admin AND a pet is linked, the model is offered
 * `run_disease_prediction` — a tool it may call at most once per request.
 * The tool never runs the prediction itself: it goes through the same
 * `executePrediction` path as the Prediction page (role gate, rate limit,
 * audit insert), and its species/age come from the pet's DB row, never from
 * the model.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  const parsed = chatSendSchema.safeParse(body);
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { message, sessionId, petId: bodyPetId } = parsed.data;

  // Resolve a session the caller actually owns; otherwise start a new one.
  let sid: string | null = null;
  let existingPetId: string | null = null;
  if (sessionId) {
    const { data: owned } = await supabase
      .from("chat_sessions")
      .select("id, pet_id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    sid = owned?.id ?? null;
    existingPetId = owned?.pet_id ?? null;
  }

  // Resolve the pet this chat is linked to. `undefined` = keep whatever the
  // session already has; `null` = explicit clear; a uuid must be verified
  // (not trusted from the client) against an active pet before it's used.
  let resolvedPetId: string | null;
  if (bodyPetId === undefined) {
    resolvedPetId = existingPetId;
  } else if (bodyPetId === null) {
    resolvedPetId = null;
  } else {
    const { data: petCheck } = await supabase
      .from("pets")
      .select("id")
      .eq("id", bodyPetId)
      .is("deleted_at", null)
      .maybeSingle();
    resolvedPetId = petCheck?.id ?? null;
  }

  if (!sid) {
    const { data: created } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: message.slice(0, 60), pet_id: resolvedPetId })
      .select("id")
      .single();
    if (!created) return new Response("Could not start chat", { status: 500 });
    sid = created.id;
  } else if (bodyPetId !== undefined && resolvedPetId !== existingPetId) {
    await supabase
      .from("chat_sessions")
      .update({ pet_id: resolvedPetId })
      .eq("id", sid)
      .eq("user_id", user.id);
  }
  const activeSid = sid;

  // Pet context (typed columns only — no owner data, no free-text notes) and
  // the caller's role, both resolved server-side via RLS-scoped selects.
  const [petRow, profileResult] = await Promise.all([
    fetchPetRow(supabase, resolvedPetId),
    supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle(),
  ]);
  const profile = profileResult.data;

  const vetRole = asVetRole(profile?.role);
  // The tool is offered ONLY when role comes back admin/veterinarian from the
  // server session AND the chat is linked to a pet — never from the client.
  const canPredict = vetRole !== null && !!petRow;

  const petContext: PetChatContext | null = petRow
    ? {
        name: petRow.name,
        species: petRow.species,
        ageMonths: petRow.date_of_birth ? monthsSinceBirth(petRow.date_of_birth) : null,
        weightKg: petRow.weight_kg,
      }
    : null;

  // Load prior turns for context, then persist the new user turn.
  const { data: recent } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", activeSid)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history = (recent ?? []).slice().reverse(); // back to chronological

  await supabase
    .from("chat_messages")
    .insert({
      session_id: activeSid,
      user_id: user.id,
      role: "user",
      content: message,
    });

  const turns: ChatTurn[] = [
    // Replaying history to the model: strip embedded prediction blocks down
    // to a one-line summary so it isn't re-parsed as a large JSON blob.
    ...history.map((h) => ({
      role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: h.role === "assistant" ? stripPredictionBlocks(h.content) : h.content,
    })),
    { role: "user", content: message },
  ];
  const chatMessages = buildChatMessages(turns, petContext);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        if (canPredict && vetRole && petRow) {
          full += await runToolEnabledTurn({
            chatMessages,
            petRow,
            vetRole,
            userId: user.id,
            fullName: profile?.full_name ?? null,
            controller,
            encoder,
          });
        } else {
          for await (const delta of streamChatDeltas(chatMessages)) {
            full += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
      } catch {
        if (!full) {
          full = "Sorry — the assistant is unavailable right now. Please try again.";
          controller.enqueue(encoder.encode(full));
        }
      } finally {
        if (full) {
          await supabase.from("chat_messages").insert({
            session_id: activeSid,
            user_id: user.id,
            role: "assistant",
            content: full,
          });
          await supabase
            .from("chat_sessions")
            .update({ title: message.slice(0, 60) })
            .eq("id", activeSid)
            .eq("user_id", user.id);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-session-id": activeSid,
    },
  });
}

/**
 * Run the (at most) one tool-enabled turn: stream the first completion with
 * the prediction tool offered, and if the model calls it, resolve the real
 * prediction through `executePrediction` and feed the result (or an error)
 * back to the model for a second, tool-free completion. Returns the full
 * accumulated text so the caller can persist it as one assistant message.
 */
async function runToolEnabledTurn(args: {
  chatMessages: ReturnType<typeof buildChatMessages>;
  petRow: PetRow;
  vetRole: VetRole;
  userId: string;
  fullName: string | null;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
}): Promise<string> {
  const { chatMessages, petRow, vetRole, userId, fullName, controller, encoder } = args;
  let full = "";
  const emit = (text: string) => {
    full += text;
    controller.enqueue(encoder.encode(text));
  };

  let toolCall: { id: string; name: string; args: string } | null = null;
  for await (const event of streamChatWithTools(chatMessages, {
    tools: [PREDICTION_TOOL],
  })) {
    if (event.type === "text") {
      emit(event.delta);
    } else if (event.type === "tool_call" && !toolCall) {
      // Cap: only the first tool call is handled per request.
      toolCall = event;
    }
  }

  if (!toolCall) return full;

  const { block, toolResult } = await resolvePredictionToolCall({
    argsJson: toolCall.args,
    petRow,
    vetRole,
    userId,
    fullName,
  });

  if (block) {
    emit("\n" + encodePredictionBlock(block) + "\n");
  }

  // Second, tool-free completion: feed back the assistant's tool call plus
  // the tool result so the model can compose its reply in its own words. No
  // `tools` are passed here, so it cannot chain another tool call.
  const secondMessages: ChatCompletionMessageParam[] = [
    ...chatMessages,
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: toolCall.id || "call_1",
          type: "function",
          function: { name: toolCall.name, arguments: toolCall.args },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: toolCall.id || "call_1",
      content: JSON.stringify(toolResult),
    },
  ];

  for await (const delta of streamChatDeltas(secondMessages)) {
    emit(delta);
  }

  return full;
}

/**
 * Validate the model's tool-call arguments, resolve species/age from the
 * pet's DB row (DB wins; the model's `age_months` is only a fallback), and
 * run the shared, audited prediction executor. Never throws — any failure
 * becomes a `{ error }` tool result so the model can apologize gracefully
 * instead of the request crashing.
 */
async function resolvePredictionToolCall(args: {
  argsJson: string;
  petRow: PetRow;
  vetRole: VetRole;
  userId: string;
  fullName: string | null;
}): Promise<{
  block: ChatPredictionBlock | null;
  toolResult: { conditions: unknown } | { error: string };
}> {
  const { argsJson, petRow, vetRole, userId, fullName } = args;

  let rawArgs: unknown;
  try {
    rawArgs = JSON.parse(argsJson);
  } catch {
    return {
      block: null,
      toolResult: { error: "The tool arguments were not valid JSON." },
    };
  }

  const argsParsed = predictionToolArgsSchema.safeParse(rawArgs);
  if (!argsParsed.success) {
    return {
      block: null,
      toolResult: { error: "The symptoms provided were invalid." },
    };
  }

  const dbAgeMonths = petRow.date_of_birth ? monthsSinceBirth(petRow.date_of_birth) : null;
  const ageMonths = dbAgeMonths ?? argsParsed.data.age_months;
  if (ageMonths === undefined || ageMonths === null) {
    return {
      block: null,
      toolResult: {
        error:
          "This pet's age is unknown (no date of birth on file) and no age " +
          "was provided. Ask the user for the pet's age in months, or " +
          "record a date of birth on the pet's profile, before analyzing.",
      },
    };
  }

  const inputParsed = predictionInputSchema.safeParse({
    species: petRow.species,
    ageMonths,
    symptoms: argsParsed.data.symptoms,
    notes: argsParsed.data.notes,
  });
  if (!inputParsed.success) {
    return {
      block: null,
      toolResult: { error: "The prediction input failed validation." },
    };
  }

  const result = await executePrediction(
    { userId, role: vetRole, fullName },
    inputParsed.data,
    petRow.id,
  );

  if (!result.ok) {
    return { block: null, toolResult: { error: result.message } };
  }

  const block: ChatPredictionBlock = {
    predictionId: result.data.id ?? "",
    petId: petRow.id,
    conditions: result.data.conditions,
  };

  return { block, toolResult: { conditions: result.data.conditions } };
}
