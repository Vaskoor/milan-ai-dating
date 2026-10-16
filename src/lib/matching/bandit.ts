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
 * Multi-armed-bandit exploration primitives.
 *
 * Three classic exploration strategies are provided:
 *
 *   * {@link ucbScore} — Upper Confidence Bound. Deterministic.
 *   * {@link thompsonSample} — Thompson sampling from a Beta(α+1, β+1)
 *     posterior. Uses a seeded RNG so it is reproducible.
 *   * {@link epsilonGreedy} — ε-greedy action selection. Seeded.
 *
 * All randomness flows through the deterministic `mulberry32` PRNG, so for a
 * given engine state the recommendations are fully reproducible. None of
 * the sampling routines touch `Math.random`.
 */

import type { DatingProfile, SwipeRecord } from './types';
import { hashString, mulberry32 } from './data';

/* ------------------------------------------------------------------ */
/* Numeric helpers                                                     */
/* ------------------------------------------------------------------ */

/** Clamp to [0, 1]. */
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Neutral reward returned when the swipe log is completely empty. */
const NEUTRAL_REWARD = 0.5;

/* ------------------------------------------------------------------ */
/* Distribution samplers (from scratch, seeded)                       */
/* ------------------------------------------------------------------ */

/**
 * Standard-normal sample via the Box–Muller transform.
 *
 * @param rng - a deterministic [0, 1) generator.
 * @returns a single N(0, 1) sample.
 */
function sampleNormal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Gamma-distributed sample via the Marsaglia–Tsang rejection method.
 *
 * For `shape < 1` the boosting trick `G(k) = G(k+1) * U^(1/k)` is used so
 * the main algorithm (which requires shape ≥ 1) always receives valid input.
 * A 1000-iteration cap guards against pathological RNG states.
 *
 * @param shape - shape parameter k (must be > 0).
 * @param rng - a deterministic [0, 1) generator.
 * @returns a single Gamma(shape, 1) sample.
 */
function sampleGamma(shape: number, rng: () => number): number {
  if (shape < 1) {
    const u = rng();
    return sampleGamma(shape + 1, rng) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let iter = 0; iter < 1000; iter++) {
    let x = 0;
    let v = 0;
    do {
      x = sampleNormal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d; // fallback (practically unreachable)
}

/**
 * Beta-distributed sample via the gamma-ratio method: if
 * `X ~ Gamma(a)` and `Y ~ Gamma(b)` (independent) then
 * `X / (X + Y) ~ Beta(a, b)`.
 *
 * @param alpha - shape α (> 0).
 * @param beta - shape β (> 0).
 * @param rng - a deterministic [0, 1) generator.
 * @returns a single Beta(α, β) sample in (0, 1).
 */
function sampleBeta(alpha: number, beta: number, rng: () => number): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  const denom = x + y;
  if (denom <= 0) return 0.5;
  return x / denom;
}

/* ------------------------------------------------------------------ */
/* Per-candidate swipe tallies                                         */
/* ------------------------------------------------------------------ */

/**
 * Tally accepts / rejects / total for a candidate across the swipe log.
 * Used by both UCB and Thompson sampling.
 */
function tallyCandidate(
  candidate: DatingProfile,
  swipeHistory: SwipeRecord[],
): { accepts: number; rejects: number; total: number } {
  let accepts = 0;
  let rejects = 0;
  let total = 0;
  for (const s of swipeHistory) {
    total++;
    if (s.profileId !== candidate.id) continue;
    if (s.action === 'accept') accepts++;
    else rejects++;
  }
  return { accepts, rejects, total };
}

/* ------------------------------------------------------------------ */
/* Upper Confidence Bound                                              */
/* ------------------------------------------------------------------ */

/**
 * Upper Confidence Bound score for a candidate.
 *
 * `UCB = reward + c * sqrt(2 * ln(N) / n_i)`
 *
 * where `reward` is the candidate's empirical accept rate, `N` is the total
 * number of swipes in the log, `n_i` is the number on this candidate, and
 * `c` is `explorationFactor`. Unexplored candidates (`n_i = 0`) get the
 * maximal score 1 so they are surfaced first. The result is clamped to [0, 1]
 * so it can be blended with the other [0, 1] engine components.
 *
 * Pure and deterministic (no RNG).
 *
 * @param candidate - the candidate arm.
 * @param swipeHistory - the full swipe log.
 * @param explorationFactor - the exploration constant c (commonly √2).
 * @returns a score in [0, 1].
 */
export function ucbScore(
  candidate: DatingProfile,
  swipeHistory: SwipeRecord[],
  explorationFactor: number,
): number {
  const { accepts, rejects: _rejects, total } = tallyCandidate(
    candidate,
    swipeHistory,
  );
  const ni = accepts + _rejects; // swipes on this arm

  if (total === 0) return NEUTRAL_REWARD; // no data at all → neutral
  if (ni === 0) return 1; // never shown → maximal exploration bonus

  const reward = accepts / ni;
  const exploration = explorationFactor * Math.sqrt((2 * Math.log(total)) / ni);
  return clamp01(reward + exploration);
}

/* ------------------------------------------------------------------ */
/* Thompson sampling                                                   */
/* ------------------------------------------------------------------ */

/**
 * Thompson-sampling draw for a candidate.
 *
 * Maintains a `Beta(α = accepts + 1, β = rejects + 1)` posterior over the
 * candidate's accept probability and returns a single sampled value. The
 * `+1` priors keep unseen arms at a neutral 0.5 expectation while still
 * allowing exploration.
 *
 * The RNG defaults to a seed derived from `candidate.id + swipeCount`, so
 * the same engine state always yields the same sample (reproducible). The
 * engine may pass its own seeded RNG to keep draws inside one `recommend`
 * call independent but still deterministic.
 *
 * @param candidate - the candidate arm.
 * @param swipeHistory - the full swipe log.
 * @param rng - optional deterministic [0, 1) generator.
 * @returns a Beta sample in (0, 1).
 */
export function thompsonSample(
  candidate: DatingProfile,
  swipeHistory: SwipeRecord[],
  rng?: () => number,
): number {
  const { accepts, rejects } = tallyCandidate(candidate, swipeHistory);
  const alpha = accepts + 1;
  const beta = rejects + 1;
  const swipeCount = accepts + rejects;
  const r =
    rng ??
    mulberry32(hashString(`${candidate.id}:${swipeCount}`));
  return sampleBeta(alpha, beta, r);
}

/* ------------------------------------------------------------------ */
/* ε-greedy selection                                                   */
/* ------------------------------------------------------------------ */

/**
 * ε-greedy action selection over an array of estimated values.
 *
 * With probability `ε` returns a uniformly random index (exploration),
 * otherwise returns the index of the maximum value (exploitation). Ties on
 * the maximum are broken by the lowest index.
 *
 * The RNG defaults to a seed derived from the score vector contents, so the
 * decision is reproducible for a given input.
 *
 * @param scores - per-arm estimated values (any sign).
 * @param epsilon - exploration probability in [0, 1].
 * @param rng - optional deterministic [0, 1) generator.
 * @returns the chosen index, or -1 if `scores` is empty.
 */
export function epsilonGreedy(
  scores: number[],
  epsilon: number,
  rng?: () => number,
): number {
  if (scores.length === 0) return -1;

  const r =
    rng ??
    mulberry32(hashString(`eps:${scores.length}:${scores.join(',')}`));

  if (r() < epsilon) {
    return Math.floor(r() * scores.length);
  }

  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[best]) best = i;
  }
  return best;
}
