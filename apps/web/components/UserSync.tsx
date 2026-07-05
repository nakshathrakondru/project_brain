"use client";

/**
 * Syncs the Clerk-authenticated user into the app's own database.
 * Must be rendered inside <ClerkProvider> after the user is signed in.
 * Calls POST /api/v1/auth/me once per session.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

export default function UserSync() {
  const { isSignedIn, getToken } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (!isSignedIn || synced.current) return;

    const sync = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/me`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        synced.current = true;
      } catch (err) {
        console.error("UserSync failed:", err);
      }
    };

    sync();
  }, [isSignedIn, getToken]);

  return null;
}
