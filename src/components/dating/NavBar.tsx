/**
 * NavBar.tsx — Milan AI Dating
 * ---------------------------------------------------------------------------
 * Mobile-style sticky bottom navigation. Four tabs (Discover / Matches /
 * Chat / Profile) with the active tab highlighted in rose.  Backdrop blur +
 * safe-area inset padding keeps it usable on notched phones.  Badge counts
 * on Matches and Chat draw attention to new activity.
 *
 * Copyright (c) 2025 Z.ai — MIT License
 */
"use client";

import { motion } from "framer-motion";
import { Flame, Heart, MessageCircle, User } from "lucide-react";

import { cn } from "@/lib/utils";

export type NavTab = "discover" | "matches" | "chat" | "profile";

export interface NavBarProps {
  /** Currently active tab. */
  active: NavTab;
  /** Fired when a tab is selected. */
  onNavigate: (tab: NavTab) => void;
  /** Unread matches count (badge on the Matches tab). */
  matchCount?: number;
  /** Unread messages count (badge on the Chat tab). */
  chatBadge?: number;
}

const TABS: ReadonlyArray<{
  id: NavTab;
  label: string;
  Icon: typeof Flame;
}> = [
  { id: "discover", label: "Discover", Icon: Flame },
  { id: "matches", label: "Matches", Icon: Heart },
  { id: "chat", label: "Chat", Icon: MessageCircle },
  { id: "profile", label: "Profile", Icon: User },
];

export default function NavBar({
  active,
  onNavigate,
  matchCount = 0,
  chatBadge = 0,
}: NavBarProps) {
  return (
    <nav
      className={cn(
        "sticky bottom-0 z-30 w-full border-t border-border bg-background/80 backdrop-blur-lg",
        "pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          const badge =
            id === "matches" ? matchCount : id === "chat" ? chatBadge : 0;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={isActive ? "page" : undefined}
                aria-label={`${label} tab${badge ? ` (${badge} new)` : ""}`}
                className={cn(
                  "relative flex w-full flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors",
                  isActive
                    ? "text-rose-500"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <motion.span
                    initial={false}
                    animate={isActive ? { scale: 1.15 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 360, damping: 18 }}
                    className="inline-flex"
                  >
                    <Icon
                      className="size-6"
                      fill={isActive && id !== "discover" ? "currentColor" : "none"}
                      strokeWidth={2.2}
                    />
                  </motion.span>
                  {badge > 0 ? (
                    <span
                      className="absolute -right-2 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white"
                      aria-hidden="true"
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                <span>{label}</span>

                {/* Active underline indicator */}
                {isActive ? (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute bottom-0 h-0.5 w-8 rounded-full bg-rose-500"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
