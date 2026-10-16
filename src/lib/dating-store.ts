/**
 * Milan — AI-Powered Dating for Nepal
 * Copyright (c) 2025 Milan Team
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 */

"use client";

/**
 * Milan dating store (Zustand + persist middleware).
 *
 * Holds the full client-side dating session: the current user, their
 * preferences, the current recommendation deck, the matches list, the
 * active bottom-nav tab, and the currently-selected match for chat.
 * All network calls go through the `/api/dating/*` routes.
 *
 * The store is persisted to `localStorage` under the key
 * `milan-dating-store-v1`. On first load (no persisted state), it
 * initialises with the mock current user + the default preferences.
 *
 * Types (`DatingProfile`, `MatchResult`, `UserPreferences`) are imported
 * as TYPE-ONLY from `@/lib/matching` — they are erased at compile time
 * so the store module loads even if the matching lib has not yet
 * shipped (parallel task). Runtime defaults are defined locally below
 * as a defensive fallback.
 *
 * @see {@link @/lib/matching} — canonical type + data exports.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  DatingProfile,
  MatchResult,
  UserPreferences,
} from "@/lib/matching";

/* ------------------------------------------------------------------ *
 * Fallback defaults (used when no persisted state exists).
 * These mirror the canonical CURRENT_USER / DEFAULT_PREFERENCES that
 * `@/lib/matching` is expected to export; if md-A ships those exports
 * the store can be trivially switched to import them.
 * ------------------------------------------------------------------ */

/** Mock current user — a representative Kathmandu profile. */
export const FALLBACK_CURRENT_USER = {
  id: "u-self",
  name: "Aarav",
  age: 27,
  gender: "male" as const,
  city: "Kathmandu",
  bio: "Engineer by day, trekker by weekend. Looking for someone to share momos and bad puns with.",
  interests: ["hiking", "music", "coffee", "photography", "football"],
  photos: [],
  occupation: "Software Engineer",
  education: "B.E. Computer Engineering, IOE Pulchowk",
  height: 178,
  eloRating: 1240,
  isOnline: true,
  lastActive: new Date().toISOString(),
} as unknown as DatingProfile;

/** Default preferences for a first-time user. */
export const DEFAULT_PREFERENCES = {
  ageRange: [22, 34] as [number, number],
  distanceKm: 25,
  gender: "female" as const,
  cities: ["Kathmandu", "Lalitpur", "Bhaktapur"],
  interests: [],
  lookingFor: "serious" as const,
} as unknown as UserPreferences;

/* ------------------------------------------------------------------ *
 * Store contract
 * ------------------------------------------------------------------ */

/** Bottom-nav tab identifiers. */
export type DatingTab = "discover" | "matches" | "chat" | "profile";

/** Swipe action — accept (right) or reject (left). */
export type SwipeAction = "accept" | "reject";

/** Result of a swipe call. */
export interface SwipeResult {
  matched: boolean;
  matchProfile?: DatingProfile;
}

/** Loading-state flags for granular UI spinners. */
export interface LoadingFlags {
  recommendations: boolean;
  matches: boolean;
  swiping: boolean;
  preferences: boolean;
}

export interface DatingStore {
  /** The signed-in user (mock). `null` until initialised. */
  currentUser: DatingProfile | null;
  /** The user's matching preferences (mirrored server-side). */
  preferences: UserPreferences;
  /** Current recommendation deck (top-first). */
  recommendations: MatchResult[];
  /** Profiles the user has matched with. */
  matches: DatingProfile[];
  /** Active bottom-nav tab. */
  activeTab: DatingTab;
  /** The match currently open in chat (null = none). */
  selectedMatch: DatingProfile | null;
  /** The most recent mutual match — drives the MatchModal. `null` = no modal. */
  lastMatch: DatingProfile | null;
  /** Granular loading flags. */
  loading: LoadingFlags;
  /** Last error message (surfaced as a toast). `null` = no error. */
  error: string | null;

  /* ----- actions ----- */

  /** Fetch a fresh ranked deck from `/api/dating/recommend`. */
  loadRecommendations: () => Promise<void>;
  /** POST a swipe to `/api/dating/swipe`, removes the swiped card, and on a mutual match pushes to `matches` + sets `lastMatch`. */
  swipe: (profileId: string, action: SwipeAction) => Promise<SwipeResult>;
  /** Fetch the matches list from `/api/dating/matches`. */
  loadMatches: () => Promise<void>;
  /** Overlay partial preferences onto the store + persist server-side. */
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  /** Switch the bottom-nav tab. */
  setActiveTab: (tab: DatingTab) => void;
  /** Select a match for chat (or clear with `null`). */
  setSelectedMatch: (m: DatingProfile | null) => void;
  /** Dismiss the MatchModal. */
  clearLastMatch: () => void;
  /** Clear the last error. */
  clearError: () => void;
  /** Hydrate the user profile + preferences from `/api/dating/profile`. */
  loadProfile: () => Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Build an absolute API URL (works on both server-render + client). */
function apiUrl(path: string): string {
  return path; // relative URLs work for fetch on the client.
}

/** Safe JSON fetch helper that throws on non-2xx. */
async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(input), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) detail = `${body.error}`;
    } catch {
      /* ignore */
    }
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ *
 * Store implementation
 * ------------------------------------------------------------------ */

