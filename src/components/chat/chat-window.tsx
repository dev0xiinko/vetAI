"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send, PawPrint } from "lucide-react";
import { AI_ADVISORY_DISCLAIMER } from "@/lib/ai/disclaimer";
import { Select } from "@/components/ui/select";
import { parseMessageSegments, type ChatPredictionBlock } from "@/lib/chat-protocol";

type Msg = { role: "user" | "assistant"; content: string };
type PetOption = { id: string; name: string; species: string };

function ConfidenceBar({ likelihood }: { likelihood: number }) {
  const pct = Math.round(likelihood * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-muted-2">{pct}%</span>
    </div>
  );
}

function PredictionCard({
  block,
  canPredict,
}: {
  block: ChatPredictionBlock;
  canPredict: boolean;
}) {
  return (
    <div className="mt-1 flex w-full max-w-[420px] flex-col gap-3 rounded-[13px] border border-line bg-surface p-3.5">
      <div className="text-xs font-semibold text-ink">Suggested conditions</div>
      <ol className="flex flex-col gap-3">
        {block.conditions.map((c, i) => (
          <li key={`${c.condition}-${i}`} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-ink">{c.condition}</span>
              <ConfidenceBar likelihood={c.likelihood} />
            </div>
            <p className="text-[12px] leading-relaxed text-muted-2">{c.rationale}</p>
            <p className="text-[12px] leading-relaxed text-muted-2">
              <span className="font-medium text-ink">Suggested next step: </span>
              {c.recommended_next_step}
            </p>
          </li>
        ))}
      </ol>
      <div
        role="note"
        className="rounded-md border border-warning/40 bg-warning-soft px-2.5 py-2 text-[11px] text-ink"
      >
        {AI_ADVISORY_DISCLAIMER}
      </div>
      {canPredict && block.predictionId ? (
        <Link
          href={`/records/new?pet=${block.petId}&prediction=${block.predictionId}`}
          className="inline-flex h-9 items-center justify-center rounded-[9px] border border-line-strong bg-surface px-3.5 text-xs font-semibold text-muted hover:bg-app"
        >
          Draft medical record
        </Link>
      ) : null}
    </div>
  );
}

export function ChatWindow({
  initialSessionId,
  initialPetId,
  pets,
  canPredict,
  initialMessages,
}: {
  initialSessionId: string | null;
  initialPetId: string | null;
  pets: PetOption[];
  canPredict: boolean;
  initialMessages: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [petId, setPetId] = useState<string | null>(initialPetId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedPet = pets.find((p) => p.id === petId) ?? null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, petId }),
      });
      const sid = res.headers.get("x-session-id");
      if (sid) setSessionId(sid);

      if (!res.ok || !res.body) throw new Error("stream failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content: next[next.length - 1].content + chunk,
          };
          return next;
        });
      }
    } catch {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: "assistant",
          content: "Sorry — the assistant is unavailable right now.",
        };
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  function onPetChange(value: string) {
    setPetId(value || null);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div
        role="note"
        className="rounded-md border border-warning/40 bg-warning-soft px-4 py-2.5 text-xs text-ink"
      >
        {AI_ADVISORY_DISCLAIMER}
      </div>

      <div className="flex h-[calc(100vh-230px)] flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
        <div className="flex flex-none flex-col gap-2.5 border-b border-line px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand-soft text-brand">
                <Bot size={22} />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">
                  Vet Assistant AI
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Online
                </div>
              </div>
            </div>

            {pets.length > 0 ? (
              <div className="flex items-center gap-2">
                <Select
                  aria-label="Link a pet to this chat"
                  className="h-9 w-40 text-xs"
                  value={petId ?? ""}
                  onChange={(e) => onPetChange(e.target.value)}
                >
                  <option value="">No pet linked</option>
                  {pets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.species})
                    </option>
                  ))}
                </Select>
                {selectedPet ? (
                  <Link
                    href={`/pets/${selectedPet.id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                  >
                    <PawPrint size={12} />
                    View profile
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          {canPredict && selectedPet ? (
            <p className="text-[11px] text-muted-2">
              You can ask me to analyze symptoms for {selectedPet.name}.
            </p>
          ) : null}
        </div>

        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-4 overflow-y-auto bg-app/60 p-5"
        >
          {messages.length === 0 ? (
            <div className="m-auto max-w-sm text-center text-sm text-muted-2">
              Ask about clinic FAQs, general pet care, or how to use the app.
              For anything diagnostic or medication-related, the assistant will
              defer to the veterinarian.
            </div>
          ) : (
            messages.map((m, i) => {
              const bot = m.role === "assistant";
              const segments = bot
                ? parseMessageSegments(m.content)
                : [{ type: "text" as const, text: m.content }];
              return (
                <div
                  key={i}
                  className={`flex items-end gap-2 ${bot ? "justify-start" : "justify-end"}`}
                >
                  {bot ? (
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-brand-soft text-brand">
                      <Bot size={16} />
                    </span>
                  ) : null}
                  <div className={`flex max-w-[80%] flex-col gap-2 ${bot ? "items-start" : "items-end"}`}>
                    {segments.map((segment, si) =>
                      segment.type === "prediction" ? (
                        <PredictionCard
                          key={si}
                          block={segment.block}
                          canPredict={canPredict}
                        />
                      ) : segment.text ? (
                        <div
                          key={si}
                          className={`whitespace-pre-wrap px-3.5 py-2.5 text-[13px] leading-relaxed ${
                            bot
                              ? "rounded-[13px] rounded-bl-[3px] bg-line text-ink"
                              : "rounded-[13px] rounded-br-[3px] bg-brand text-white"
                          }`}
                        >
                          {segment.text}
                        </div>
                      ) : null,
                    )}
                    {segments.length === 1 &&
                    segments[0].type === "text" &&
                    !segments[0].text &&
                    bot &&
                    sending ? (
                      <div className="rounded-[13px] rounded-bl-[3px] bg-line px-3.5 py-2.5 text-[13px] text-ink">
                        …
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-none items-center gap-2.5 border-t border-line px-4 py-3.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type your message…"
            className="flex-1 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-[13px] text-ink placeholder:text-faint focus-visible:border-brand focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
