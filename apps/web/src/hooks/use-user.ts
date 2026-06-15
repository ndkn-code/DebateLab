"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import {
  resetPracticeClientStateForAuthChange,
  shouldResetPracticeClientStateOnAuthChange,
} from "@/lib/practice-client-state";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

interface UseUserReturn {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastAuthUserIdRef = useRef<string | null | undefined>(undefined);

  const supabase = createClient();

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (data) {
        setProfile(data as Profile);
        if (typeof window !== "undefined") {
          posthog.identify(userId, {
            display_name: data.display_name,
            role: data.role,
          });
        }
      }
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      lastAuthUserIdRef.current = authUser?.id ?? null;
      setUser(authUser);

      if (authUser) {
        await fetchProfile(authUser.id);
      }

      setIsLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      const nextUserId = currentUser?.id ?? null;
      if (
        shouldResetPracticeClientStateOnAuthChange(
          lastAuthUserIdRef.current,
          nextUserId
        )
      ) {
        resetPracticeClientStateForAuthChange();
      }
      lastAuthUserIdRef.current = nextUserId;
      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }

      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    posthog.reset();
    resetPracticeClientStateForAuthChange();
    lastAuthUserIdRef.current = null;
    setUser(null);
    setProfile(null);
  }, [supabase]);

  return {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    signOut,
    refreshProfile,
  };
}
