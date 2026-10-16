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
 * The hybrid recommendation engine for Milan.
 *
 * `MatchingEngine` blends four signals into a single composite score per
 * candidate:
 *
 *   * **content** — Jaccard interests, Gaussian age band, exponential
 *     geo-decay, weighted lifestyle agreement, ordinal education proximity.
 *   * **collab** — user-based collaborative filtering over accepted sets.
 *   * **elo** — normalised Tinder-style desirability.
 *   * **novelty** — multi-armed-bandit exploration (UCB in warm start,
 *     Thompson sampling in cold start).
 *
 * Cold start (user has < `coldStartThreshold` swipes) leans on content +
 * ε-greedy exploration; warm start leans on collab + Elo + UCB. After
 * ranking, a greedy diversity filter prevents two consecutive recs from
 * sharing more than `diversityThreshold` of their interests.
 *
 * The engine is deterministic for a given `(config, state)` tuple — every
 * randomness source flows through the seeded `mulberry32` PRNG.
 */

import type {
  DatingProfile,
  Lifestyle,
  MatchResult,
  MatchingConfig,
  RecommendationResult,
  SwipeRecord,
  UserPreferences,
} from './types';
import {
  ageCompatibility,
  educationCompatibility,
  eloFactor,
  geospatialDistance,
  haversineKm,
  interestJaccard,
  lifestyleCompatibility,
} from './scoring';
import { collaborativeScore } from './collab';
import { epsilonGreedy, thompsonSample, ucbScore } from './bandit';
import { getCurrentUser, getDefaultPreferences, hashString, mulberry32 } from './data';

/* ------------------------------------------------------------------ */
/* Configuration defaults                                              */
/* ------------------------------------------------------------------ */

/**
 * Sensible default weights + exploration knobs. Weights are normalised
 * internally so they always sum to 1 before blending.
 */
export const DEFAULT_CONFIG: MatchingConfig = {
  w_content: 0.35,
  w_collab: 0.25,
  w_elo: 0.15,
  w_novelty: 0.25,
  explorationFactor: Math.sqrt(2),
  epsilon: 0.1,
  diversityThreshold: 0.8,
  coldStartThreshold: 5,
  seed: 42,
};

/** Internal weights for the content sub-score (sum = 1). */
const CONTENT_WEIGHTS = {
  interest: 0.3,
  age: 0.15,
  geo: 0.25,
  lifestyle: 0.2,
  education: 0.1,
} as const;

