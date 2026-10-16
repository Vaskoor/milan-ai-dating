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
 * Barrel export for the Milan matching / recommendation engine.
 *
 * Single import surface for the Next.js API routes
 * (`@/lib/matching`) and any client/test consumer:
 *
 * ```ts
 * import {
 *   MatchingEngine, MOCK_PROFILES, MOCK_SWIPE_HISTORY,
 *   type DatingProfile, type UserPreferences,
 * } from '@/lib/matching';
 * ```
 *
 * The engine blends content-based scoring, user-based collaborative
 * filtering, Elo desirability and multi-armed-bandit exploration into a
 * single deterministic ranking — see {@link MatchingEngine} for details.
 */

// ---- Types -------------------------------------------------------------
export type {
  DatingProfile,
  Gender,
  GenderPreference,
  KidsPreference,
  Lifestyle,
  MatchResult,
  MatchingConfig,
  RecommendationResult,
  RelationshipType,
  SwipeRecord,
  UserPreferences,
} from './types';
export type {
  Diet,
  DrinkingSmoking,
} from './types';

// ---- Data layer --------------------------------------------------------
export {
  generateProfiles,
  generateSwipeHistory,
  getCurrentUser,
  getDefaultPreferences,
  hashString,
  mulberry32,
} from './data';

// ---- Scoring primitives ----------------------------------------------
export {
  ageCompatibility,
  educationCompatibility,
  eloFactor,
  geospatialDistance,
  haversineKm,
  interestJaccard,
  lifestyleCompatibility,
} from './scoring';

// ---- Collaborative filtering -----------------------------------------
export { collaborativeScore, NEUTRAL_SCORE } from './collab';

// ---- Multi-armed bandit ----------------------------------------------
export { epsilonGreedy, thompsonSample, ucbScore } from './bandit';

// ---- Hybrid engine ----------------------------------------------------
export { DEFAULT_CONFIG, MatchingEngine } from './engine';

/* -------------------------------------------------------------------- */
/* Deterministic mock fixtures (consumed by the API routes)             */
/* -------------------------------------------------------------------- */

import { generateProfiles, generateSwipeHistory } from './data';

/**
 * The deterministic mock profile pool (50 Nepali profiles, seed 42).
 * Shared by reference across every API route singleton.
 */
export const MOCK_PROFILES: ReturnType<typeof generateProfiles> =
  generateProfiles(42);

/**
 * The deterministic warm-start swipe graph (seed 42). Ten synthetic
 * neighbour users + a handful of `me` swipes seed collaborative filtering.
 */
export const MOCK_SWIPE_HISTORY: ReturnType<typeof generateSwipeHistory> =
  generateSwipeHistory(42);
