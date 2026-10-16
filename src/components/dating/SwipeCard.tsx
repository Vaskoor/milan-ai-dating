/**
 * SwipeCard.tsx — Milan AI Dating
 * ---------------------------------------------------------------------------
 * The draggable profile card at the heart of the Milan swipe experience.
 *
 * Powered by framer-motion: a single `useMotionValue` tracks the horizontal
 * drag offset; `useTransform` derives the tilt (rotate), the green "LIKE"
 * overlay opacity (right swipe), and the red "NOPE" overlay opacity (left
 * swipe).  Releasing the card past ±100px fires the matching action and
 * the card animates off-screen before the parent removes it from the queue.
 *
 * Imperative API: parent components can attach a `ref` of type
 * `SwipeCardHandle` and call `.swipe("left" | "right" | "up")` to trigger
 * accept / reject / super-like programmatically (used by the action buttons
 * in CardStack).
 *
 * Contract: imports `DatingProfile` from `@/lib/matching/types`. The local
 * `SwipeAction` type adds a Milan-only `superlike` affordance (the backend
 * `/api/dating/swipe` endpoint persists only `accept` / `reject`).
 *
 * Copyright (c) 2025 Z.ai — MIT License
 */
"use client";

import { forwardRef, useImperativeHandle } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from "framer-motion";
import { BadgeCheck, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DatingProfile } from "@/lib/matching/types";

/**
 * UI swipe action. `superlike` is a Milan-only UI affordance — the backend
 * `/api/dating/swipe` endpoint only persists `accept` / `reject`, so the
 * parent (`DiscoverPage`) maps `superlike` → `accept` when posting.
 */
export type SwipeAction = "accept" | "reject" | "superlike";

/** Imperative API exposed via ref so parents can trigger swipes. */
export interface SwipeCardHandle {
  /** Animate the card off-screen in the given direction, then fire onSwipe. */
  swipe: (direction: "left" | "right" | "up") => void;
}

export interface SwipeCardProps {
  /** The profile rendered by this card. */
  profile: DatingProfile;
  /** True only for the topmost card in the stack (gets drag + tap). */
  isTop: boolean;
  /** Stack depth: 0 = top, 1 = next, 2 = back. */
  stackIndex: number;
  /** Fired after the card finishes flying off-screen. */
  onSwipe: (action: SwipeAction) => void;
  /** Fired on a clean tap (no drag) — opens the expanded profile. */
  onExpand: () => void;
}

const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { profile, isTop, stackIndex, onSwipe, onExpand },
  ref,
) {
  // Drag offset — single source of truth for tilt + overlay opacities.
  const x = useMotionValue(0);
  // Vertical motion value — only animated programmatically (super-like).
  const y = useMotionValue(0);

  // Tilt: -18° at -200px, 0 at rest, +18° at +200px.
  const rotate = useTransform(x, [-200, 0, 200], [-18, 0, 18]);
  // LIKE overlay: invisible at rest, fully visible past +100px.
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  // NOPE overlay: fully visible past -100px, invisible at rest.
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  // Programmatic swipe entry-point used by the action buttons.
  useImperativeHandle(
    ref,
    () => ({
      swipe: (direction: "left" | "right" | "up") => {
        const targetX = direction === "right" ? 1000 : direction === "left" ? -1000 : 0;
        const targetY = direction === "up" ? -1000 : 0;
        const action: SwipeAction =
          direction === "right" ? "accept" : direction === "left" ? "reject" : "superlike";
        const animX = animate(x, targetX, { duration: 0.3, ease: "easeIn" });
        if (targetY !== 0) {
          const animY = animate(y, targetY, { duration: 0.3, ease: "easeIn" });
          void Promise.all([animX, animY]).then(() => onSwipe(action));
        } else {
          void animX.then(() => onSwipe(action));
        }
      },
    }),
    [x, y, onSwipe],
  );

  /** Drag release handler — fires accept/reject past ±100px, else springs back. */
  function handleDragEnd(_: unknown, info: PanInfo): void {
    if (!isTop) return;
    if (info.offset.x > 100) {
      void animate(x, 1000, { duration: 0.3, ease: "easeIn" }).then(() =>
        onSwipe("accept"),
      );
    } else if (info.offset.x < -100) {
      void animate(x, -1000, { duration: 0.3, ease: "easeIn" }).then(() =>
        onSwipe("reject"),
      );
    }
    // Otherwise dragSnapToOrigin returns the card to x = 0.
  }

  const photo =
    profile.photos?.[0] ??
    profile.photo ??
    "https://placehold.co/600x900/1f2937/ffffff?text=Milan";

  return (
    <motion.article
      style={{ x, y, rotate }}
      drag={isTop ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.6}
      dragDirectionLock
      whileTap={isTop ? { scale: 0.98 } : undefined}
      onTap={isTop ? onExpand : undefined}
      onDragEnd={handleDragEnd}
      className={cn(
        "absolute inset-0 overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-black/5 select-none touch-none",
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
      )}
      aria-label={`${profile.name}, ${profile.age} years old, from ${profile.city}`}
      data-stack-index={stackIndex}
    >
      {/* Profile photo */}
      <img
        src={photo}
        alt={`Photo of ${profile.name}`}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* Dark gradient overlay (bottom) */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent"
        aria-hidden="true"
      />

      {/* LIKE overlay (right swipe) */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute right-6 top-8 -rotate-12"
        aria-hidden="true"
      >
        <span className="rounded-xl border-4 border-emerald-500 px-4 py-1 text-3xl font-black uppercase tracking-widest text-emerald-500 drop-shadow-[0_2px_8px_rgba(16,185,129,0.4)]">
          Like
        </span>
      </motion.div>

      {/* NOPE overlay (left swipe) */}
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="pointer-events-none absolute left-6 top-8 -rotate-12"
        aria-hidden="true"
      >
        <span className="rounded-xl border-4 border-red-500 px-4 py-1 text-3xl font-black uppercase tracking-widest text-red-500 drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)]">
          Nope
        </span>
      </motion.div>

      {/* Verified badge (top-left) */}
      <div className="absolute left-4 top-4 flex items-center gap-1.5">
        {profile.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/90 px-2.5 py-1 text-xs font-semibold text-white shadow-md backdrop-blur">
            <BadgeCheck className="size-3.5" /> Verified
          </span>
        ) : null}
      </div>

      {/* Bottom info block */}
      <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 text-white">
        <div className="flex items-center gap-2">
          <h3 className="text-2xl font-bold leading-tight drop-shadow-md">
            {profile.name}, <span className="font-semibold">{profile.age}</span>
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-white/85 drop-shadow">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span>{profile.city}</span>
        </div>

        {profile.bio ? (
          <p className="line-clamp-2 text-sm text-white/90 drop-shadow-sm">
            {profile.bio}
          </p>
        ) : null}

        {profile.interests && profile.interests.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {profile.interests.slice(0, 5).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="border-white/20 bg-white/15 text-white backdrop-blur-sm"
              >
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </motion.article>
  );
});

export default SwipeCard;
