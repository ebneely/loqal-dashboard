"use client";

import { useEffect } from "react";

/**
 * Strips credential fields out of the current URL and out of the history entry
 * that holds it.
 *
 * A belt to `method="post"`'s braces. POST stops a native submit from ever
 * writing a password to the address bar, but it does nothing about a URL that
 * already carries one — a bookmark, a pasted link, a history entry from before
 * the form was fixed. Left alone that value is read back on every reload and is
 * sent onward in the Referer header of the next request.
 *
 * `replaceState`, not `push`: the goal is that the entry containing the
 * password stops existing, not that a clean one is stacked on top of it.
 */
const CREDENTIAL_PARAMS = [
  "password",
  "currentPassword",
  "newPassword",
  "repeatPassword",
  "email",
];

export function useScrubCredentials() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const present = CREDENTIAL_PARAMS.filter((key) => url.searchParams.has(key));
    if (present.length === 0) return;

    for (const key of present) url.searchParams.delete(key);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
}
