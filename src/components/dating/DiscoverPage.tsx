/**
 * DiscoverPage.tsx — Milan AI Dating
 * ---------------------------------------------------------------------------
 * Main swipe surface. Owns the recommendation queue: pulls a batch from
 * `POST /api/dating/recommend { userId, n }`, hands the top of the queue to
 * `CardStack`, and on every swipe optimistically pops the card and POSTs to
 * `POST /api/dating/swipe { userId, profileId, action }`.  If the server
 * reports a mutual match, fires `onMatch` so the parent can show the
 * MatchModal.
 *
 * Header carries the "Milan" wordmark + a filter button that opens the
 * preference settings (ProfilePage) via `onOpenFilters`.  A tap on the top
 * card opens the expanded ProfileDetailModal via `onOpenProfile`.
 *
 * Contract: imports `DatingProfile` + `MatchResult` from
 * `@/lib/matching/types` and the local `SwipeAction`/`MatchPayload` types.
 *
 * Copyright (c) 2025 Z.ai — MIT License
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import CardStack from "./CardStack";
import type { MatchPayload } from "./MatchModal";
import type { SwipeAction } from "./SwipeCard";
import type { DatingProfile, MatchResult } from "@/lib/matching/types";

const FETCH_BATCH = 10;

export interface DiscoverPageProps {
  /** Logged-in user id — sent to the recommend + swipe APIs. */
  userId: string;
  /** Fired when a swipe results in a mutual match. */
  onMatch: (match: MatchPayload) => void;
  /** Fired on a clean tap of the top card (opens ProfileDetailModal). */
  onOpenProfile: (profile: DatingProfile) => void;
  /** Fired when the filter button is tapped (opens preference settings). */
  onOpenFilters: () => void;
}

export default function DiscoverPage({
  userId,
  onMatch,
  onOpenProfile,
  onOpenFilters,
}: DiscoverPageProps) {
  const [queue, setQueue] = useState<DatingProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Fetch a fresh batch of recommendations. */
  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dating/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, n: FETCH_BATCH }),
      });
      if (!res.ok) throw new Error(`Recommend failed: ${res.status}`);
      const data = (await res.json()) as
        | { recommendations?: MatchResult[] }
        | MatchResult[];
      const list = Array.isArray(data) ? data : data.recommendations ?? [];
      const next: DatingProfile[] = list.map((m) => m.profile);
      setQueue((prev) => {
        // De-duplicate against anything still in the queue.
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((p) => !seen.has(p.id))];
      });
    } catch (err) {
      console.error("[DiscoverPage] loadRecommendations:", err);
      setError("Couldn't load profiles. Pull to refresh.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Initial load + auto-fetch when the queue gets short.
  useEffect(() => {
    if (queue.length === 0 && !isLoading && !error) {
      void loadRecommendations();
    }
  }, [queue.length, isLoading, error, loadRecommendations]);

  /** Handle a swipe — optimistic removal + server-side match check. */
  const handleSwipe = useCallback(
    async (profile: DatingProfile, action: SwipeAction) => {
      // 1) Optimistically pop the top card (drives AnimatePresence exit).
      setQueue((prev) => prev.filter((p) => p.id !== profile.id));

      // 2) Persist the swipe to the backend and check for a mutual match.
      //    Milan's API only knows `accept` / `reject`; a UI `superlike` is
      //    treated as an `accept` for the backend record.
      const apiAction = action === "superlike" ? "accept" : action;
      try {
        const res = await fetch("/api/dating/swipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            profileId: profile.id,
            action: apiAction,
          }),
        });
        if (!res.ok) throw new Error(`Swipe failed: ${res.status}`);
        const payload = (await res.json()) as {
          matched?: boolean;
          matchProfile?: DatingProfile | null;
          swipeId?: string;
        };
        if (payload.matched && payload.matchProfile) {
          onMatch({
            matchId: payload.swipeId ?? `match_${profile.id}`,
            profile: payload.matchProfile,
          });
        }
      } catch (err) {
        console.error("[DiscoverPage] swipe:", err);
        // Silently fail — the card has already visually swiped off.
      }
    },
    [userId, onMatch],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <h1 className="flex items-baseline gap-1.5 text-2xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-rose-500 to-pink-600 bg-clip-text text-transparent">
            Milan
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            AI Dating
          </span>
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenFilters}
          aria-label="Open preferences"
          className="rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
        >
          <SlidersHorizontal className="size-5" />
        </Button>
      </header>

      {/* Card stack (renders its own action buttons below the deck) */}
      <main className="flex flex-1 items-center justify-center px-4 py-2">
        <CardStack
          profiles={queue}
          onSwipe={handleSwipe}
          onExpand={onOpenProfile}
          onRefresh={loadRecommendations}
          isLoading={isLoading && queue.length === 0}
        />
      </main>

      {/* Inline error toast */}
      {error ? (
        <div
          className={cn(
            "mx-auto mb-3 flex max-w-md items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700",
          )}
          role="alert"
        >
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadRecommendations}
            className="text-red-700 hover:bg-red-100"
          >
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
