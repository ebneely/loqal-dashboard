"use client";

/**
 * `/` is a signpost, never a screen.
 *
 * It was a scaffold placeholder, which meant a signed-in user landed on
 * marketing copy and had to know a route by heart to reach their own console.
 * Now it reads the session and sends each role to its own home.
 *
 * Client-side on purpose. `middleware.ts` deliberately asks only whether a
 * session cookie exists and refuses to decode it, so that authorization lives
 * in exactly one place — the Nest RolesGuard — instead of being re-decided by a
 * second policy that drifts. Keeping the role read here preserves that: this
 * file points the browser somewhere, it does not decide what anyone may see.
 *
 * `replace`, not `push`: nobody should be able to press Back into a signpost.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { homeFor } from "./(auth)/auth-rules";
import { useSession } from "@/lib/auth-client";

export default function Home() {
  const router = useRouter();
  const { data, isPending } = useSession();

  useEffect(() => {
    if (isPending) return;

    if (!data?.user) {
      router.replace("/sign-in");
      return;
    }

    // A user whose password was set for them by an admin has a session but no
    // password they chose, so they are sent to change it before anything else.
    if (data.user.mustChangePassword) {
      router.replace("/set-password");
      return;
    }

    router.replace(homeFor(data.user.role));
  }, [data, isPending, router]);

  /**
   * Renders nothing rather than a spinner or a heading. This is on screen for
   * one paint, and a title that flashes and vanishes reads as a glitch — worse,
   * a "Loqal Dashboard" splash tells someone who is not signed in that they
   * reached something real.
   */
  return null;
}