export const useDatingStore = create<DatingStore>()(
  persist(
    (set, get) => ({
      currentUser: FALLBACK_CURRENT_USER,
      preferences: DEFAULT_PREFERENCES,
      recommendations: [],
      matches: [],
      activeTab: "discover",
      selectedMatch: null,
      lastMatch: null,
      loading: {
        recommendations: false,
        matches: false,
        swiping: false,
        preferences: false,
      },
      error: null,

      loadRecommendations: async () => {
        const userId = get().currentUser?.id;
        if (!userId) return;
        set((s) => ({
          loading: { ...s.loading, recommendations: true },
          error: null,
        }));
        try {
          const data = await fetchJson<{
            recommendations: MatchResult[];
            count: number;
          }>("/api/dating/recommend", {
            method: "POST",
            body: JSON.stringify({ userId, n: 10 }),
          });
          set({ recommendations: data.recommendations ?? [] });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
        } finally {
          set((s) => ({
            loading: { ...s.loading, recommendations: false },
          }));
        }
      },

      swipe: async (profileId, action) => {
        const userId = get().currentUser?.id;
        if (!userId) return { matched: false };
        set((s) => ({
          loading: { ...s.loading, swiping: true },
          error: null,
        }));
        try {
          const data = await fetchJson<{
            matched: boolean;
            matchProfile: DatingProfile | null;
          }>("/api/dating/swipe", {
            method: "POST",
            body: JSON.stringify({ userId, profileId, action }),
          });
          // Remove the swiped card from the deck.
          set((s) => ({
            recommendations: s.recommendations.filter(
              (r) => r.profile.id !== profileId,
            ),
          }));
          // On mutual match, prepend to matches + trigger the modal.
          if (data.matched && data.matchProfile) {
            const mp = data.matchProfile;
            set((s) => ({
              matches: s.matches.some((m) => m.id === mp.id)
                ? s.matches
                : [mp, ...s.matches],
              lastMatch: mp,
            }));
          }
          return {
            matched: !!data.matched,
            matchProfile: data.matchProfile ?? undefined,
          };
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
          return { matched: false };
        } finally {
          set((s) => ({ loading: { ...s.loading, swiping: false } }));
        }
      },

      loadMatches: async () => {
        const userId = get().currentUser?.id;
        if (!userId) return;
        set((s) => ({
          loading: { ...s.loading, matches: true },
          error: null,
        }));
        try {
          const data = await fetchJson<{
            matches: DatingProfile[];
            count: number;
          }>(`/api/dating/matches?userId=${encodeURIComponent(userId)}`);
          set({ matches: data.matches ?? [] });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
        } finally {
          set((s) => ({ loading: { ...s.loading, matches: false } }));
        }
      },

      setPreferences: (prefs) => {
        const userId = get().currentUser?.id;
        const merged = { ...get().preferences, ...prefs } as UserPreferences;
        set({ preferences: merged });
        // Best-effort server-side persist (fire-and-forget).
        if (userId) {
          set((s) => ({
            loading: { ...s.loading, preferences: true },
          }));
          fetchJson<{ preferences: UserPreferences }>(
            "/api/dating/profile",
            {
              method: "POST",
              body: JSON.stringify({ userId, preferences: merged }),
            },
          )
            .then((r) => set({ preferences: r.preferences }))
            .catch((err) =>
              set({ error: err instanceof Error ? err.message : String(err) }),
            )
            .finally(() =>
              set((s) => ({
                loading: { ...s.loading, preferences: false },
              })),
            );
        }
      },

      setActiveTab: (tab) => set({ activeTab: tab }),

      setSelectedMatch: (m) => set({ selectedMatch: m }),

      clearLastMatch: () => set({ lastMatch: null }),

      clearError: () => set({ error: null }),

      loadProfile: async () => {
        const userId = get().currentUser?.id;
        if (!userId) return;
        try {
          const data = await fetchJson<{
            profile: DatingProfile | null;
            preferences: UserPreferences;
          }>(`/api/dating/profile?userId=${encodeURIComponent(userId)}`);
          if (data.profile) set({ currentUser: data.profile });
          if (data.preferences) set({ preferences: data.preferences });
        } catch (err) {
          // Non-fatal: keep the fallback current user.
          set({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    }),
    {
      name: "milan-dating-store-v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only persist the user-meaningful slice; transient UI flags
      // (loading, error, lastMatch, selectedMatch, recommendations)
      // are re-derived on load.
      partialize: (s) => ({
        currentUser: s.currentUser,
        preferences: s.preferences,
        activeTab: s.activeTab,
        matches: s.matches,
      }),
    },
  ),
);

/**
 * Convenience hook: select a single field (avoids re-render storms).
 * Usage: `const tab = useDatingField("activeTab");`
 */
export function useDatingField<K extends keyof DatingStore>(
  key: K,
): DatingStore[K] {
  return useDatingStore((s) => s[key]);
}
