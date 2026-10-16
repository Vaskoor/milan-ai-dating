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
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * Shared type definitions for the Milan matching / recommendation engine.
 *
 * These types are the public contract between the data layer (`data.ts`),
 * the scoring primitives (`scoring.ts` / `collab.ts` / `bandit.ts`) and the
 * hybrid `MatchingEngine` (`engine.ts`). They are consumed by the Next.js
 * API routes under `src/app/api/dating/*`.
 *
 * Everything here is a pure type declaration — no runtime code, no side
 * effects, fully tree-shakeable.
 */

/** Biological / self-reported gender. */
export type Gender = 'male' | 'female';

/** Drinking + smoking share the same ordinal scale. */
export type DrinkingSmoking = 'never' | 'sometimes' | 'often';

/** Dietary preference. */
export type Diet = 'veg' | 'non-veg' | 'eggetarian';

/** Existing / desired children status. */
export type KidsPreference = 'none' | 'want' | 'have';

/** What kind of relationship the profile is seeking. */
export type RelationshipType = 'casual' | 'serious' | 'marriage';

/** Who the user wants to be matched with. */
export type GenderPreference = 'male' | 'female' | 'both';

/**
 * Lifestyle factors used for compatibility scoring. Each field is an ordinal
 * or categorical label rather than a free-text blob so the scoring functions
 * can compare them with O(1) equality.
 */
export interface Lifestyle {
  drinking: DrinkingSmoking;
  smoking: DrinkingSmoking;
  diet: Diet;
  kids: KidsPreference;
  relationshipType: RelationshipType;
}

/**
 * A dating profile. This is the unit of the recommendation pool and also the
 * shape of the "current user" resolved inside the engine.
 *
 * `elo` is a Tinder-style desirability score that starts at 1200 and drifts
 * up/down as the profile receives accepts / rejects (the engine treats it as
 * a normalised signal in `eloFactor`).
 */
export interface DatingProfile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  city: string;
  lat: number;
  lng: number;
  bio: string;
  photo: string;
  photos: string[];
  /** Canonical interest tags (trekking, photography, music, cooking, …). */
  interests: string[];
  education: string;
  occupation: string;
  /** Height in centimetres. */
  height: number;
  lifestyle: Lifestyle;
  /** Desirability score, starts at 1200. */
  elo: number;
  verified: boolean;
}

/**
 * User-side matching preferences. `lifestyle` is partial because a user may
 * leave some factors as "no preference" — those are ignored when scoring.
 */
export interface UserPreferences {
  ageMin: number;
  ageMax: number;
  genderPreference: GenderPreference;
  maxDistanceKm: number;
  /** Interests the candidate MUST share (intersected for the must-match rule). */
  interests: string[];
  lifestyle: Partial<Lifestyle>;
}

/** A single swipe event. Used both for live recording and CF warm-start. */
export interface SwipeRecord {
  userId: string;
  profileId: string;
  action: 'accept' | 'reject';
  timestamp: number;
}

/**
 * A single ranked candidate plus its composite score, the per-component
 * breakdown, and a human-readable explanation string.
 *
 * `scores` is a flat numeric record keyed by component name
 * (interest, age, geo, lifestyle, education, content, collab, elo,
 * novelty, distanceKm, composite) so the API layer can serialise it as-is.
 */
export interface MatchResult {
  profile: DatingProfile;
  score: number;
  scores: Record<string, number>;
  reason: string;
}

/**
 * Result envelope returned by {@link MatchingEngine.recommend} (spec form).
 * The 2-arg route-compatible overload returns just `MatchResult[]`.
 */
export interface RecommendationResult {
  recommendations: MatchResult[];
  totalPool: number;
}

/**
 * Tunable weights and exploration knobs for the hybrid engine.
 *
 * The four `w_*` weights are normalised internally so they always sum to 1
 * before blending — callers can pass raw proportions safely.
 */
export interface MatchingConfig {
  /** Weight of the content-based component. */
  w_content: number;
  /** Weight of the collaborative-filtering component. */
  w_collab: number;
  /** Weight of the Elo desirability component. */
  w_elo: number;
  /** Weight of the exploration / novelty component. */
  w_novelty: number;
  /** UCB exploration constant c. Defaults to √2. */
  explorationFactor: number;
  /** ε for epsilon-greedy cold-start exploration. */
  epsilon: number;
  /** Jaccard threshold above which two consecutive recs are "too similar". */
  diversityThreshold: number;
  /** Swipes below this count trigger the cold-start branch. */
  coldStartThreshold: number;
  /** Master RNG seed — guarantees deterministic rankings for a given state. */
  seed: number;
}
