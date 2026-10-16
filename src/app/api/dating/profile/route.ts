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
 * Profile + Preferences API.
 *
 * GET  /api/dating/profile?userId=X
 *   -> `{ profile: DatingProfile | null, preferences: UserPreferences, userId }`
 *
 * POST /api/dating/profile   `{ userId, preferences }`
 *   -> `{ preferences: UserPreferences, userId }` (the merged + normalised prefs)
 *
 * The singleton `MatchingEngine` is the source of truth: `getUserProfile`
 * returns the profile object (or null if unknown), `getPreferences` returns
 * the user's preferences (falling back to engine defaults for new users),
 * and `updatePreferences` writes a partial overlay back into the engine.
 *
 * @see {@link @/lib/matching} — MatchingEngine, MOCK_PROFILES, MOCK_SWIPE_HISTORY, UserPreferences
 */

import { NextRequest, NextResponse } from "next/server";
import {
  MatchingEngine,
  MOCK_PROFILES,
  MOCK_SWIPE_HISTORY,
  type UserPreferences,
} from "@/lib/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Module-level singleton (shared across all dating routes). */
const engine = new MatchingEngine(MOCK_PROFILES, MOCK_SWIPE_HISTORY);

/**
 * GET handler — return the user's profile + preferences.
 *
 * @param req - NextRequest with `?userId=...`.
 * @returns 200 `{ profile, preferences, userId }` | 400 | 500.
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

    const profile = engine.getUserProfile(userId) ?? null;
    const preferences = engine.getPreferences(userId);

    return NextResponse.json(
      { profile, preferences, userId },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/dating/profile GET] error:", message);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 },
    );
  }
}

/**
 * POST handler — overlay partial preferences onto the user's record.
 *
 * @param req - NextRequest with JSON body `{ userId, preferences: Partial<UserPreferences> }`.
 * @returns 200 `{ preferences, userId }` | 400 | 500.
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

    const { userId, preferences } = body as {
      userId?: unknown;
      preferences?: unknown;
    };

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "`userId` is required (string)." },
        { status: 400 },
      );
    }
    if (!preferences || typeof preferences !== "object") {
      return NextResponse.json(
        { error: "`preferences` must be a JSON object." },
        { status: 400 },
      );
    }

    // Defensive: shallow-validate the well-known preference keys so a
    // malformed payload doesn't poison the engine. The engine itself
    // is the final authority on normalisation.
    const prefs = preferences as Record<string, unknown>;
    if (
      prefs.ageRange !== undefined &&
      !(
        Array.isArray(prefs.ageRange) &&
        prefs.ageRange.length === 2 &&
        prefs.ageRange.every((v) => typeof v === "number")
      )
    ) {
      return NextResponse.json(
        { error: "`preferences.ageRange` must be a [number, number] tuple." },
        { status: 400 },
      );
    }
    if (
      prefs.distanceKm !== undefined &&
      (typeof prefs.distanceKm !== "number" || prefs.distanceKm < 0)
    ) {
      return NextResponse.json(
        { error: "`preferences.distanceKm` must be a non-negative number." },
        { status: 400 },
      );
    }
    if (
      prefs.gender !== undefined &&
      !["male", "female", "other", "any"].includes(prefs.gender as string)
    ) {
      return NextResponse.json(
        { error: "`preferences.gender` must be one of male|female|other|any." },
        { status: 400 },
      );
    }

    engine.updatePreferences(userId, prefs as Partial<UserPreferences>);
    const updated = engine.getPreferences(userId);

    return NextResponse.json(
      { preferences: updated, userId },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/dating/profile POST] error:", message);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 },
    );
  }
}
