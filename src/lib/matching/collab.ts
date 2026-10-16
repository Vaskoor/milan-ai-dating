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
 * User-based collaborative filtering for the Milan matching engine.
 *
 * The algorithm finds neighbours whose *accepted-profile sets* overlap with
 * the current user's (Jaccard similarity of accepted sets) and recommends
 * candidates those neighbours accepted, weighted by similarity.
 *
 * `collaborativeScore` is **pure** and deterministic — the same inputs
 * always yield the same score. With too little signal (fewer than three
 * overlapping neighbours, or an unknown candidate) it returns the neutral
 * 0.5 so the hybrid engine can lean on the other components.
 */

import type { DatingProfile, SwipeRecord } from './types';

/** Minimum number of similar neighbours required to trust the CF signal. */
const MIN_NEIGHBOURS = 3;

/** Neutral score returned when there is not enough signal to decide. */
export const NEUTRAL_SCORE = 0.5;

/* ------------------------------------------------------------------ */
/* Set helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * Jaccard similarity of two string sets: `|A ∩ B| / |A ∪ B|`.
 * Returns 0 if both sets are empty.
 */
function jaccardSet(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Build a `userId → Set<profileId>` map of accepted profiles from the raw
 * swipe stream. Rejects are ignored (CF here models positive co-endorsement).
 */
function buildAcceptedMap(
  swipeHistory: SwipeRecord[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const s of swipeHistory) {
    if (s.action !== 'accept') continue;
    let set = map.get(s.userId);
    if (!set) {
      set = new Set<string>();
      map.set(s.userId, set);
    }
    set.add(s.profileId);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Collaborative score                                                 */
/* ------------------------------------------------------------------ */

/**
 * Compute a user-based collaborative-filtering score for a candidate.
 *
 * The score is a similarity-weighted share of the user's neighbours that
 * accepted the candidate:
 *
 * ```
 * score = Σ_{v ∈ N(u), v accepted c} sim(u, v) / Σ_{v ∈ N(u)} sim(u, v)
 * ```
 *
 * where `sim(u, v)` is the Jaccard similarity of the two users' accepted
 * sets. If the user has no accepts, fewer than `MIN_NEIGHBOURS` neighbours
 * overlap, or the candidate is unknown, the function returns the neutral
 * {@link NEUTRAL_SCORE} (0.5) so the hybrid engine down-weights CF.
 *
 * @param userId - the current user id.
 * @param candidateId - the candidate profile id being scored.
 * @param swipeHistory - the full swipe log (any user, any profile).
 * @param allProfiles - the recommendation pool (used to validate the
 *   candidate + ignore stale swipes on profiles no longer in the pool).
 * @returns a score in [0, 1]; 0.5 when insufficient signal.
 */
export function collaborativeScore(
  userId: string,
  candidateId: string,
  swipeHistory: SwipeRecord[],
  allProfiles: DatingProfile[],
): number {
  // Validate the candidate belongs to the active pool.
  const exists = allProfiles.some((p) => p.id === candidateId);
  if (!exists) return NEUTRAL_SCORE;

  const acceptedBy = buildAcceptedMap(swipeHistory);
  const userAccept = acceptedBy.get(userId);
  if (!userAccept || userAccept.size === 0) return NEUTRAL_SCORE;

  let totalSimilarity = 0;
  let candidateSimilarity = 0;
  let neighbourCount = 0;

  for (const [otherId, otherAccept] of acceptedBy) {
    if (otherId === userId) continue;
    if (otherAccept.size === 0) continue;

    const sim = jaccardSet(userAccept, otherAccept);
    if (sim <= 0) continue;

    neighbourCount++;
    totalSimilarity += sim;
    if (otherAccept.has(candidateId)) candidateSimilarity += sim;
  }

  if (neighbourCount < MIN_NEIGHBOURS) return NEUTRAL_SCORE;
  if (totalSimilarity <= 0) return NEUTRAL_SCORE;

  return candidateSimilarity / totalSimilarity;
}
