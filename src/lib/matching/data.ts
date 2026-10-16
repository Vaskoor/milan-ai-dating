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
 * Deterministic mock data + seeded PRNG utilities for the Milan engine.
 *
 * `generateProfiles` produces 50 realistic Nepali dating profiles from a
 * fixed seed so that the recommendation engine, the API routes and any test
 * harness always see the same pool. `generateSwipeHistory` synthesises a
 * warm-start swipe graph for collaborative filtering.
 *
 * The PRNG (`mulberry32`) and string hash (`hashString`) are exported so the
 * bandit (`bandit.ts`) and engine (`engine.ts`) can derive deterministic
 * streams without pulling in an external math library.
 */

import type {
  DatingProfile,
  Lifestyle,
  SwipeRecord,
  UserPreferences,
} from './types';

/* ------------------------------------------------------------------ */
/* Seeded PRNG                                                         */
/* ------------------------------------------------------------------ */

/**
 * Mulberry32 — a tiny, fast, fully deterministic 32-bit PRNG.
 *
 * Given the same seed it always yields the same sequence, which is what
 * makes the engine reproducible. Returns floats in [0, 1).
 *
 * @param seed - 32-bit unsigned integer seed.
 * @returns a function producing deterministic floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function rng(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a 32-bit string hash. Used to derive deterministic seeds from ids,
 * so `thompsonSample` / `epsilonGreedy` stay reproducible per candidate.
 *
 * @param str - any string.
 * @returns a 32-bit unsigned integer.
 */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ */
/* Pick / shuffle helpers (deterministic, pure)                        */
/* ------------------------------------------------------------------ */

