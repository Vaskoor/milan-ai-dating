/**
 * ProfileDetailModal.tsx — Milan AI Dating
 * ---------------------------------------------------------------------------
 * Full-screen expanded profile view.  Renders a swipeable photo gallery,
 * the complete bio, all interest tags, education + occupation + lifestyle
 * details, distance, and verified badge.  Accept / Reject buttons trigger
 * the same swipe flow as the deck (so swiping from the modal is consistent
 * with swiping from the deck).
 *
 * Visibility is controlled by the `profile` prop: when non-null the modal
 * mounts; when set back to null, AnimatePresence slides it down out.
 *
 * Contract: imports `DatingProfile` from `@/lib/matching/types`.
 *
 * Copyright (c) 2025 Z.ai — MIT License
 */
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  BadgeCheck,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Heart,
  MapPin,
  Ruler,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DatingProfile } from "@/lib/matching/types";

export interface ProfileDetailModalProps {
  /** When non-null, the modal is shown for this profile. */
  profile: DatingProfile | null;
  /** Fired when the user dismisses the modal (X / backdrop / Esc). */
  onClose: () => void;
  /** Fired on Accept (green heart). */
  onAccept: (profile: DatingProfile) => void;
  /** Fired on Reject (red X). */
  onReject: (profile: DatingProfile) => void;
}

const SWIPE_THRESHOLD = 80;

