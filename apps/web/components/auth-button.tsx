"use client";

import { useAuth } from "@/lib/auth-provider";
import { Button } from "./ui/button";

export function AuthButton() {
  const { ready, email, canSignIn, signIn, signOut } = useAuth();
  if (!ready || !canSignIn) return null;
  return email ? (
    <div className="flex items-center gap-2 text-xs text-stone-500">
      <span data-testid="user-email">{email}</span>
      <Button size="sm" variant="ghost" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  ) : (
    <Button size="sm" variant="outline" onClick={() => void signIn()} data-testid="sign-in">
      Sign in with Google
    </Button>
  );
}
