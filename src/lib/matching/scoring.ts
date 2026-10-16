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
 * Content-based scoring primitives for the Milan matching engine.
 *
 * Every function here is **pure** (no I/O, no randomness) and returns a
 * normalised score in the closed interval [0, 1] where 1 means "ideal"
 * and 0 means "incompatible". The hybrid engine blends these sub-scores
 * into a single `content` component and a final composite.
 *
 * No external math library is used — `haversineKm` is implemented from
 * first principles and reused by the geospatial score.
 */

import type { DatingProfile, Lifestyle, UserPreferences } from './types';

/* ------------------------------------------------------------------ */
/* Small numeric helpers                                               */
/* ------------------------------------------------------------------ */

/** Clamp a number to a closed range. */
function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Convert degrees to radians. */
function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/* ------------------------------------------------------------------ */
/* Geospatial                                                          */
/* ------------------------------------------------------------------ */

/**
 * Great-circle distance between two lat/lng points in kilometres using the
 * Haversine formula. The Earth is modelled as a sphere of radius 6371 km.
 *
 * Reference: https://en.wikipedia.org/wiki/Haversine_formula
 *
 * @param lat1 - latitude of point A (degrees).
 * @param lng1 - longitude of point A (degrees).
 * @param lat2 - latitude of point B (degrees).
 * @param lng2 - longitude of point B (degrees).
 * @returns distance in kilometres (always ≥ 0).
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius (km)
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const lat1r = toRadians(lat1);
  const lat2r = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1r) * Math.cos(lat2r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Geospatial compatibility score via exponential distance decay.
 *
 * `score = exp(-d / maxDistanceKm)` — perfect (1) when the candidate is in
 * the same place, ~37 % at the distance limit, and rapidly tapers beyond.
 *
 * @param user - the resolving user (provides origin lat/lng).
 * @param candidate - the candidate profile.
 * @param prefs - user preferences (provides `maxDistanceKm`).
 * @returns a score in [0, 1].
 */
export function geospatialDistance(
  user: DatingProfile,
  candidate: DatingProfile,
  prefs: UserPreferences,
): number {
  const maxD = prefs.maxDistanceKm > 0 ? prefs.maxDistanceKm : 1;
  const km = haversineKm(user.lat, user.lng, candidate.lat, candidate.lng);
  return Math.exp(-km / maxD);
}

/* ------------------------------------------------------------------ */
/* Interests — Jaccard similarity                                       */
/* ------------------------------------------------------------------ */

/**
 * Jaccard similarity between the interest sets of two profiles:
 * `|A ∩ B| / |A ∪ B|`. Returns 1 if both share identical interests, 0 if
 * disjoint (or both empty).
 *
 * @param user - the resolving user.
 * @param candidate - the candidate.
 * @returns a score in [0, 1].
 */
