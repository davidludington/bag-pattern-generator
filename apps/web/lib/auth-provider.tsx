"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createSupabaseProjectStore,
  localProjectStore,
  uploadLocalProjects,
  type ProjectStore,
} from "./projects";
import { createSupabaseBrowserClient } from "./supabase/client";

interface Auth {
  /** False until we know whether someone is signed in (and local work is uploaded). */
  ready: boolean;
  email: string | null;
  /** False when Supabase is not configured: sign-in is unavailable. */
  canSignIn: boolean;
  store: ProjectStore;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside <AuthProvider>");
  return auth;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client] = useState<SupabaseClient | null>(createSupabaseBrowserClient);
  const [session, setSession] = useState<{
    ready: boolean;
    userId: string | null;
    email: string | null;
  }>({
    ready: !client,
    userId: null,
    email: null,
  });

  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const apply = async (user: { id: string; email?: string } | null) => {
      // Token refreshes fire this too; only a different user changes anything.
      if (lastUserId.current === (user?.id ?? null)) return;
      lastUserId.current = user?.id ?? null;
      if (user) {
        try {
          await uploadLocalProjects(localProjectStore, createSupabaseProjectStore(client));
        } catch (error) {
          // Local copies stay put; the next sign-in retries.
          console.error("Could not upload local projects", error);
        }
      }
      if (active) setSession({ ready: true, userId: user?.id ?? null, email: user?.email ?? null });
    };
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      // Defer: supabase-js forbids awaiting other auth calls inside this callback.
      setTimeout(() => void apply(next?.user ?? null), 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<Auth>(
    () => ({
      ready: session.ready,
      email: session.email,
      canSignIn: client !== null,
      store: client && session.userId ? createSupabaseProjectStore(client) : localProjectStore,
      signIn: async () => {
        await client?.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
      },
      signOut: async () => {
        await client?.auth.signOut();
      },
    }),
    [client, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
