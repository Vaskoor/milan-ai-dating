/**
 * CardStack.tsx — Milan AI Dating
 * ---------------------------------------------------------------------------
 * Renders up to three SwipeCards as a stacked deck — the top card is fully
 * interactive (drag + tap), the next two are scaled-down and offset behind
 * it for depth. `AnimatePresence` provides enter/exit animations: when the
 * top card flies off (dragged or programmatically), the next card springs
 * forward to take its place.
 *
 * Action buttons under the deck trigger swipes on the top card
 * programmatically via the SwipeCard imperative ref:
 *   • Reject  (red X)        → swipe("left")
 *   • Super   (amber star)   → swipe("up")
 *   • Accept  (emerald heart) → swipe("right")
 *
 * Empty state shows a friendly "No more profiles" message with a Refresh
 * button so the user can pull a fresh batch.
 *
 * Contract: imports `DatingProfile` from `@/lib/matching/types` and
 * `SwipeAction` from `./SwipeCard`.
 *
 * Copyright (c) 2025 Z.ai — MIT License
 */
"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, RefreshCw, Star, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import SwipeCard, { type SwipeAction, type SwipeCardHandle } from "./SwipeCard";
import type { DatingProfile } from "@/lib/matching/types";

export interface CardStackProps {
  /** Recommendation queue — index 0 is the next card to swipe on. */
  profiles: DatingProfile[];
  /** Fired with the swiped profile + action. Parent optimistically removes
   *  the card from `profiles` (driving the exit animation) and POSTs to
   *  /api/dating/swipe in the background. */
  onSwipe: (profile: DatingProfile, action: SwipeAction) => void;
  /** Fired on a clean tap of the top card — opens ProfileDetailModal. */
  onExpand: (profile: DatingProfile) => void;
  /** Fired when the user taps "Refresh" in the empty state. */
  onRefresh: () => void;
  /** True while a fresh batch is loading — shows a shimmer placeholder. */
  isLoading?: boolean;
}

/** How many cards are visible in the stack at any moment. */
const VISIBLE = 3;

export default function CardStack({
  profiles,
  onSwipe,
  onExpand,
  onRefresh,
  isLoading = false,
}: CardStackProps) {
  const topCardRef = useRef<SwipeCardHandle>(null);

  // Visible slice — index 0 is the top of the deck.
  const visible = profiles.slice(0, VISIBLE);

  /** Convenience handlers wired to the action buttons. */
  function fireSwipe(direction: "left" | "right" | "up"): void {
    topCardRef.current?.swipe(direction);
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
      {/* Card deck */}
      <div
        className="relative aspect-[9/14] w-full max-w-sm"
        aria-label="Profile deck"
      >
        {/* Loading shimmer */}
        {isLoading && visible.length === 0 ? (
          <div className="absolute inset-0 animate-pulse rounded-3xl bg-muted shadow-2xl" />
        ) : null}

        {/* Empty state */}
        {!isLoading && visible.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-border bg-card/50 p-8 text-center shadow-lg">
            <div className="flex size-16 items-center justify-center rounded-full bg-rose-100 text-rose-500">
              <Heart className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">No more profiles</h3>
              <p className="text-sm text-muted-foreground">
                You&apos;ve seen everyone nearby. Refresh to look again.
              </p>
            </div>
            <Button
              onClick={onRefresh}
              variant="default"
              className="bg-rose-500 text-white hover:bg-rose-600"
            >
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
        ) : null}

        {/* Cards (render top-most last so it paints on top via z-index) */}
        <AnimatePresence>
          {visible
            .slice()
            .reverse()
            .map((profile, reversedIndex) => {
              const stackIndex = visible.length - 1 - reversedIndex;
              const isTop = stackIndex === 0;
              const scale = stackIndex === 0 ? 1 : stackIndex === 1 ? 0.95 : 0.9;
              const yShift = stackIndex === 0 ? 0 : stackIndex * 12;
              return (
                <motion.div
                  key={profile.id}
                  className="absolute inset-0"
                  initial={{ scale: 0.85, y: 40, opacity: 0 }}
                  animate={{ scale, y: yShift, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  style={{ zIndex: 30 - stackIndex }}
                >
                  <SwipeCard
                    ref={isTop ? topCardRef : null}
                    profile={profile}
                    isTop={isTop}
                    stackIndex={stackIndex}
                    onSwipe={(action) => onSwipe(profile, action)}
                    onExpand={() => onExpand(profile)}
                  />
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div
        className="flex items-center justify-center gap-5"
        role="group"
        aria-label="Swipe actions"
      >
        <ActionButton
          label="Reject"
          onClick={() => fireSwipe("left")}
          className="border-red-200 bg-white text-red-500 hover:bg-red-50"
          size="lg"
        >
          <X className="size-7" strokeWidth={2.5} />
        </ActionButton>

        <ActionButton
          label="Super like"
          onClick={() => fireSwipe("up")}
          className="border-amber-200 bg-white text-amber-400 hover:bg-amber-50"
          size="md"
        >
          <Star className="size-5" fill="currentColor" strokeWidth={2} />
        </ActionButton>

        <ActionButton
          label="Accept"
          onClick={() => fireSwipe("right")}
          className="border-emerald-200 bg-white text-emerald-500 hover:bg-emerald-50"
          size="lg"
        >
          <Heart className="size-7" fill="currentColor" strokeWidth={2.5} />
        </ActionButton>
      </div>
    </section>
  );
}

/** Circular action button with press feedback. */
function ActionButton({
  children,
  label,
  onClick,
  className,
  size = "md",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "size-14" : size === "md" ? "size-12" : "size-10";
  return (
    <motion.button
      type="button"
      aria-label={label}
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      onClick={onClick}
      disabled={false}
      className={cn(
        "inline-flex items-center justify-center rounded-full border-2 bg-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        sizeClass,
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
