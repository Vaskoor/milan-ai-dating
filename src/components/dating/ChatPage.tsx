/**
 * ChatPage.tsx — Milan AI Dating
 * ---------------------------------------------------------------------------
 * 1:1 chat UI.  User messages render as right-aligned rose bubbles; the
 * matched profile's replies render as left-aligned gray bubbles.  An input
 * bar at the bottom sends messages on Enter (Shift+Enter for newline).
 *
 * For the MVP / preview build, replies are canned: a small pool of friendly
 * Nepali-flavoured responses is sampled with a short typing delay.  When the
 * backend `/api/dating/chat` endpoint is wired in, replace `sendMockReply`
 * with a real fetch.
 *
 * The header shows the match's avatar + name + back button (returns to the
 * matches list via `onBack`).
 *
 * Contract: imports `DatingProfile` from `@/lib/matching/types`.
 * When the backend `/api/dating/chat` endpoint is wired, replace
 * `sendMockReply` with a real fetch.
 *
 * Copyright (c) 2025 Z.ai — MIT License
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DatingProfile } from "@/lib/matching/types";

interface ChatMessage {
  id: string;
  role: "user" | "match";
  text: string;
  at: string;
}

/** Canned replies used until the chat backend is online. */
const CANNED_REPLIES = [
  "Hey! 👋 Nice to match with you.",
  "Haha that's great 😄",
  "Tell me more — I'm curious!",
  "Kathmandu has the best cafes for that ☕",
  "We should grab momos sometime 🥟",
  "Sounds perfect ✨",
  "What are you up to this weekend?",
];

export interface ChatPageProps {
  /** The matched profile (provides avatar + name). */
  profile: DatingProfile;
  /** Optional match id (used as a chat room key on the backend). */
  matchId?: string;
  /** Back button handler — typically returns to MatchesPage. */
  onBack: () => void;
}

/** Cheap unique id for messages. */
function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ChatPage({ profile, onBack }: ChatPageProps) {
  const photo = profile.photos?.[0] ?? profile.photo;

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: uid(),
      role: "match",
      text: `Hi 👋 You matched with ${profile.name}! Say hello.`,
      at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  /** Append a message. */
  const push = useCallback((msg: Omit<ChatMessage, "id" | "at">) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: uid(), at: new Date().toISOString() },
    ]);
  }, []);

  /** Mock reply — replace with a real /api/dating/chat POST later. */
  const sendMockReply = useCallback(async () => {
    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 900));
    const text = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
    push({ role: "match", text });
    setIsTyping(false);
  }, [push]);

  /** Send the current input as a user message. */
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    push({ role: "user", text });
    setInput("");
    void sendMockReply();
  }, [input, push, sendMockReply]);

  /** Enter to send, Shift+Enter for newline. */
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group consecutive messages by sender for tighter spacing.
  const grouped = useMemo(() => {
    return messages.map((m, i) => ({
      ...m,
      isFirst: i === 0 || messages[i - 1].role !== m.role,
    }));
  }, [messages]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-2 py-2.5 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to matches"
          className="rounded-full"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex items-center gap-2.5">
          <div className="relative size-9 overflow-hidden rounded-full ring-1 ring-border">
            {photo ? (
              <img
                src={photo}
                alt={profile.name}
                className="size-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-rose-100 text-sm font-bold text-rose-600">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{profile.name}, {profile.age}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {profile.city ? (
                <span>{profile.city}</span>
              ) : (
                "Offline"
              )}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {grouped.map((m) => {
          const isUser = m.role === "user";
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className={cn(
                "flex items-end",
                isUser ? "justify-end" : "justify-start",
                m.isFirst ? "mt-3" : "mt-0.5",
              )}
            >
              <div
                className={cn(
                  "max-w-[78%] whitespace-pre-wrap break-words px-3.5 py-2 text-sm shadow-sm",
                  isUser
                    ? "rounded-2xl rounded-br-md bg-rose-500 text-white"
                    : "rounded-2xl rounded-bl-md bg-muted text-foreground",
                )}
              >
                {m.text}
              </div>
            </motion.div>
          );
        })}

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="mt-2 flex justify-start"
            >
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground/70" />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Input bar */}
      <div
        className="border-t border-border bg-background/80 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
      >
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Message ${profile.name}…`}
            aria-label="Type a message"
            className="h-11 rounded-full bg-muted"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim()}
            aria-label="Send message"
            className="size-11 shrink-0 rounded-full bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40"
          >
            <Send className="size-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
