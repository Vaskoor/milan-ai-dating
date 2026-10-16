/**
 * MatchesPage.tsx — Milan AI Dating
 * ---------------------------------------------------------------------------
 * Grid of matched profiles.  Each tile shows the match's photo, name + age
 * and a one-line preview ("New match · tap to say hi" until a chat backend
 * is wired).  Tapping a tile fires `onOpenChat(matchId, profile)` so the
 * parent can swap to ChatPage.
 *
 * Empty state: friendly "No matches yet — start swiping!" callout.
 *
 * Contract: imports `DatingProfile` from `@/lib/matching/types`.  The
 * endpoint `GET /api/dating/matches?userId=X` returns
 * `{ matches: DatingProfile[]; count; userId }`.
 *
 * Copyright (c) 2025 Z.ai — MIT License
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DatingProfile } from "@/lib/matching/types";

export interface MatchesPageProps {
  /** Logged-in user id. */
  userId: string;
  /** Fired when the user taps a match tile. */
  onOpenChat: (matchId: string, profile: DatingProfile) => void;
  /** Optional: parent can request a navigation to the Discover tab. */
  onStartSwiping?: () => void;
}

export default function MatchesPage({
  userId,
  onOpenChat,
  onStartSwiping,
}: MatchesPageProps) {
  const [matches, setMatches] = useState<DatingProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dating/matches?userId=${encodeURIComponent(userId)}`,
      );
      if (!res.ok) throw new Error(`Matches failed: ${res.status}`);
      const data = (await res.json()) as
        | DatingProfile[]
        | { matches?: DatingProfile[] };
      setMatches(Array.isArray(data) ? data : data.matches ?? []);
    } catch (err) {
      console.error("[MatchesPage] load:", err);
      setError("Couldn't load matches.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Loading skeletons
  if (isLoading && matches.length === 0) {
    return (
      <Page title="Matches">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-3/4 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      </Page>
    );
  }

  // Empty state
  if (matches.length === 0 && !error) {
    return (
      <Page title="Matches">
        <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-border bg-card/50 px-6 py-12 text-center shadow-sm">
          <div className="flex size-16 items-center justify-center rounded-full bg-rose-100 text-rose-500">
            <Heart className="size-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">No matches yet</h3>
            <p className="text-sm text-muted-foreground">
              Start swiping to find your match in Nepal.
            </p>
          </div>
          {onStartSwiping ? (
            <Button
              onClick={onStartSwiping}
              className="bg-rose-500 text-white hover:bg-rose-600"
            >
              <Heart className="size-4" /> Start swiping
            </Button>
          ) : null}
        </div>
      </Page>
    );
  }

  // Error toast
  if (error) {
    return (
      <Page title="Matches">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-red-200 bg-red-50 px-6 py-10 text-center text-red-700">
          <p className="text-sm">{error}</p>
          <Button variant="ghost" onClick={load} className="text-red-700">
            Retry
          </Button>
        </div>
      </Page>
    );
  }

  // Grid of matches
  return (
    <Page
      title="Matches"
      subtitle={`${matches.length} ${matches.length === 1 ? "match" : "matches"}`}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {matches.map((profile, idx) => {
          const photo = profile.photos?.[0] ?? profile.photo;
          const matchId = `match_${profile.id}`;
          return (
            <motion.button
              key={profile.id}
              type="button"
              onClick={() => onOpenChat(matchId, profile)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: idx * 0.04,
                type: "spring",
                stiffness: 300,
                damping: 26,
              }}
              whileTap={{ scale: 0.97 }}
              className="group relative aspect-3/4 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-md"
              aria-label={`Open chat with ${profile.name}`}
            >
              {/* Photo */}
              {photo ? (
                <img
                  src={photo}
                  alt={profile.name}
                  className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-rose-200 to-pink-300" />
              )}

              {/* Dark gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

              {/* Verified pip */}
              {profile.verified ? (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-sky-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow backdrop-blur">
                  ✓
                </span>
              ) : null}

              {/* Info */}
              <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                <p className="truncate text-sm font-semibold drop-shadow">
                  {profile.name}, {profile.age}
                </p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/80">
                  <MessageCircle className="size-3 shrink-0" />
                  <span className="truncate">New match · tap to say hi</span>
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </Page>
  );
}

/** Page wrapper with consistent title + subtitle. */
function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-6 pt-4">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle ? (
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        ) : null}
      </header>
      {children}
    </div>
  );
}