export default function ProfileDetailModal({
  profile,
  onClose,
  onAccept,
  onReject,
}: ProfileDetailModalProps) {
  const [photoIdx, setPhotoIdx] = useState(0);
  // Reset the gallery + index whenever a new profile opens. Done during
  // render (rather than in an effect) to avoid the cascading-render warning
  // from `react-hooks/set-state-in-effect`.
  const [lastProfileId, setLastProfileId] = useState(profile?.id);
  if (profile?.id !== lastProfileId) {
    setLastProfileId(profile?.id);
    setPhotoIdx(0);
  }

  // Escape to dismiss.
  useEffect(() => {
    if (!profile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setPhotoIdx((i) => Math.min(i + 1, (profile?.photos?.length ?? 1) - 1));
      if (e.key === "ArrowLeft") setPhotoIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profile, onClose]);

  /** Advance the gallery on horizontal swipe. */
  function handleDragEnd(_: unknown, info: PanInfo): void {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      setPhotoIdx((i) => Math.min(i + 1, (profile?.photos?.length ?? 1) - 1));
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      setPhotoIdx((i) => Math.max(i - 1, 0));
    }
  }

  const photos = profile?.photos ?? (profile?.photo ? [profile.photo] : []);
  const currentPhoto = photos[photoIdx] ?? photos[0];

  return (
    <AnimatePresence>
      {profile ? (
        <motion.div
          key="profile-detail-overlay"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={`${profile.name} — full profile`}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close profile"
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet (mobile = bottom sheet, desktop = centered card) */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-20 inline-flex size-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
            >
              <X className="size-5" />
            </button>

            {/* Photo gallery */}
            <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-muted">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.img
                  key={photoIdx}
                  src={currentPhoto}
                  alt={`${profile.name} — photo ${photoIdx + 1}`}
                  className="absolute inset-0 size-full object-cover"
                  draggable={false}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>

              {/* Drag layer for swipe navigation */}
              <motion.div
                className="absolute inset-0 touch-none"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.6}
                onDragEnd={handleDragEnd}
              />

              {/* Gradient + name overlay */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />

              {/* Verified badge */}
              {profile.verified ? (
                <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-sky-500/90 px-2.5 py-1 text-xs font-semibold text-white shadow-md backdrop-blur">
                  <BadgeCheck className="size-3.5" /> Verified
                </div>
              ) : null}

              {/* Gallery arrows (when >1 photo) */}
              {photos.length > 1 ? (
                <>
                  <GalleryArrow
                    side="left"
                    onClick={() => setPhotoIdx((i) => Math.max(i - 1, 0))}
                    disabled={photoIdx === 0}
                  />
                  <GalleryArrow
                    side="right"
                    onClick={() =>
                      setPhotoIdx((i) => Math.min(i + 1, photos.length - 1))
                    }
                    disabled={photoIdx === photos.length - 1}
                  />
                </>
              ) : null}

              {/* Photo dots */}
              {photos.length > 1 ? (
                <div className="absolute inset-x-0 top-2 z-10 flex justify-center gap-1.5">
                  {photos.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === photoIdx
                          ? "w-5 bg-white"
                          : "w-1.5 bg-white/50",
                      )}
                    />
                  ))}
                </div>
              ) : null}

              {/* Name + age + city */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-1 p-4 text-white">
                <h2 className="text-2xl font-bold drop-shadow">
                  {profile.name}, <span className="font-semibold">{profile.age}</span>
                </h2>
                <p className="flex items-center gap-1.5 text-sm text-white/85">
                  <MapPin className="size-4" />
                  {profile.city}
                </p>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-5 overflow-y-auto p-4 pb-2">
              {/* Bio */}
              {profile.bio ? (
                <section>
                  <SectionTitle>About</SectionTitle>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {profile.bio}
                  </p>
                </section>
              ) : null}

              {/* Interests */}
              {profile.interests && profile.interests.length > 0 ? (
                <section>
                  <SectionTitle>Interests</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.interests.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="border-rose-200 bg-rose-50 text-rose-700"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Work + education */}
              {(profile.occupation || profile.education) ? (
                <section>
                  <SectionTitle>Background</SectionTitle>
                  <ul className="space-y-1.5 text-sm">
                    {profile.occupation ? (
                      <li className="flex items-center gap-2">
                        <Briefcase className="size-4 text-muted-foreground" />
                        <span>{profile.occupation}</span>
                      </li>
                    ) : null}
                    {profile.education ? (
                      <li className="flex items-center gap-2">
                        <GraduationCap className="size-4 text-muted-foreground" />
                        <span>{profile.education}</span>
                      </li>
                    ) : null}
                  </ul>
                </section>
              ) : null}

              {/* Lifestyle */}
              {profile.lifestyle ? (
                <section>
                  <SectionTitle>Lifestyle</SectionTitle>
                  <ul className="grid grid-cols-2 gap-2 text-sm">
                    <LifestyleRow icon={Ruler} label="Drinking" value={profile.lifestyle.drinking} />
                    <LifestyleRow icon={Ruler} label="Smoking" value={profile.lifestyle.smoking} />
                    <LifestyleRow icon={Ruler} label="Diet" value={profile.lifestyle.diet} />
                    <LifestyleRow icon={Ruler} label="Kids" value={profile.lifestyle.kids} />
                    <LifestyleRow icon={Heart} label="Looking for" value={profile.lifestyle.relationshipType} />
                  </ul>
                </section>
              ) : null}
            </div>

            {/* Sticky action footer */}
            <div className="flex shrink-0 items-center justify-center gap-5 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <ActionButton
                label="Reject"
                onClick={() => onReject(profile)}
                className="border-red-200 bg-white text-red-500 hover:bg-red-50"
                size="lg"
              >
                <X className="size-6" strokeWidth={2.5} />
              </ActionButton>

              <ActionButton
                label="Accept"
                onClick={() => onAccept(profile)}
                className="border-emerald-200 bg-white text-emerald-500 hover:bg-emerald-50"
                size="lg"
              >
                <Heart className="size-6" fill="currentColor" strokeWidth={2.5} />
              </ActionButton>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Section heading. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

/** A lifestyle key/value row. */
function LifestyleRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}

/** Gallery side arrow. */
function GalleryArrow({
  side,
  onClick,
  disabled,
}: {
  side: "left" | "right";
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        "absolute top-1/2 z-10 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-30",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

/** Circular footer action button. */
function ActionButton({
  children,
  label,
  onClick,
  className,
  size = "md",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "size-14" : size === "md" ? "size-12" : "size-10";
  return (
    <motion.button
      type="button"
      aria-label={label}
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center rounded-full border-2 bg-white shadow-lg transition-colors",
        sizeClass,
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
