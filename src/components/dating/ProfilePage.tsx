/**
 * ProfilePage.tsx — Milan AI Dating
 * ---------------------------------------------------------------------------
 * User profile + preference settings.
 *
 * Sections:
 *   1. Profile header — editable photo, name, age, bio.
 *   2. Preferences — age-range (min/max) slider, max distance slider,
 *      gender preference select, interest multi-select chips.
 *   3. Lifestyle — drinking / smoking / diet / relationship-type selects.
 *   4. Settings list — notifications, privacy, logout.
 *   5. Save button — persists to parent (which POSTs to /api/dating/prefs).
 *
 * The component is fully controlled: it clones `user.preferences` into
 * local state on mount and calls `onSave` with the updated prefs object.
 *
 * Contract: imports `DatingProfile`, `UserPreferences` + the lifestyle
 * enums (`DrinkingSmoking`, `Diet`, `KidsPreference`, `RelationshipType`)
 * from `@/lib/matching/types`.
 *
 * Copyright (c) 2025 Z.ai — MIT License
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  ChevronRight,
  LogOut,
  Save,
  Shield,
  Sparkles,
  User as UserIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type {
  DatingProfile,
  Diet,
  DrinkingSmoking,
  KidsPreference,
  RelationshipType,
  UserPreferences,
} from "@/lib/matching/types";

/**
 * Pool of selectable interests shown as toggle chips. These mirror the
 * canonical 15 tags used by the matching data layer (see `data.ts`).
 */
const INTEREST_POOL: string[] = [
  "trekking",
  "photography",
  "music",
  "cooking",
  "reading",
  "football",
  "dance",
  "yoga",
  "travel",
  "art",
  "gaming",
  "movies",
  "fitness",
  "foodie",
  "pets",
];

/** Lifestyle options, typed against the matching enums. */
const DRINKING_OPTS: DrinkingSmoking[] = ["never", "sometimes", "often"];
const SMOKING_OPTS: DrinkingSmoking[] = ["never", "sometimes", "often"];
const DIET_OPTS: Diet[] = ["veg", "non-veg", "eggetarian"];
const KIDS_OPTS: KidsPreference[] = ["none", "want", "have"];
const RELATIONSHIP_OPTS: RelationshipType[] = [
  "casual",
  "serious",
  "marriage",
];

/** Age range bounds. */
const AGE_MIN = 18;
const AGE_MAX = 65;
/** Distance slider bounds (km). */
const DIST_MIN = 1;
const DIST_MAX = 200;

export interface ProfilePageProps {
  /** The logged-in user's profile (editable name / age / bio / photo). */
  user: DatingProfile;
  /** The user's current matching preferences (editable). */
  preferences: UserPreferences;
  /** Fired when the user taps Save. */
  onSave: (prefs: UserPreferences) => void;
  /** Fired when the user taps "Log out". */
  onLogout: () => void;
}

