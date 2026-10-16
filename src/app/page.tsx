"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useDatingStore } from "@/lib/dating-store";
import NavBar from "@/components/dating/NavBar";
import DiscoverPage from "@/components/dating/DiscoverPage";
import MatchesPage from "@/components/dating/MatchesPage";
import ChatPage from "@/components/dating/ChatPage";
import ProfilePage from "@/components/dating/ProfilePage";
import MatchModal, { type MatchPayload } from "@/components/dating/MatchModal";
import type { DatingProfile, UserPreferences } from "@/lib/matching";
import { getCurrentUser, getDefaultPreferences } from "@/lib/matching";
import { Heart } from "lucide-react";

export default function Home(): ReactNode {
  const {
    currentUser,
    activeTab,
    lastMatch,
    matches,
    setActiveTab,
    clearLastMatch,
    loadRecommendations,
    loadMatches,
  } = useDatingStore();

  const [chatProfile, setChatProfile] = useState<DatingProfile | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>(getDefaultPreferences());

  useEffect(() => {
    loadRecommendations();
    loadMatches();
  }, [loadRecommendations, loadMatches]);

  const userId = currentUser?.id ?? "me";
  const user = currentUser ?? getCurrentUser();

  const matchPayload: MatchPayload | null = lastMatch
    ? { matchId: `match-${lastMatch.id}-${Date.now()}`, profile: lastMatch }
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-rose-50 via-white to-white">
      {/* Brand header */}
      <header className="sticky top-0 z-20 flex items-center justify-center border-b border-rose-100 bg-white/80 px-4 py-3 backdrop-blur-md">
        <span className="flex items-center gap-2">
          <Heart className="h-5 w-5 fill-rose-500 text-rose-500" />
          <h1 className="bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-xl font-bold text-transparent">
            Milan
          </h1>
        </span>
      </header>

      {/* Content area */}
      <main className="mx-auto w-full max-w-md flex-1 overflow-hidden">
        {activeTab === "discover" && (
          <DiscoverPage
            userId={userId}
            onOpenProfile={() => {}}
            onOpenFilters={() => {}}
            onMatch={(_match: MatchPayload) => {
              /* store.swipe() already set lastMatch → MatchModal watches it */
            }}
          />
        )}

        {activeTab === "matches" && (
          <MatchesPage
            userId={userId}
            onOpenChat={(_matchId: string, profile: DatingProfile) => {
              setChatProfile(profile);
              setActiveTab("chat");
            }}
            onStartSwiping={() => setActiveTab("discover")}
          />
        )}

        {activeTab === "chat" &&
          (chatProfile ? (
            <ChatPage profile={chatProfile} onBack={() => setActiveTab("matches")} />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
              Select a match to start chatting
            </div>
          ))}

        {activeTab === "profile" && (
          <ProfilePage
            user={user}
            preferences={prefs}
            onSave={(newPrefs: UserPreferences) => setPrefs(newPrefs)}
            onLogout={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("milan-dating-store-v1");
                window.location.reload();
              }
            }}
          />
        )}
      </main>

      {/* Match celebration modal */}
      <MatchModal
        match={matchPayload}
        userPhoto={user.photo ?? ""}
        onSendMessage={() => {
          clearLastMatch();
          if (lastMatch) {
            setChatProfile(lastMatch);
            setActiveTab("chat");
          }
        }}
        onKeepSwiping={clearLastMatch}
      />

      {/* Bottom navigation */}
      <NavBar
        active={activeTab}
        onNavigate={setActiveTab}
        matchCount={matches.length}
      />
    </div>
  );
}
