/**
 * MatchModal.tsx — Milan AI Dating
 * ---------------------------------------------------------------------------
 * "It's a Match!" celebration overlay.  Two profile photos side-by-side with
 * an animated heart pulsing between them, a scale-in headline, and two
 * CTA buttons (Send a message / Keep swiping).  A sprinkle of CSS-keyframed
 * falling hearts provides confetti without any external dependency.
 *
 * Visibility is controlled by the `match` prop: when non-null the modal
 * mounts with a scale-in; when set back to null, AnimatePresence fades it
 * out.
 *
 * Contract: imports `DatingProfile` from `@/lib/matching/types`.
 * Defines the local `MatchPayload` shape used by the modal + parent.
 *
 * Copyright (c) 2025 Z.ai — MIT License
 */
"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MessageCircle, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DatingProfile } from "@/lib/matching/types";

export interface MatchPayload {
  /** Unique id for the new match (key for AnimatePresence). */
  matchId: string;
  /** The other person's profile. */
  profile: DatingProfile;
}

export interface MatchModalProps {
  /** When non-null, the modal is shown with the matched profile. */
  match: MatchPayload | null;
  /** Current user's avatar URL (rendered as the left portrait). */
  userPhoto?: string;
  /** Fired when the user taps "Send a message". */
  onSendMessage: (match: MatchPayload) => void;
  /** Fired when the user taps "Keep swiping" or closes the modal. */
  onKeepSwiping: () => void;
}

/** Confetti hearts — generated once per match. */
function useConfettiHearts(seed: string) {
  return useMemo(() => {
    // Deterministic pseudo-random based on the match id so SSR === client.
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const rand = (i: number) => {
      const x = Math.sin((h + i * 9973) * 0.0001) * 10000;
      return x - Math.floor(x);
    };
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: rand(i) * 100,
      delay: rand(i + 100) * 2.5,
      duration: 2.6 + rand(i + 200) * 2,
      size: 14 + Math.floor(rand(i + 300) * 18),
      hue: ["#f43f5e", "#ec4899", "#f59e0b", "#fb7185"][i % 4],
    }));
  }, [seed]);
}

export default function MatchModal({
  match,
  userPhoto,
  onSendMessage,
  onKeepSwiping,
}: MatchModalProps) {
  // Escape to dismiss.
  useEffect(() => {
    if (!match) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKeepSwiping();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [match, onKeepSwiping]);

  const hearts = useConfettiHearts(match?.matchId ?? "idle");

  return (
    <AnimatePresence>
      {match ? (
        <motion.div
          key="match-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-title"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close match celebration"
            onClick={onKeepSwiping}
            className="absolute inset-0 bg-gradient-to-br from-rose-600/95 via-pink-700/95 to-fuchsia-900/95 backdrop-blur-sm"
          />

          {/* Confetti hearts */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {hearts.map((h) => (
              <span
                key={h.id}
                style={{
                  left: `${h.left}%`,
                  width: h.size,
                  height: h.size,
                  color: h.hue,
                  animation: `milan-fall ${h.duration}s linear ${h.delay}s infinite`,
                }}
                className="absolute -top-8 block"
                aria-hidden="true"
              >
                <Heart className="size-full" fill="currentColor" />
              </span>
            ))}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onKeepSwiping}
            aria-label="Dismiss"
            className="absolute right-4 top-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30"
          >
            <X className="size-5" />
          </button>

          {/* Content */}
          <motion.div
            className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 px-6 text-center"
            initial={{ scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            {/* Avatars + heart */}
            <div className="flex items-center justify-center gap-2">
              <motion.div
                initial={{ x: -40, opacity: 0, rotate: -10 }}
                animate={{ x: 0, opacity: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 22 }}
                className="relative"
              >
                <Avatar src={userPhoto} alt="You" ring="ring-white" />
              </motion.div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.4, 1] }}
                transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
                className="flex size-14 items-center justify-center rounded-full bg-white shadow-xl"
              >
                <Heart
                  className="size-7 text-rose-500"
                  fill="currentColor"
                  aria-hidden="true"
                />
              </motion.div>

              <motion.div
                initial={{ x: 40, opacity: 0, rotate: 10 }}
                animate={{ x: 0, opacity: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 22 }}
                className="relative"
              >
                <Avatar
                  src={match.profile.photos?.[0] ?? match.profile.photo}
                  alt={match.profile.name}
                  ring="ring-white"
                />
              </motion.div>
            </div>

            {/* Headline */}
            <div className="space-y-1">
              <motion.h2
                id="match-title"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.55, type: "spring", stiffness: 300, damping: 18 }}
                className="text-4xl font-black tracking-tight text-white drop-shadow-md"
              >
                It&apos;s a Match!
              </motion.h2>
              <p className="flex items-center justify-center gap-1.5 text-sm text-white/85">
                <Sparkles className="size-4" aria-hidden="true" />
                You and {match.profile.name} liked each other.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex w-full flex-col gap-3">
              <Button
                onClick={() => onSendMessage(match)}
                className="h-12 w-full gap-2 rounded-full bg-white text-base font-semibold text-rose-600 shadow-lg hover:bg-rose-50"
              >
                <MessageCircle className="size-5" />
                Send a message
              </Button>
              <Button
                onClick={onKeepSwiping}
                variant="ghost"
                className="h-11 w-full rounded-full text-base font-medium text-white/90 hover:bg-white/10 hover:text-white"
              >
                Keep swiping
              </Button>
            </div>
          </motion.div>

          {/* Inline keyframes for falling hearts */}
          <style>{`
            @keyframes milan-fall {
              0%   { transform: translateY(-20px) rotate(0deg);   opacity: 0; }
              10%  { opacity: 1; }
              100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
            }
          `}</style>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Round avatar portrait with a colored ring. */
function Avatar({
  src,
  alt,
  ring,
}: {
  src?: string;
  alt: string;
  ring: string;
}) {
  return (
    <div
      className={cn(
        "size-24 overflow-hidden rounded-full ring-4 ring-offset-2 ring-offset-rose-700 shadow-xl",
        ring,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-white/30 text-3xl font-bold text-white">
          {alt.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