export default function ProfilePage({
  user,
  preferences,
  onSave,
  onLogout,
}: ProfilePageProps) {
  const [name, setName] = useState(user.name);
  const [age, setAge] = useState(String(user.age ?? ""));
  const [bio, setBio] = useState(user.bio ?? "");
  const [prefs, setPrefs] = useState<UserPreferences>(
    () => preferences ?? defaultPrefs(),
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Re-sync if the user prop changes (e.g. after a server fetch).
  useEffect(() => {
    setName(user.name);
    setAge(String(user.age ?? ""));
    setBio(user.bio ?? "");
    setPrefs(preferences ?? defaultPrefs());
  }, [user, preferences]);

  /** Toggle an interest chip. */
  function toggleInterest(tag: string): void {
    setPrefs((prev) => {
      const has = prev.interests.includes(tag);
      return {
        ...prev,
        interests: has
          ? prev.interests.filter((t) => t !== tag)
          : [...prev.interests, tag],
      };
    });
  }

  /** Save handler — fires onSave and shows a brief "saved" confirmation. */
  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      onSave(prefs);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10 pt-4">
      {/* Profile header */}
      <section className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-b from-rose-50 to-pink-50 p-5 shadow-sm">
        <div className="relative">
          <div className="size-24 overflow-hidden rounded-full ring-4 ring-white shadow-lg">
            {user.photo ? (
              <img
                src={user.photo}
                alt={user.name}
                className="size-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-rose-500 text-3xl font-bold text-white">
                {user.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Change photo"
            className="absolute bottom-0 right-0 inline-flex size-7 items-center justify-center rounded-full bg-rose-500 text-white shadow-md ring-2 ring-white"
          >
            <Sparkles className="size-3.5" />
          </button>
        </div>

        <div className="w-full space-y-2">
          <div>
            <Label htmlFor="user-name" className="sr-only">Name</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="text-center font-semibold"
            />
          </div>
          <div>
            <Label htmlFor="user-age" className="sr-only">Age</Label>
            <Input
              id="user-age"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))}
              placeholder="Age"
              className="text-center"
            />
          </div>
          <div>
            <Label htmlFor="user-bio" className="sr-only">Bio</Label>
            <Textarea
              id="user-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write something about yourself…"
              rows={3}
              className="resize-none bg-white/70"
            />
          </div>
        </div>
      </section>

      {/* Preferences */}
      <Section title="Preferences" icon={UserIcon}>
        <div className="space-y-5">
          {/* Age range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Age range</Label>
              <span className="text-sm font-medium text-rose-600">
                {prefs.ageMin} – {prefs.ageMax}
              </span>
            </div>
            <Slider
              value={[prefs.ageMin, prefs.ageMax]}
              min={AGE_MIN}
              max={AGE_MAX}
              step={1}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, ageMin: v[0], ageMax: v[1] }))
              }
              className="py-2"
              aria-label="Age range"
            />
          </div>

          {/* Max distance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Maximum distance</Label>
              <span className="text-sm font-medium text-rose-600">
                {prefs.maxDistanceKm} km
              </span>
            </div>
            <Slider
              value={[prefs.maxDistanceKm]}
              min={DIST_MIN}
              max={DIST_MAX}
              step={1}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, maxDistanceKm: v[0] }))
              }
              className="py-2"
              aria-label="Maximum distance"
            />
          </div>

          {/* Gender preference */}
          <div className="space-y-1.5">
            <Label>Gender preference</Label>
            <Select
              value={prefs.genderPreference}
              onValueChange={(v) =>
                setPrefs((p) => ({
                  ...p,
                  genderPreference: v as UserPreferences["genderPreference"],
                }))
              }
            >
              <SelectTrigger className="w-full" aria-label="Gender preference">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Everyone</SelectItem>
                <SelectItem value="female">Women</SelectItem>
                <SelectItem value="male">Men</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Interest chips */}
          <div className="space-y-1.5">
            <Label>Interests</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {INTEREST_POOL.map((tag) => {
                const active = prefs.interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-rose-500 bg-rose-500 text-white"
                        : "border-border bg-background text-foreground hover:border-rose-300 hover:text-rose-600",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* Lifestyle */}
      <Section title="Lifestyle" icon={Sparkles}>
        <div className="grid grid-cols-2 gap-3">
          <LifestyleSelect<DrinkingSmoking>
            label="Drinking"
            value={prefs.lifestyle?.drinking ?? ""}
            options={DRINKING_OPTS}
            onChange={(v) =>
              setPrefs((p) => ({
                ...p,
                lifestyle: { ...(p.lifestyle ?? {}), drinking: v },
              }))
            }
          />
          <LifestyleSelect<DrinkingSmoking>
            label="Smoking"
            value={prefs.lifestyle?.smoking ?? ""}
            options={SMOKING_OPTS}
            onChange={(v) =>
              setPrefs((p) => ({
                ...p,
                lifestyle: { ...(p.lifestyle ?? {}), smoking: v },
              }))
            }
          />
          <LifestyleSelect<Diet>
            label="Diet"
            value={prefs.lifestyle?.diet ?? ""}
            options={DIET_OPTS}
            onChange={(v) =>
              setPrefs((p) => ({
                ...p,
                lifestyle: { ...(p.lifestyle ?? {}), diet: v },
              }))
            }
          />
          <LifestyleSelect<KidsPreference>
            label="Kids"
            value={prefs.lifestyle?.kids ?? ""}
            options={KIDS_OPTS}
            onChange={(v) =>
              setPrefs((p) => ({
                ...p,
                lifestyle: { ...(p.lifestyle ?? {}), kids: v },
              }))
            }
          />
          <LifestyleSelect<RelationshipType>
            label="Looking for"
            value={prefs.lifestyle?.relationshipType ?? ""}
            options={RELATIONSHIP_OPTS}
            onChange={(v) =>
              setPrefs((p) => ({
                ...p,
                lifestyle: { ...(p.lifestyle ?? {}), relationshipType: v },
              }))
            }
          />
        </div>
      </Section>

      {/* Save button */}
      <motion.div
        initial={false}
        animate={savedFlash ? { scale: [1, 1.03, 1] } : { scale: 1 }}
        className="mt-4"
      >
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-12 w-full gap-2 rounded-full bg-rose-500 text-base font-semibold text-white shadow-lg hover:bg-rose-600"
        >
          <Save className="size-5" />
          {savedFlash ? "Saved!" : saving ? "Saving…" : "Save preferences"}
        </Button>
      </motion.div>

      {/* Settings list */}
      <Section title="Settings" icon={Shield}>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          <SettingsRow icon={Bell} label="Notifications" />
          <SettingsRow icon={Shield} label="Privacy & blocking" />
          <SettingsRow icon={LogOut} label="Log out" onClick={onLogout} danger />
        </ul>
      </Section>
    </div>
  );
}

/** A labelled card section with an icon. */
function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof UserIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <header className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-rose-500" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      </header>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        {children}
      </div>
    </section>
  );
}

/** A lifestyle dimension rendered as a labelled Select. */
function LifestyleSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue placeholder="Any" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A single settings list row. */
function SettingsRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof UserIcon;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-accent",
          danger ? "text-red-600 hover:bg-red-50" : "text-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 font-medium">{label}</span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>
    </li>
  );
}

/** Sensible default preferences. */
function defaultPrefs(): UserPreferences {
  return {
    ageMin: 22,
    ageMax: 35,
    genderPreference: "both",
    maxDistanceKm: 50,
    interests: [],
    lifestyle: {},
  };
}