/** Soft age buffer applied during the pre-filter pass. */
const AGE_PRE_FILTER_BUFFER = 5;
/** Soft distance buffer (× maxDistanceKm) applied during pre-filter. */
const DISTANCE_PRE_FILTER_FACTOR = 1.5;

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export class MatchingEngine {
  /** The recommendation pool (immutable reference). */
  private readonly profiles: DatingProfile[];

  /** Mutable swipe log — `recordSwipe` appends here. */
  private swipeHistory: SwipeRecord[];

  /** Resolved + frozen config. */
  private readonly config: MatchingConfig;

  /** Per-user preference store (overlay on top of defaults). */
  private readonly prefsStore: Map<string, UserPreferences> = new Map();

  /**
   * The user resolved during the most recent `recommend` call. Stored so
   * `explainScore` can produce distance / shared-interest phrases without
   * the caller having to thread the user object back through.
   */
  private activeUser: DatingProfile | null = null;

  /**
   * Construct a hybrid engine.
   *
   * @param profiles - the recommendation pool.
   * @param swipeHistory - the warm-start swipe log.
   * @param config - optional partial override of {@link DEFAULT_CONFIG}.
   */
  constructor(
    profiles: DatingProfile[],
    swipeHistory: SwipeRecord[],
    config?: Partial<MatchingConfig>,
  ) {
    this.profiles = profiles;
    this.swipeHistory = swipeHistory.slice();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /* ---------------------------------------------------------------- */
  /* Public: recommendation                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Spec form — rank `n` candidates for `userId` given `preferences`.
   * Returns the full {@link RecommendationResult} envelope (recs + pool size).
   */
  public recommend(
    userId: string,
    preferences: UserPreferences,
    n: number,
  ): RecommendationResult;

  /**
   * Route-compatible form — rank `n` candidates for `userId` using the
   * user's stored preferences (or engine defaults). Returns the bare
   * ranked array so `/api/dating/recommend` can serialise it directly.
   */
  public recommend(userId: string, n: number): MatchResult[];

  public recommend(
    userId: string,
    a: UserPreferences | number,
    b?: number,
  ): RecommendationResult | MatchResult[] {
    let preferences: UserPreferences;
    let n: number;
    let returnArray: boolean;

    if (typeof a === 'number') {
      preferences = this.getPreferences(userId);
      n = a;
      returnArray = true;
    } else {
      preferences = a;
      n = b ?? 10;
      returnArray = false;
    }

    const result = this.computeRecommendations(userId, preferences, n);
    return returnArray ? result.recommendations : result;
  }

  /* ---------------------------------------------------------------- */
  /* Public: swipe recording                                           */
  /* ---------------------------------------------------------------- */

  /** Spec form — record a fully-formed {@link SwipeRecord}. */
  public recordSwipe(swipe: SwipeRecord): void;

  /**
   * Route-compatible form — record a swipe from its primitive fields.
   * Timestamps itself with `Date.now()` (live, non-deterministic by design).
   */
  public recordSwipe(
    userId: string,
    profileId: string,
    action: 'accept' | 'reject',
  ): void;

  public recordSwipe(
    a: SwipeRecord | string,
    profileId?: string,
    action?: 'accept' | 'reject',
  ): void {
    let swipe: SwipeRecord;
    if (typeof a === 'string') {
      swipe = {
        userId: a,
        profileId: profileId ?? '',
        action: action ?? 'reject',
        timestamp: Date.now(),
      };
    } else {
      swipe = a;
    }
    this.swipeHistory.push(swipe);
  }

  /* ---------------------------------------------------------------- */
  /* Public: introspection (used by API routes)                        */
  /* ---------------------------------------------------------------- */

  /**
   * Look up a profile by id in the pool.
   *
   * @param profileId - the profile id to find.
   * @returns the profile, or `null` if unknown.
   */
  public getUserProfile(profileId: string): DatingProfile | null {
    return this.profiles.find((p) => p.id === profileId) ?? null;
  }

  /**
   * Return the user's stored preferences, falling back to engine defaults.
   *
   * @param userId - the user id.
   * @returns a {@link UserPreferences} object (never null).
   */
  public getPreferences(userId: string): UserPreferences {
    return this.prefsStore.get(userId) ?? getDefaultPreferences();
  }

  /**
   * Overlay a (possibly partial) preferences object onto the user's record.
   *
   * Accepts **both** the canonical spec shape (`ageMin`/`ageMax`/
   * `maxDistanceKm`/`genderPreference`/`interests`/`lifestyle`) and the
   * legacy route shape (`ageRange: [min,max]`, `distanceKm`, `gender`).
   * The two are normalised into the canonical shape internally.
   *
   * @param userId - the user id.
   * @param partial - a partial preferences object (canonical or legacy shape).
   */
  public updatePreferences(
    userId: string,
    partial: Partial<UserPreferences>,
  ): void {
    const base = this.prefsStore.get(userId) ?? getDefaultPreferences();
    const merged: UserPreferences = {
      ageMin: base.ageMin,
      ageMax: base.ageMax,
      genderPreference: base.genderPreference,
      maxDistanceKm: base.maxDistanceKm,
      interests: base.interests.slice(),
      lifestyle: { ...base.lifestyle },
    };

    // Canonical shape.
    if (typeof partial.ageMin === 'number') merged.ageMin = partial.ageMin;
    if (typeof partial.ageMax === 'number') merged.ageMax = partial.ageMax;
    if (partial.genderPreference !== undefined) {
      merged.genderPreference = partial.genderPreference;
    }
    if (typeof partial.maxDistanceKm === 'number') {
      merged.maxDistanceKm = partial.maxDistanceKm;
    }
    if (Array.isArray(partial.interests)) {
      merged.interests = (partial.interests as unknown[]).filter(
        (x): x is string => typeof x === 'string',
      );
    }
    if (
      partial.lifestyle !== undefined &&
      typeof partial.lifestyle === 'object' &&
      partial.lifestyle !== null
    ) {
      merged.lifestyle = {
        ...merged.lifestyle,
        ...(partial.lifestyle as Partial<Lifestyle>),
      };
    }

    // Legacy route shape (`ageRange`, `distanceKm`, `gender`).
    const raw = partial as unknown as Record<string, unknown>;
    if (Array.isArray(raw.ageRange) && (raw.ageRange as unknown[]).length === 2) {
      const range = raw.ageRange as number[];
      const lo = Number(range[0]);
      const hi = Number(range[1]);
      if (Number.isFinite(lo)) merged.ageMin = lo;
      if (Number.isFinite(hi)) merged.ageMax = hi;
    }
    if (typeof raw.distanceKm === 'number') merged.maxDistanceKm = raw.distanceKm;
    if (typeof raw.gender === 'string') {
      if (raw.gender === 'any' || raw.gender === 'other') {
        merged.genderPreference = 'both';
      } else if (raw.gender === 'male' || raw.gender === 'female') {
        merged.genderPreference = raw.gender;
      }
    }

    this.prefsStore.set(userId, merged);
  }

  /**
   * Compute the bidirectional accept–accept matches for a user.
   *
   * Two users "match" when each has accepted the other. Returns the
   * matched profiles (resolved from the pool).
   *
   * @param userId - the user id.
   * @returns the profiles the user has mutually matched with.
   */
  public getMatches(userId: string): DatingProfile[] {
    const acceptedBy = new Map<string, Set<string>>();
    for (const s of this.swipeHistory) {
      if (s.action !== 'accept') continue;
      let set = acceptedBy.get(s.userId);
      if (!set) {
        set = new Set<string>();
        acceptedBy.set(s.userId, set);
      }
      set.add(s.profileId);
    }

    const userAccept = acceptedBy.get(userId);
    if (!userAccept) return [];

    const matches: DatingProfile[] = [];
    for (const pid of userAccept) {
      const reciprocal = acceptedBy.get(pid);
      if (reciprocal && reciprocal.has(userId)) {
        const profile = this.getUserProfile(pid);
        if (profile) matches.push(profile);
      }
    }
    return matches;
  }

  /* ---------------------------------------------------------------- */
  /* Public: explanation                                              */
  /* ---------------------------------------------------------------- */

  /**
   * Produce a human-readable reason for a recommendation.
   *
   * Composed from the strongest signals in `scores` plus the active user's
   * geospatial + interest overlap with the profile, e.g.:
   *   "92% interest overlap · 3km away · both love trekking, foodie, travel".
   *
   * Relies on {@link activeUser} set during `recommend`; if no active user is
   * available only the numeric signals are used.
   *
   * @param profile - the recommended profile.
   * @param scores - the per-component score breakdown.
   * @returns a single reason string.
   */
  public explainScore(
    profile: DatingProfile,
    scores: Record<string, number>,
  ): string {
    const parts: string[] = [];

    const interestPct = Math.round((scores.interest ?? 0) * 100);
    parts.push(`${interestPct}% interest overlap`);

    const user = this.activeUser;
    if (user) {
      const km = haversineKm(user.lat, user.lng, profile.lat, profile.lng);
      parts.push(`${Math.round(km)}km away`);

      const shared = user.interests.filter((i) => profile.interests.includes(i));
      if (shared.length > 0) {
        parts.push(`both love ${shared.slice(0, 3).join(', ')}`);
      }
    }

    if ((scores.lifestyle ?? 0) >= 0.8) parts.push('lifestyle aligned');
    if ((scores.elo ?? 0) >= 0.75) parts.push('highly desired');
    if ((scores.age ?? 0) >= 0.99) parts.push('in your age range');
    if ((scores.collab ?? 0) >= 0.6) parts.push('popular with similar users');

    return parts.join(' · ');
  }

  /* ---------------------------------------------------------------- */
  /* Internal: the core pipeline                                       */
  /* ---------------------------------------------------------------- */

  /**
   * Resolve the DatingProfile for `userId`: pool lookup → `getCurrentUser`
   * base (Rajan) with the preference lifestyle overlaid. The user's *own*
   * interests come from the resolved profile, NOT from `preferences.interests`
   * — the latter is a separate must-match filter applied in the candidate
   * filter pass.
   */
  private resolveUser(
    userId: string,
    preferences: UserPreferences,
  ): DatingProfile {
    const inPool = this.profiles.find((p) => p.id === userId);
    if (inPool) return inPool;

    const base = getCurrentUser();
    return {
      ...base,
      id: userId,
      lifestyle: { ...base.lifestyle, ...preferences.lifestyle },
    };
  }

  /**
   * The full recommendation pipeline. Returns the spec envelope.
   */
  private computeRecommendations(
    userId: string,
    preferences: UserPreferences,
    n: number,
  ): RecommendationResult {
    const user = this.resolveUser(userId, preferences);
    // Store for explainScore.
    this.activeUser = user;

    // ----- 1. Filter the candidate pool -----------------------------------
    const swipedIds = new Set(
      this.swipeHistory.filter((s) => s.userId === userId).map((s) => s.profileId),
    );
    const userSwipes = this.swipeHistory.filter((s) => s.userId === userId);
    const isColdStart = userSwipes.length < this.config.coldStartThreshold;

    const mustMatchInterests = preferences.interests;

    const candidates = this.profiles.filter((p) => {
      if (p.id === user.id) return false; // never recommend self
      if (swipedIds.has(p.id)) return false; // never re-surface swiped
      if (
        preferences.genderPreference !== 'both' &&
        p.gender !== preferences.genderPreference
      ) {
        return false;
      }
      if (
        p.age < preferences.ageMin - AGE_PRE_FILTER_BUFFER ||
        p.age > preferences.ageMax + AGE_PRE_FILTER_BUFFER
      ) {
        return false; // hard outside the Gaussian tail
      }
      const km = haversineKm(user.lat, user.lng, p.lat, p.lng);
      if (km > preferences.maxDistanceKm * DISTANCE_PRE_FILTER_FACTOR) {
        return false;
      }
      // Must-match interests: when the user specifies interests, the
      // candidate must share at least one of them.
      if (mustMatchInterests.length > 0) {
        const shares = p.interests.some((i) => mustMatchInterests.includes(i));
        if (!shares) return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      return { recommendations: [], totalPool: 0 };
    }

    // ----- 2. Score every surviving candidate -----------------------------
    // Normalise blend weights so they always sum to 1.
    const wSum =
      this.config.w_content +
      this.config.w_collab +
      this.config.w_elo +
      this.config.w_novelty;
    const wContent = this.config.w_content / wSum;
    const wCollab = this.config.w_collab / wSum;
    const wElo = this.config.w_elo / wSum;
    const wNovelty = this.config.w_novelty / wSum;

    // Seeded RNG for this call — deterministic per (seed, userId, state).
    const rng = mulberry32(this.config.seed + hashString(userId));

    const scored: MatchResult[] = candidates.map((p) => {
      const interest = interestJaccard(user, p);
      const age = ageCompatibility(user, p, preferences);
      const geo = geospatialDistance(user, p, preferences);
      const lifestyle = lifestyleCompatibility(user, p, preferences);
      const education = educationCompatibility(user, p);

      const content =
        interest * CONTENT_WEIGHTS.interest +
        age * CONTENT_WEIGHTS.age +
        geo * CONTENT_WEIGHTS.geo +
        lifestyle * CONTENT_WEIGHTS.lifestyle +
        education * CONTENT_WEIGHTS.education;

      const collab = collaborativeScore(
        userId,
        p.id,
        this.swipeHistory,
        this.profiles,
      );
      const elo = eloFactor(p);

      // Novelty: Thompson in cold start (Bayesian exploration), UCB in warm.
      const novelty = isColdStart
        ? thompsonSample(p, this.swipeHistory, rng)
        : ucbScore(p, this.swipeHistory, this.config.explorationFactor);

      const composite =
        wContent * content +
        wCollab * collab +
        wElo * elo +
        wNovelty * novelty;

      const distanceKm = haversineKm(user.lat, user.lng, p.lat, p.lng);

      const scores: Record<string, number> = {
        interest,
        age,
        geo,
        lifestyle,
        education,
        content,
        collab,
        elo,
        novelty,
        distanceKm,
        composite,
      };

      return { profile: p, score: composite, scores, reason: '' };
    });

    // ----- 3. Rank -------------------------------------------------------
    scored.sort((a, b) => b.score - a.score);

    // ----- 4. Cold-start exploration re-ordering --------------------------
    let ranked: MatchResult[];
    if (isColdStart) {
      ranked = this.coldStartOrder(scored, rng);
    } else {
      ranked = scored;
    }

    // ----- 5. Diversity filter (greedy, no two consecutive too similar) ---
    const diverse = this.applyDiversityFilter(
      ranked,
      this.config.diversityThreshold,
    );

    // ----- 6. Trim + annotate --------------------------------------------
    const top = diverse.slice(0, Math.max(0, n));
    const recommendations = top.map((m) => ({
      ...m,
      reason: this.explainScore(m.profile, m.scores),
    }));

    return { recommendations, totalPool: candidates.length };
  }

  /**
   * ε-greedy interleaving for cold start (delegates to {@link epsilonGreedy}).
   *
   * Walks a copy of the composite-sorted pool; on each step it asks the
   * bandit to pick an index — with probability ε a random remaining slot
   * (explore), otherwise the current best (exploit, index 0 since the pool
   * is sorted desc). The result is a single ordered list mixing sure-fire
   * hits with fresh faces — exactly what a cold-start user needs.
   */
  private coldStartOrder(
    scored: MatchResult[],
    rng: () => number,
  ): MatchResult[] {
    const pool = scored.slice(); // already sorted desc by composite
    const ordered: MatchResult[] = [];
    while (pool.length > 0) {
      const values = pool.map((m) => m.score);
      const idx = epsilonGreedy(values, this.config.epsilon, rng);
      if (idx < 0) break;
      const picked = pool.splice(idx, 1)[0];
      if (picked) ordered.push(picked);
    }
    return ordered;
  }

  /**
   * Greedy diversity filter.
   *
   * Builds the output list one pick at a time, always preferring a
   * candidate whose interest Jaccard with the previous pick is ≤
   * `threshold`. When every remaining candidate is too similar it falls
   * back to the least-similar one to keep some variety.
   */
  private applyDiversityFilter(
    ranked: MatchResult[],
    threshold: number,
  ): MatchResult[] {
    if (ranked.length <= 1) return ranked.slice();

    const pool = ranked.slice();
    const result: MatchResult[] = [];
    const first = pool.shift();
    if (first) result.push(first);

    while (pool.length > 0) {
      const prev = result[result.length - 1] as MatchResult;

      let idx = pool.findIndex(
        (m) => interestJaccard(prev.profile, m.profile) <= threshold,
      );

      if (idx === -1) {
        // All too similar — pick the least similar to preserve variety.
        let bestIdx = 0;
        let bestSim = interestJaccard(
          prev.profile,
          (pool[0] as MatchResult).profile,
        );
        for (let i = 1; i < pool.length; i++) {
          const sim = interestJaccard(prev.profile, (pool[i] as MatchResult).profile);
          if (sim < bestSim) {
            bestSim = sim;
            bestIdx = i;
          }
        }
        idx = bestIdx;
      }

      const picked = pool.splice(idx, 1)[0];
      if (picked) result.push(picked);
    }

    return result;
  }
}
