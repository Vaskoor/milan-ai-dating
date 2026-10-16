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
 * POST /api/dating/recommend
 *
 * Request body: `{ userId: string; n?: number }`
 * Response 200: `{ recommendations: MatchResult[]; count: number }`
 * Response 400: `{ error: string }` — bad/missing input
 * Response 500: `{ error: string; message: string }` — engine failure
 *
 * Calls the module-level singleton `MatchingEngine.recommend(userId, n)`
 * to return ranked candidates with composite scores + per-function
 * breakdowns + human-readable reasons.
 *
 * @see {@link @/lib/matching} — MatchingEngine, MOCK_PROFILES, MOCK_SWIPE_HISTORY
 */

import { NextRequest, NextResponse } from "next/server";
import {
  MatchingEngine,
  MOCK_PROFILES,
  MOCK_SWIPE_HISTORY,
} from "@/lib/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Module-level singleton engine. Instantiated exactly once per server
 * process with the mock profiles + swipe history. The constructor wires
 * the in-memory profile index + swipe graph + Elo cache that the six
 * scoring functions read from.
 */
const engine = new MatchingEngine(MOCK_PROFILES, MOCK_SWIPE_HISTORY);

/**
 * POST handler — returns ranked recommendations for the given user.
 *
 * @param req - NextRequest with JSON body `{ userId, n? }`.
 * @returns 200 `{ recommendations, count }` | 400 | 500.
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

    const { userId, n } = body as { userId?: unknown; n?: unknown };

    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return NextResponse.json(
        { error: "`userId` is required and must be a non-empty string." },
        { status: 400 },
      );
    }

    // Clamp `n` to a sane range; default to 10.
    let count = 10;
    if (typeof n === "number" && Number.isFinite(n)) {
      count = Math.max(1, Math.min(50, Math.floor(n)));
    }

    const recommendations = engine.recommend(userId, count);

    return NextResponse.json(
      { recommendations, count: recommendations.length, userId },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/dating/recommend] error:", message);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 },
    );
  }
}

/**
 * GET handler — returns API metadata (handy for smoke-testing the route
 * without a POST body). Not part of the production contract.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/dating/recommend",
      method: "POST",
      body: { userId: "string", n: "number?" },
      profilesIndexed: MOCK_PROFILES.length,
    },
    { status: 200 },
  );
}