export function interestJaccard(
  user: DatingProfile,
  candidate: DatingProfile,
): number {
  const a = new Set(user.interests);
  const b = new Set(candidate.interests);
  if (a.size === 0 && b.size === 0) return 1;

  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/* ------------------------------------------------------------------ */
/* Age compatibility — Gaussian tail                                   */
/* ------------------------------------------------------------------ */

/**
 * Age compatibility with a flat-top Gaussian.
 *
 * Returns 1.0 for any candidate age inside `[ageMin, ageMax]`. Outside the
 * range the score decays as `exp(-d² / (2σ²))` with σ = 3, where `d` is the
 * distance to the nearest range bound. So being 3 years outside the range
 * already drops the score to ~0.61, 6 years to ~0.14.
 *
 * @param _user - reserved for symmetry (unused; age band comes from prefs).
 * @param candidate - the candidate whose age is scored.
 * @param prefs - user preferences providing the age band.
 * @returns a score in [0, 1].
 */
export function ageCompatibility(
  _user: DatingProfile,
  candidate: DatingProfile,
  prefs: UserPreferences,
): number {
  const age = candidate.age;
  const min = prefs.ageMin;
  const max = prefs.ageMax;
  if (age >= min && age <= max) return 1;

  const sigma = 3;
  const d = age < min ? min - age : age - max;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

/* ------------------------------------------------------------------ */
/* Lifestyle compatibility — weighted agreement                         */
/* ------------------------------------------------------------------ */

/** Per-factor weights (drinking, smoking, diet, relationshipType). */
const LIFESTYLE_WEIGHTS: Readonly<Record<
  keyof Pick<Lifestyle, 'drinking' | 'smoking' | 'diet' | 'relationshipType'>,
  number
>> = {
  drinking: 0.25,
  smoking: 0.25,
  diet: 0.2,
  relationshipType: 0.3,
};

/**
 * Weighted lifestyle agreement.
 *
 * For each factor the user expressed a preference for, the candidate earns
 * that factor's weight if it matches, 0 otherwise. The total is normalised
 * by the sum of expressed weights, so unspecified factors neither help nor
 * hurt. If the user expresses no lifestyle preference at all, returns 1
 * (fully permissive).
 *
 * @param _user - reserved (the preferences drive the comparison).
 * @param candidate - the candidate profile.
 * @param prefs - user preferences with a (possibly partial) lifestyle.
 * @returns a score in [0, 1].
 */
export function lifestyleCompatibility(
  _user: DatingProfile,
  candidate: DatingProfile,
  prefs: UserPreferences,
): number {
  const prefLifestyle = prefs.lifestyle ?? {};
  let totalWeight = 0;
  let matchWeight = 0;

  (Object.keys(LIFESTYLE_WEIGHTS) as Array<keyof typeof LIFESTYLE_WEIGHTS>).forEach(
    (key) => {
      const weight = LIFESTYLE_WEIGHTS[key];
      const wanted = prefLifestyle[key];
      if (wanted === undefined) return; // no preference → skip
      totalWeight += weight;
      if (candidate.lifestyle[key] === wanted) matchWeight += weight;
    },
  );

  if (totalWeight === 0) return 1; // fully permissive
  return matchWeight / totalWeight;
}

/* ------------------------------------------------------------------ */
/* Education compatibility — ordinal proximity                         */
/* ------------------------------------------------------------------ */

/**
 * Map a free-text education string to an ordinal level
 * (High School / +2 = 1, Bachelor = 2, Master / MBA = 3, PhD / MBBS = 4).
 */
function educationLevel(edu: string): number {
  const e = edu.toLowerCase();
  if (e.includes('phd')) return 4;
  if (e.includes('mbbs')) return 4;
  if (e.includes('master') || e.includes('mba')) return 3;
  if (e.includes('bachelor')) return 2;
  if (e.includes('+2') || e.includes('higher secondary')) return 1;
  if (e.includes('high school') || e.includes('school')) return 1;
  return 2; // unknown → assume bachelor-level
}

/**
 * Education-level proximity. Maps each profile's education to an ordinal
 * (1–4) and returns `1 - |Δ| / 3`, so identical levels score 1 and a
 * PhD vs High School gap scores 0.
 *
 * @param user - the resolving user.
 * @param candidate - the candidate.
 * @returns a score in [0, 1].
 */
export function educationCompatibility(
  user: DatingProfile,
  candidate: DatingProfile,
): number {
  const u = educationLevel(user.education);
  const c = educationLevel(candidate.education);
  const maxDiff = 3; // PhD(4) − High School(1)
  return 1 - Math.abs(u - c) / maxDiff;
}

/* ------------------------------------------------------------------ */
/* Elo desirability                                                     */
/* ------------------------------------------------------------------ */

/** Lower bound used to normalise Elo into [0, 1]. */
const ELO_MIN = 800;
/** Upper bound used to normalise Elo into [0, 1]. */
const ELO_MAX = 2800;

/**
 * Normalise a candidate's Elo desirability score into [0, 1] via a linear
 * map from `[ELO_MIN, ELO_MAX]`. Higher Elo ⇒ more desirable ⇒ higher
 * factor. Values outside the band are clamped.
 *
 * @param candidate - the candidate whose Elo is normalised.
 * @returns a score in [0, 1].
 */
export function eloFactor(candidate: DatingProfile): number {
  return clamp((candidate.elo - ELO_MIN) / (ELO_MAX - ELO_MIN), 0, 1);
}
