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

/**
 * POST /api/dating/swipe
 *
 * Request body: `{ userId: string; profileId: string; action: "accept" | "reject" }`
 * Response 200: `{ matched: boolean; matchProfile: DatingProfile | null; swipeId: string }`
 * Response 400: `{ error: string }` — bad/missing input
 * Response 500: `{ error: string; message: string }` — engine failure
 *
 * Records a swipe through the singleton `MatchingEngine.recordSwipe()`.
 * If the action is `accept`, the route ALSO performs a mock reciprocity
 * check — a deterministic 30% probability that the target profile has
 * already accepted the user — and, on a hit, records the reverse swipe
 * + returns the matched profile so the client can show a MatchModal.
 *
 * The 30% probability is computed deterministically from a stable hash
 * of the unordered `{userId, profileId}` pair so that the same pair
 * always yields the same outcome (reproducible for tests + replays).
 *
 * @see {@link @/lib/matching} — MatchingEngine, MOCK_PROFILES, MOCK_SWIPE_HISTORY
 */

import { NextRequest, NextResponse } from "next/server";
import {
  MatchingEngine,
  MOCK_PROFILES,
  MOCK_SWIPE_HISTORY,
  type DatingProfile,
} from "@/lib/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Module-level singleton (shared with /recommend). */
const engine = new MatchingEngine(MOCK_PROFILES, MOCK_SWIPE_HISTORY);

/**
 * Deterministic 30% reciprocity check.
 *
 * Hashes the unordered pair so that `f(a,b) === f(b,a)` and the same
 * pair always yields the same decision — ~30% of distinct pairs match.
 *
 * @param userId - current user id
 * @param profileId - target profile id
 * @returns `true` if the (deterministic) reciprocity roll succeeded.
 */
function mockReciprocity(userId: string, profileId: string): boolean {
  const [a, b] = userId < profileId ? [userId, profileId] : [profileId, userId];
  const key = `${a}|${b}`;
  let h = 0x811c9dc5; // FNV-1a 32-bit basis
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100 < 30;
}

/**
 * POST handler — record a swipe + perform the mock reciprocity check.
 *
 * @param req - NextRequest with JSON body `{ userId, profileId, action }`.
 * @returns 200 `{ matched, matchProfile, swipeId }` | 400 | 500.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 },
      );
    }

    const { userId, profileId, action } = body as {
      userId?: unknown;
      profileId?: unknown;
      action?: unknown;
    };

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "`userId` is required (string)." },
        { status: 400 },
      );
    }
    if (!profileId || typeof profileId !== "string") {
      return NextResponse.json(
        { error: "`profileId` is required (string)." },
        { status: 400 },
      );
    }
    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { error: "`action` must be \"accept\" or \"reject\"." },
        { status: 400 },
      );
    }

    // 1) Record the user's swipe.
    engine.recordSwipe(userId, profileId, action);

    // 2) Mock reciprocity: only on `accept`.
    let matched = false;
    let matchProfile: DatingProfile | null = null;
    if (action === "accept" && mockReciprocity(userId, profileId)) {
      const target = engine.getUserProfile(profileId);
      if (target) {
        // Record the reverse swipe so /matches + collaborative filtering see it.
        engine.recordSwipe(profileId, userId, "accept");
        matched = true;
        matchProfile = target;
      }
    }

    const swipeId = `sw_${userId}_${profileId}_${action}_${Date.now()}`;

    return NextResponse.json(
      { matched, matchProfile, swipeId, action, profileId },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/dating/swipe] error:", message);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 },
    );
  }
}

/** GET — route metadata for smoke tests. */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/dating/swipe",
      method: "POST",
      body: { userId: "string", profileId: "string", action: '"accept" | "reject"' },
      reciprocityProbability: 0.3,
    },
    { status: 200 },
  );
}
