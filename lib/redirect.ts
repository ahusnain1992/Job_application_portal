import { NextResponse } from "next/server";

/**
 * Returns a 303 See Other redirect with no-cache headers.
 * Using relative Location values so the response works correctly behind
 * Railway's HTTPS proxy without needing APP_URL configured.
 * Cache-Control: no-store prevents browsers from caching stale auth redirects
 * (which caused localhost:8080 redirect loops in earlier deploys).
 */
export function redirectTo(location: string, status = 303) {
  return new NextResponse(null, {
    status,
    headers: {
      Location: location,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache"
    }
  });
}
