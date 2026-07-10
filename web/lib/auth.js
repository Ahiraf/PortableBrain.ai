/*
 * Lightweight API protection.
 *
 * - checkAuth: when PB_TOKEN is set, requests must either be same-origin (the
 *   dashboard — identified by Sec-Fetch-Site) or present the token as a bearer.
 *   The extension sends the token; random websites can't. If PB_TOKEN is unset
 *   the API is open (dev default) so the app still runs with zero config.
 * - rateLimit: a simple in-process limiter so the paid extraction endpoint
 *   can't be hammered into burning your API credits.
 */
import crypto from "crypto";

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Returns a Response to short-circuit with (401) or null when the request is allowed.
export function checkAuth(req) {
  const token = process.env.PB_TOKEN;
  if (!token) return null; // auth disabled

  // The dashboard's own fetches are same-origin — trust them.
  if (req.headers.get("sec-fetch-site") === "same-origin") return null;

  const header = req.headers.get("authorization") || "";
  const provided = header.replace(/^Bearer\s+/i, "") || req.headers.get("x-pb-token") || "";
  if (provided && timingSafeEqual(provided, token)) return null;

  return Response.json({ error: "unauthorized" }, { status: 401 });
}

const buckets = new Map();

// Returns a Response (429) when the caller has exceeded `max` hits per `windowMs`,
// otherwise null.
export function rateLimit(key, max = 20, windowMs = 60000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return null;
  }
  b.count += 1;
  if (b.count > max) {
    return Response.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }
  return null;
}
