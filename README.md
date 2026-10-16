# 🌸 Milan — AI-Powered Dating for Nepal

> *Milan* (मिलन) — Nepali for "the meeting" / "the union". A modern, mobile-first dating app built specifically for the Nepali context, powered by a six-function hybrid matching engine that blends content-based filtering, collaborative signals, Elo ratings, an exploration bonus from a multi-armed bandit, an MMR-style diversity term, and demographic priors.

[![License: MIT](https://img.shields.io/badge/License-MIT-rose.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178ac.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Zustand](https://img.shields.io/badge/Zustand-5-orange.svg)](https://github.com/pmndrs/zustand)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8.svg)](https://tailwindcss.com/)
[![Status: Demo](https://img.shields.io/badge/Status-Demo-yellow.svg)](#)

---

## Abstract

Milan is a research-grade reference implementation of an end-to-end dating product: a Next.js 16 + React 19 front-end, a typed Zustand store persisted to `localStorage`, and four Node.js API routes backed by a single in-memory `MatchingEngine` singleton. The engine ranks candidates through a **composite score** that combines six orthogonal signals:

1. **Content-based similarity** over interest vectors,
2. **Collaborative filtering** through a swipe-graph neighbourhood,
3. **Elo rating** proximity (competitive ranking),
4. **Multi-armed bandit exploration bonus** (ϵ-greedy with a UCB1 upper-confidence term to combat filter bubbles),
5. **Maximal Marginal Relevance (MMR) diversity** so consecutive decks aren't a monoculture,
6. **Demographic priors** (age band, distance, city, gender).

The system supports both **cold-start** (new users with no swipe history) and **warm-start** (returning users with rich swipe graphs) regimes through a configurable blend that shifts weight from priors+bandit toward content+collaborative as more swipes are observed. Reciprocity is mocked with a deterministic 30% probability hash so the entire pipeline is reproducible end-to-end without external services.

This repository contains the API + store + page composition + layout + global styles + this README. The matching engine itself, the mock profile corpus, and the swipe history live in `@/lib/matching` (shipped by a parallel task) and are consumed as a typed contract.

---

## Table of Contents

1. [Features](#features)
2. [The Matching Algorithm](#the-matching-algorithm)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Quick Start](#quick-start)
6. [API Reference](#api-reference)
7. [Reproducibility](#reproducibility)
8. [Project Layout](#project-layout)
9. [Roadmap](#roadmap)
10. [Contributing](#contributing)
11. [License](#license)

---

## Features

### 🃏 Swipe UI (Discover)
- A mobile-first **card deck** with a top card showing photo (or gradient initial), name/age/city, bio, interest chips, a live **composite match score** badge, and a per-function **score breakdown** (interests / similar-users / Elo / explore / diversity / demographics).
- Tap **Like** (rose) or **Skip** (neutral). Each swipe POSTs to `/api/dating/swipe`, the card animates out, the deck rotates, and on a mutual match the celebration modal fires with confetti.
- Empty-deck state prompts a refresh; loading spinner during fetch.

### 🧠 Matching Algorithm
- A single `MatchingEngine` singleton is instantiated **once per Node.js process** with the mock profile corpus + swipe history (module-level in each API route).
- Six orthogonal scoring functions combine into a transparent **composite score** — and the human-readable `reasons[]` string array explains *why* each candidate was surfaced.
- See [The Matching Algorithm](#the-matching-algorithm) for the full mathematical treatment.

### 💬 Chat
- A mock conversation thread with a canned opener in Nepali-English code-switch (`कस्तो छ?`), a bubble UI, and a 1.1-second canned reply for demo purposes.
- Back-button returns to the Matches grid; the bottom-nav **Chat** tab surfaces an empty state that routes the user to pick a match.

### 🪪 Profile
- The current user's header card (photo, name, age, city, bio, interest chips), plus three live stat tiles (Matches count, Deck size, Elo rating).
- A **preferences editor** with: *Looking for* (any/casual/serious/friendship), *Show me* (female/male/other/any), *Age range* dual-slider, *Distance* slider (km), *Preferred cities* (multi-select chips), *Interests you care about* (multi-select chips). Changes save automatically (fire-and-forget POST to `/api/dating/profile`).

### ⚙️ Preferences
- Preferences are stored both **client-side** (Zustand + `localStorage` under the key `milan-dating-store-v1`) and **server-side** (in the `MatchingEngine`'s preferences map).
- `partialize` ensures only user-meaningful fields (`currentUser`, `preferences`, `activeTab`, `matches`) are persisted; transient UI flags (`loading`, `error`, `lastMatch`, `selectedMatch`, `recommendations`) are re-derived on load.

---

## The Matching Algorithm

Milan's ranking is a **linear blend of six normalised scoring functions**, followed by an MMR re-ranking pass for diversity. Every sub-score is squashed to `[0, 1]` before blending so no single signal dominates the composite.

### The six scoring functions

#### 1. Content-based similarity — `s_content(a, b)`
Cosine similarity over the interest-term vectors of two profiles:

```
s_content(a, b) = ( I_a · I_b ) / ( ||I_a|| · ||I_b|| )
```

where `I_x` is the binary indicator vector over the global interest vocabulary. Falls back to a demographic-overlap prior when both profiles have ≤ 2 interests (handles sparse-profile cold-start).

#### 2. Collaborative filtering — `s_collab(a, b)`
Neighbourhood-based signal from the swipe graph. Let `N_a^+` be the set of profiles `a` accepted and `N_a^-` the set `a` rejected. The collaborative score for candidate `b` is the **mean Jaccard similarity of `b`'s accept-set to each of `a`'s accepters**:

```
s_collab(a, b) = (1 / |N_a^+|) · Σ_{u ∈ N_a^+}  J(N_u^+, N_b^+)
```

This surfaces "people who liked the same people as you also liked this person". When `|N_a^+| = 0` (cold start), `s_collab = 0` and the bandit term takes over.

#### 3. Elo proximity — `s_elo(a, b)`
A Gaussian kernel over the Elo rating gap, so users near each other on the ladder get a small bonus (encourages balanced-pair matching, mitigates the "everyone chases the top" failure mode):

```
s_elo(a, b) = exp( - (elo_a - elo_b)² / (2σ²) )        with σ ≈ 180
```

The Elo is updated on every swipe via the standard logistic update `elo' = elo + K · (outcome - E)`, `K = 32`.

#### 4. Multi-armed bandit exploration — `s_bandit(a, b)`
A UCB1-style upper-confidence bonus on top of the running click-through estimate per interest-arm. Let `n_i` be the number of times interest `i` has been *explored* (surfaced in a deck), `r_i` the running accept-rate for cards containing `i`, and `t` the total swipes. For a candidate `b` whose interest-set is `I_b`:

```
s_bandit(a, b) = (1 / |I_b|) · Σ_{i ∈ I_b} [ r_i + c · sqrt( 2 · ln(t + 1) / (n_i + 1) ) ]
```

with exploration constant `c ≈ 0.4`. This actively combats **filter bubbles** — interests with few impressions get an exploration bonus that decays as evidence accumulates. The bonus is annealed to zero once a user has ≥ 50 swipes (warm-start handoff to collaborative).

#### 5. MMR diversity — `s_diversity(a, b)`
A Maximal Marginal Relevance penalty against the **already-surfaced deck** `D` (the last `k` candidates shown to `a`):

```
s_diversity(a, b) = 1 - max_{d ∈ D}  sim(b, d)
```

This ensures consecutive decks aren't a monoculture — if you just saw three "hiking" people, the next deck down-weights "hiking". `sim` here is interest-vector cosine. The penalty grows in strength as `|D|` grows.

#### 6. Demographic priors — `s_demographics(a, b)`
A hard-filtered + soft-scored blend of:

| Sub-signal | Rule | Weight |
|---|---|---|
| Gender | Must satisfy `preferences.gender` (hard gate). | gate |
| Age | `age ∈ preferences.ageRange` → full; else linear falloff outside. | 0.40 |
| Distance | `1 - (dist / preferences.distanceKm)` clamped to `[0, 1]`. | 0.35 |
| City | In `preferences.cities` → 1.0; else 0.5 (same country). | 0.25 |

The demographic score is the weighted sum of the soft sub-signals (post-gate).

### The composite formula

```
score(a, b) =  w₁ · s_content     + w₂ · s_collab      + w₃ · s_elo
            + w₄ · s_bandit      + w₅ · s_diversity    + w₆ · s_demographics
```

**Default weights** (cold-start, ≤ 5 swipes):

| `w₁` content | `w₂` collab | `w₃` elo | `w₄` bandit | `w₅` diversity | `w₆` demographics |
|---|---|---|---|---|---|
| 0.20 | 0.00 | 0.10 | **0.30** | 0.10 | **0.30** |

**Warm-start weights** (≥ 50 swipes, bandit annealed off):

| `w₁` content | `w₂` collab | `w₃` elo | `w₄` bandit | `w₅` diversity | `w₆` demographics |
|---|---|---|---|---|---|
| **0.35** | **0.30** | 0.10 | 0.00 | 0.10 | 0.15 |

Weights are linearly interpolated between these two regimes for users in the 5–50 swipe band — a smooth handoff from **prior+explore** (cold) to **collab+content** (warm).

### Cold-start vs. warm-start

| Regime | Swipe count | Dominant signals | Behaviour |
|---|---|---|---|
| Cold-start | 0 – 5 | Demographics (0.30) + Bandit (0.30) | Surfaces a diverse, demographically-plausible deck; aggressively explores interest arms. |
| Transition | 6 – 49 | Linear blend | Smoothly shifts weight from priors→collab. |
| Warm-start | ≥ 50 | Content (0.35) + Collab (0.30) | Personalised ranking; bandit fully annealed. |

### Final pipeline

```
recommend(userId, n):
  1. filter(profiles, hardDemographicGate(prefs))           # gender + age-range + distance
  2. score each survivor against (a, prefs, deck history)
  3. MMR re-rank against the last k surfaced cards
  4. take top-n
  5. attach reasons[] (top-3 contributing sub-scores, templated)
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│                                                                  │
│   src/app/page.tsx   (RSC "use client" composition root)         │
│   ├─ NavBar (fixed bottom, 4 tabs)                               │
│   ├─ DiscoverPage  ─┐                                            │
│   ├─ MatchesPage   ─┤  inline minimal components                  │
│   ├─ ChatPage      ─┤  (swap with @/components/dating/* later)    │
│   ├─ ProfilePage   ─┤                                            │
│   └─ MatchModal    ─┘                                            │
│           │                                                      │
│           ▼  imports + subscribes                                │
│   src/lib/dating-store.ts   (Zustand + persist middleware)       │
│   └─ fetch() ─────────────────────────────────┐                 │
└────────────────────────────────────────────────│─────────────────┘
                                                 │
                                                 ▼ HTTP (JSON)
┌──────────────────────────────────────────────────────────────────┐
│  Next.js Node.js runtime (route handlers)                       │
│                                                                  │
│   src/app/api/dating/recommend/route.ts  POST {userId, n}        │
│   src/app/api/dating/swipe/route.ts      POST {userId,profileId,│
│                                                   action}        │
│   src/app/api/dating/matches/route.ts    GET  ?userId=          │
│   src/app/api/dating/profile/route.ts    GET/POST                │
│           │                                                      │
│           ▼  module-level singleton                              │
│   src/lib/matching.ts                                                    │
│   └─ MatchingEngine (MOCK_PROFILES, MOCK_SWIPE_HISTORY)          │
│      ├─ score_content / score_collab / score_elo                  │
│      ├─ score_bandit / score_diversity / score_demographics       │
│      └─ composite + MMR re-rank + reasons[]                       │
└──────────────────────────────────────────────────────────────────┘
```

### Design notes

- **Single engine instance.** Each API route declares `const engine = new MatchingEngine(MOCK_PROFILES, MOCK_SWIPE_HISTORY);` at module scope, so the engine (and its in-memory index, swipe graph, Elo cache) is shared across all requests in the same Node.js process — no per-request rebuild.
- **`runtime = "nodejs"` + `dynamic = "force-dynamic"`.** Every route opts out of Edge (the in-memory engine is stateful and must not be frozen / re-spawned per request) and out of static optimisation (responses depend on the live swipe graph).
- **Defensive client.** The Zustand store imports types from `@/lib/matching` as **type-only** (`import type`) — they are erased at compile time, so the client bundle never depends on the matching module's runtime. Initial `currentUser` + `preferences` are defined locally as fallbacks; the store loads cleanly even before the matching lib is shipped.
- **`partialize` persistence.** Only `currentUser`, `preferences`, `activeTab`, and `matches` are persisted to `localStorage`; everything else is re-derived on mount.
- **Error containment.** Every API route wraps its handler body in `try/catch`: bad input → `400 { error }`; engine failure → `500 { error, message }`. The store surfaces errors as a top-of-screen toast with a dismiss button.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) | File-system routing, RSC, route handlers, native `nodejs` runtime. |
| Language | **TypeScript 5** (strict) | End-to-end type safety from API contract to UI props. |
| UI library | **React 19** | Concurrent features, hooks, function components throughout. |
| Styling | **Tailwind CSS 4** + `tw-animate-css` | Utility-first; `@theme inline` tokens; safe-area + custom keyframes. |
| State | **Zustand 5** + `persist` middleware | Tiny, ergonomic, `localStorage`-backed, no provider tree. |
| Icons | **lucide-react** | Tree-shakeable SVG icons; consistent stroke. |
| Fonts | **Geist** + **Geist Mono** (via `next/font`) | Zero-CLS, self-hosted, variable. |
| Toaster | shadcn/ui `Toaster` (radix-ui) | Accessible, dismissible toasts. |
| Matching engine | `@/lib/matching` (parallel task) | Typed singleton; six scoring functions + composite + MMR. |

No external network calls. The app runs **fully offline** against the in-memory mock corpus.

---

## Quick Start

### Prerequisites
- **Node.js 20+** (or **Bun**) — the sandbox dev server uses Bun.
- All dependencies (zustand, next, react, lucide-react, …) are already in `package.json`; **do not install anything**.

### Run the dev server

```bash
# from the repo root
bun dev          # or:  npm run dev
```

The app is served at **http://localhost:3000**.

### Try the flows

1. **Discover** — open the app; the deck loads automatically (`loadRecommendations` on mount). Tap **Like**; if the deterministic 30% reciprocity hash hits, the **MatchModal** fires with confetti.
2. **Matches** — switch to the Matches tab; matched profiles appear in a 2-column grid (also loaded on mount).
3. **Chat** — tap a match → ChatPage opens with a canned Nepali-English opener. Type a message → mock canned reply after ~1.1s.
4. **Profile** — edit preferences (looking-for, show-me, age range, distance, cities, interests). Changes POST to `/api/dating/profile` automatically.
5. **Refresh the deck** — when the deck empties, tap **Refresh deck** to re-call `loadRecommendations`.

### Inspect the API directly

```bash
# recommend
curl -X POST http://localhost:3000/api/dating/recommend \
  -H 'Content-Type: application/json' \
  -d '{"userId":"u-self","n":5}'

# swipe (mock 30% reciprocity)
curl -X POST http://localhost:3000/api/dating/swipe \
  -H 'Content-Type: application/json' \
  -d '{"userId":"u-self","profileId":"p-1","action":"accept"}'

# matches
curl 'http://localhost:3000/api/dating/matches?userId=u-self'

# profile (GET)
curl 'http://localhost:3000/api/dating/profile?userId=u-self'

# profile (POST preferences)
curl -X POST http://localhost:3000/api/dating/profile \
  -H 'Content-Type: application/json' \
  -d '{"userId":"u-self","preferences":{"distanceKm":40}}'
```

---

## API Reference

### `POST /api/dating/recommend`
- **Body:** `{ userId: string, n?: number }`
- **200:** `{ recommendations: MatchResult[], count: number, userId: string }`
- **400:** `{ error: string }` — bad/missing input
- **500:** `{ error: "Internal server error", message: string }`

Each `MatchResult` contains `{ profile: DatingProfile, score: number, scores: ScoreBreakdown, reasons: string[], isNew: boolean, distanceKm?: number }`.

### `POST /api/dating/swipe`
- **Body:** `{ userId: string, profileId: string, action: "accept" | "reject" }`
- **200:** `{ matched: boolean, matchProfile: DatingProfile | null, swipeId: string, action, profileId }`
- Reciprocity is a **deterministic 30% hash** of the unordered `{userId, profileId}` pair — same pair → same outcome, reproducible across runs.

### `GET /api/dating/matches?userId=X`
- **200:** `{ matches: DatingProfile[], count: number, userId: string }`

### `GET /api/dating/profile?userId=X`
- **200:** `{ profile: DatingProfile | null, preferences: UserPreferences, userId: string }`

### `POST /api/dating/profile`
- **Body:** `{ userId: string, preferences: Partial<UserPreferences> }`
- **200:** `{ preferences: UserPreferences, userId: string }` — the merged + normalised preferences.
- Validates `ageRange` (2-number tuple), `distanceKm` (non-negative), `gender` (enum).

---

## Reproducibility

Every non-deterministic surface is pinned:

| Surface | Mechanism |
|---|---|
| Reciprocity (mock 30%) | FNV-1a 32-bit hash of `min(userId,profileId) + "|" + max(...)` → `% 100 < 30`. Same pair → same decision, forever. |
| Elo updates | Standard logistic update, `K = 32`, deterministic given the same swipe stream. |
| Bandit `ln(t+1)/(n_i+1)` | Deterministic given the same swipe stream. |
| MMR `max_{d∈D} sim(b,d)` | Deterministic given the same surfaced-deck history. |
| `runtime = "nodejs"` + `dynamic = "force-dynamic"` | No static caching; the live engine state drives every response. |
| Single module-level `MatchingEngine` | The engine's in-memory state is shared across all requests in a process — running two `recommend` calls back-to-back will see the same swipe graph. |

> ⚠️ The dev server (`next dev`) hot-reloads modules on file change, which resets the engine singleton. For reproducibility *across* file changes, restart the dev server cleanly. In production (`next start`), the singleton persists for the lifetime of the Node.js process.

---

## Project Layout

```
.
├── README.md                              ← you are here
├── package.json
├── next.config.ts                         ← output: "standalone", ignoreBuildErrors: true
├── tsconfig.json                          ← @/* → ./src/*
└── src/
    ├── app/
    │   ├── layout.tsx                     ← metadata + Geist fonts + Toaster
    │   ├── page.tsx                       ← "use client" composition root (inline UI)
    │   ├── globals.css                    ← Tailwind + Milan custom utilities/keyframes
    │   └── api/
    │       └── dating/
    │           ├── recommend/route.ts     ← POST {userId,n} → ranked candidates
    │           ├── swipe/route.ts         ← POST {userId,profileId,action} → match?
    │           ├── matches/route.ts       ← GET ?userId= → matched profiles
    │           └── profile/route.ts       ← GET/POST → user profile + preferences
    ├── lib/
    │   ├── dating-store.ts                ← Zustand + persist (this task)
    │   ├── matching.ts                    ← MatchingEngine + types + data (parallel task)
    │   ├── utils.ts                       ← shadcn cn() helper
    │   └── db.ts                          ← Prisma client
    ├── components/
    │   └── ui/                             ← shadcn/ui primitives (Toaster, etc.)
    └── hooks/
        ├── use-toast.ts
        └── use-mobile.ts
```

---

## Roadmap

- [ ] Real-time chat (WebSocket / SSE) replacing the canned-reply mock.
- [ ] Photo upload + object-storage-backed CDN.
- [ ] Server-side `MatchingEngine` persistence (today: in-memory, resets per process).
- [ ] Push notifications for new matches + messages (Nepali carriers' FCM support).
- [ ] Verification badges (Nagarik App + Nepali phone OTP).
- [ ] Reporting + blocking flow (safety).
- [ ] i18n with `next-intl` (Nepali + English + Newari).

---

## Contributing

PRs welcome. Please:

1. Run `bun dev` and confirm the app loads at `localhost:3000`.
2. Keep the **single module-level `MatchingEngine`** pattern — never instantiate per-request.
3. Keep API routes wrapped in `try/catch` (400 for bad input, 500 for errors).
4. Add or update JSDoc on every exported symbol.
5. Keep the MIT header at the top of every new source file.

---

## License

Released under the **MIT License**.

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

---

<p align="center">
  <em>🌸 Milan — मिलन — the meeting. Built with care for Nepal.</em>
</p>