/** Pick one element from a non-empty readonly array using `rng`. */
function pick<T>(arr: ReadonlyArray<T>, rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

/** Fisher–Yates shuffle driven by `rng` (returns a new array). */
function shuffle<T>(arr: ReadonlyArray<T>, rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/** Pick a random subset of length in [min, max] (capped at arr.length). */
function pickSubset<T>(
  arr: ReadonlyArray<T>,
  min: number,
  max: number,
  rng: () => number,
): T[] {
  const span = max - min + 1;
  const n = Math.min(arr.length, min + Math.floor(rng() * span));
  return shuffle(arr, rng).slice(0, n);
}

/* ------------------------------------------------------------------ */
/* Reference data (Nepali names, cities, interests, …)                 */
/* ------------------------------------------------------------------ */

/** 50 names interleaved male / female for an even pool. */
const NAMED_PROFILES: ReadonlyArray<{ name: string; gender: 'male' | 'female' }> = [
  { name: 'Aarav', gender: 'male' },
  { name: 'Aadya', gender: 'female' },
  { name: 'Bibek', gender: 'male' },
  { name: 'Chandani', gender: 'female' },
  { name: 'Bishnu', gender: 'male' },
  { name: 'Diya', gender: 'female' },
  { name: 'Gaurav', gender: 'male' },
  { name: 'Gita', gender: 'female' },
  { name: 'Hari', gender: 'male' },
  { name: 'Ishwari', gender: 'female' },
  { name: 'Kiran', gender: 'male' },
  { name: 'Laxmi', gender: 'female' },
  { name: 'Nabin', gender: 'male' },
  { name: 'Maya', gender: 'female' },
  { name: 'Niraj', gender: 'male' },
  { name: 'Pooja', gender: 'female' },
  { name: 'Prakash', gender: 'male' },
  { name: 'Sita', gender: 'female' },
  { name: 'Raj', gender: 'male' },
  { name: 'Anjali', gender: 'female' },
  { name: 'Suraj', gender: 'male' },
  { name: 'Jyoti', gender: 'female' },
  { name: 'Bikash', gender: 'male' },
  { name: 'Nisha', gender: 'female' },
  { name: 'Dipak', gender: 'male' },
  { name: 'Priya', gender: 'female' },
  { name: 'Ganesh', gender: 'male' },
  { name: 'Sandhya', gender: 'female' },
  { name: 'Himal', gender: 'male' },
  { name: 'Tara', gender: 'female' },
  { name: 'Kamal', gender: 'male' },
  { name: 'Varsha', gender: 'female' },
  { name: 'Manish', gender: 'male' },
  { name: 'Yamuna', gender: 'female' },
  { name: 'Om', gender: 'male' },
  { name: 'Bhawana', gender: 'female' },
  { name: 'Ramesh', gender: 'male' },
  { name: 'Elina', gender: 'female' },
  { name: 'Umesh', gender: 'male' },
  { name: 'Falguni', gender: 'female' },
  { name: 'Arjun', gender: 'male' },
  { name: 'Indira', gender: 'female' },
  { name: 'Chetan', gender: 'male' },
  { name: 'Kriti', gender: 'female' },
  { name: 'Gopal', gender: 'male' },
  { name: 'Saraswati', gender: 'female' },
  { name: 'Hemant', gender: 'male' },
  { name: 'Menuka', gender: 'female' },
  { name: 'Jivan', gender: 'male' },
  { name: 'Rabina', gender: 'female' },
];

/** Real Nepali cities with their true coordinates. */
const CITIES: ReadonlyArray<{ name: string; lat: number; lng: number }> = [
  { name: 'Kathmandu', lat: 27.7172, lng: 85.324 },
  { name: 'Pokhara', lat: 28.2096, lng: 83.9494 },
  { name: 'Lalitpur', lat: 27.6766, lng: 85.2965 },
  { name: 'Bhaktapur', lat: 27.671, lng: 85.4298 },
  { name: 'Chitwan', lat: 27.529, lng: 84.3542 },
  { name: 'Dharan', lat: 26.8065, lng: 87.2846 },
  { name: 'Butwal', lat: 27.7006, lng: 83.4396 },
];

/** The 15 canonical interest tags used across the app. */
const INTERESTS: ReadonlyArray<string> = [
  'trekking',
  'photography',
  'music',
  'cooking',
  'reading',
  'football',
  'dance',
  'yoga',
  'travel',
  'art',
  'gaming',
  'movies',
  'fitness',
  'foodie',
  'pets',
];

/** Education strings (mapped to ordinal levels in `scoring.ts`). */
const EDUCATIONS: ReadonlyArray<string> = [
  'High School',
  '+2 (Higher Secondary)',
  "Bachelor's in Engineering",
  "Bachelor's in Management",
  "Bachelor's in Arts",
  'MBBS',
  'MBA',
  "Master's in Computer Science",
  "Master's in Sociology",
  'PhD in Education',
];

/** Occupations. */
const OCCUPATIONS: ReadonlyArray<string> = [
  'Software Engineer',
  'Doctor',
  'Teacher',
  'Accountant',
  'Civil Servant',
  'Entrepreneur',
  'Graphic Designer',
  'Nurse',
  'Banker',
  'Photographer',
  'Journalist',
  'Architect',
  'Farmer',
  'Lawyer',
  'Marketing Manager',
];

/** Short bios, picked deterministically. */
const BIOS: ReadonlyArray<string> = [
  'Mountain lover and chai enthusiast.',
  'Looking for someone to trek Annapurna with.',
  "Foodie exploring Kathmandu's momo scene.",
  'Photographer chasing golden hour.',
  'Bookworm and weekend hiker.',
  'Music is life — let us go to concerts.',
  'Yoga at sunrise, movies at midnight.',
  'Seeking a serious, kind-hearted partner.',
  'Dogs > everything. Swipe right if you agree.',
  'Engineer by day, guitarist by night.',
  'Travel bucket list: 75 districts of Nepal.',
  'Let us talk about books, art and mountains.',
];

const DRINKING: ReadonlyArray<Lifestyle['drinking']> = ['never', 'sometimes', 'often'];
const SMOKING: ReadonlyArray<Lifestyle['smoking']> = ['never', 'sometimes', 'often'];
const DIET: ReadonlyArray<Lifestyle['diet']> = ['veg', 'non-veg', 'eggetarian'];
const KIDS: ReadonlyArray<Lifestyle['kids']> = ['none', 'want', 'have'];
const RELATIONSHIP: ReadonlyArray<Lifestyle['relationshipType']> = [
  'casual',
  'serious',
  'marriage',
];

/** Number of synthetic profiles in the pool. */
const POOL_SIZE = 50;

/* ------------------------------------------------------------------ */
/* Profile generation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generate `POOL_SIZE` deterministic Nepali dating profiles.
 *
 * Same seed → identical profiles, in identical order. Names + genders come
 * from a fixed list; every other field (age, city, interests, education,
 * occupation, height, lifestyle, elo, verification, bio, photos) is drawn
 * from the seeded PRNG so the pool is reproducible for tests + replays.
 *
 * @param seed - PRNG seed (default 42).
 * @returns 50 {@link DatingProfile} objects.
 */
export function generateProfiles(seed: number = 42): DatingProfile[] {
  const rng = mulberry32(seed);
  const profiles: DatingProfile[] = [];

  for (let i = 0; i < POOL_SIZE; i++) {
    const named = NAMED_PROFILES[i] as { name: string; gender: 'male' | 'female' };
    const id = `p${(i + 1).toString().padStart(3, '0')}`;
    const city = pick(CITIES, rng);
    const interests = pickSubset(INTERESTS, 3, 6, rng);
    const education = pick(EDUCATIONS, rng);
    const occupation = pick(OCCUPATIONS, rng);
    const bio = pick(BIOS, rng);
    const age = 20 + Math.floor(rng() * 18); // 20..37
    const height = 150 + Math.floor(rng() * 45); // 150..194 cm
    const photoCount = 3 + Math.floor(rng() * 3); // 3..5 photos
    const photos = Array.from(
      { length: photoCount },
      (_, k) => `https://picsum.photos/seed/${id}-${k}/600/800`,
    );
    const lifestyle: Lifestyle = {
      drinking: pick(DRINKING, rng),
      smoking: pick(SMOKING, rng),
      diet: pick(DIET, rng),
      kids: pick(KIDS, rng),
      relationshipType: pick(RELATIONSHIP, rng),
    };
    // Elo: 1000..1800, centred near the 1200 starting point.
    const elo = 1200 + Math.floor(rng() * 601) - 100;
    const verified = rng() > 0.35;

    profiles.push({
      id,
      name: named.name,
      age,
      gender: named.gender,
      city: city.name,
      lat: city.lat,
      lng: city.lng,
      bio,
      photo: photos[0] as string,
      photos,
      interests,
      education,
      occupation,
      height,
      lifestyle,
      elo,
      verified,
    });
  }

  return profiles;
}

/* ------------------------------------------------------------------ */
/* Current user + default preferences                                  */
/* ------------------------------------------------------------------ */

/**
 * The canonical "current user" profile — a 27 year-old Kathmandu software
 * engineer. Used as the resolved user when `userId` is not present in the
 * recommendation pool and as a sensible demo identity.
 *
 * @returns a fixed {@link DatingProfile} for the current user.
 */
export function getCurrentUser(): DatingProfile {
  return {
    id: 'me',
    name: 'Rajan',
    age: 27,
    gender: 'male',
    city: 'Kathmandu',
    lat: 27.7172,
    lng: 85.324,
    bio: 'Trekker, foodie and software builder. Looking for a serious relationship.',
    photo: 'https://picsum.photos/seed/me/600/800',
    photos: [
      'https://picsum.photos/seed/me-0/600/800',
      'https://picsum.photos/seed/me-1/600/800',
      'https://picsum.photos/seed/me-2/600/800',
    ],
    interests: ['trekking', 'photography', 'foodie', 'travel', 'fitness'],
    education: "Bachelor's in Engineering",
    occupation: 'Software Engineer',
    height: 178,
    lifestyle: {
      drinking: 'sometimes',
      smoking: 'never',
      diet: 'non-veg',
      kids: 'want',
      relationshipType: 'serious',
    },
    elo: 1200,
    verified: true,
  };
}

/**
 * Default matching preferences (used for new users + the 2-arg `recommend`
 * overload). Targets women aged 23–32 within 50 km of Kathmandu who do not
 * smoke, are open to a serious relationship, and share trekking / foodie /
 * travel interests.
 *
 * @returns a fresh {@link UserPreferences} object.
 */
export function getDefaultPreferences(): UserPreferences {
  return {
    ageMin: 23,
    ageMax: 32,
    genderPreference: 'female',
    maxDistanceKm: 50,
    interests: ['trekking', 'foodie', 'travel'],
    lifestyle: {
      smoking: 'never',
      diet: 'non-veg',
      relationshipType: 'serious',
    },
  };
}

/* ------------------------------------------------------------------ */
/* Swipe history (warm start for collaborative filtering)              */
/* ------------------------------------------------------------------ */

/** Fixed epoch base so generated timestamps are reproducible. */
const SWIPE_BASE_TS = 1_700_000_000_000;

/** Synthetic neighbour user ids that have swiped on the pool. */
const NEIGHBOUR_USERS: ReadonlyArray<string> = [
  'u01',
  'u02',
  'u03',
  'u04',
  'u05',
  'u06',
  'u07',
  'u08',
  'u09',
  'u10',
];

/**
 * Generate a deterministic mock swipe history for collaborative-filtering
 * warm-start.
 *
 * Ten synthetic neighbour users each swipe 8–20 profiles (accept
 * probability biased toward higher-Elo profiles). The current user (`me`)
 * contributes a handful of swipes — below the cold-start threshold so the
 * engine exercises the cold-start path by default, but enough to seed CF.
 *
 * @param seed - PRNG seed (default 42). The profile pool is derived from the
 *   same `seed` so accept probabilities reflect the real pool's Elo.
 * @returns a flat list of {@link SwipeRecord}s.
 */
export function generateSwipeHistory(seed: number = 42): SwipeRecord[] {
  const rng = mulberry32(seed);
  const profiles = generateProfiles(seed);
  const swipes: SwipeRecord[] = [];
  let ts = SWIPE_BASE_TS;

  for (const uid of NEIGHBOUR_USERS) {
    const count = 8 + Math.floor(rng() * 13); // 8..20
    const pool = shuffle(profiles, rng).slice(0, count);
    for (const p of pool) {
      // Accept probability biased by Elo: more desirable → more accepts.
      const acceptProb = 0.3 + (p.elo - 1200) / 1200;
      const action: 'accept' | 'reject' = rng() < acceptProb ? 'accept' : 'reject';
      ts += 3_600_000 * (1 + Math.floor(rng() * 23));
      swipes.push({ userId: uid, profileId: p.id, action, timestamp: ts });
    }
  }

  // A few swipes from the current user — enough to seed CF, below cold-start.
  const meCount = 4;
  const mePool = shuffle(profiles, rng).slice(0, meCount);
  for (const p of mePool) {
    const acceptProb = 0.3 + (p.elo - 1200) / 1200;
    const action: 'accept' | 'reject' = rng() < acceptProb ? 'accept' : 'reject';
    ts += 3_600_000;
    swipes.push({ userId: 'me', profileId: p.id, action, timestamp: ts });
  }

  return swipes;
}
