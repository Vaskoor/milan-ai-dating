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
 * GET /api/dating/matches?userId=X
 *
 * Response 200: `{ matches: DatingProfile[]; count: number; userId: string }`
 * Response 400: `{ error: string }` — missing userId
 * Response 500: `{ error: string; message: string }`
 *
 * Delegates to `MatchingEngine.getMatches(userId)` which walks the
 * bidirectional accept-accept graph and returns the matched profiles.
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

/** Module-level singleton (shared with /recommend + /swipe). */
const engine = new MatchingEngine(MOCK_PROFILES, MOCK_SWIPE_HISTORY);

/**
 * GET handler — return the list of profiles the user has matched with.
 *
 * @param req - NextRequest with `?userId=...` query param.
 * @returns 200 `{ matches, count, userId }` | 400 | 500.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId || userId.trim().length === 0) {
      return NextResponse.json(
        { error: "`userId` query parameter is required." },
        { status: 400 },
      );
    }

    const matches = engine.getMatches(userId);

    return NextResponse.json(
      { matches, count: matches.length, userId },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/dating/matches] error:", message);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 },
    );
  }
}
