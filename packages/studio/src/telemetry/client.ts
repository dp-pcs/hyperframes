// ---------------------------------------------------------------------------
// Lightweight PostHog client for the studio browser bundle.
// Mirrors `packages/cli/src/telemetry/client.ts` but uses fetch/sendBeacon.
// All calls are fire-and-forget; telemetry must never break the studio UI.
// ---------------------------------------------------------------------------

import { getAnonymousId, hasShownNotice, isOptedOut, markNoticeShown } from "./config";
import { getBrowserSystemMeta } from "./system";

// HeyGen's PostHog project key — write-only, safe to embed in client code.
// OSS builds can override via `VITE_HYPERFRAMES_POSTHOG_KEY` at build time,
// or set it to an empty string to disable telemetry entirely.
const POSTHOG_API_KEY =
  (import.meta.env.VITE_HYPERFRAMES_POSTHOG_KEY as string | undefined) ??
  "phc_zjjbX0PnWxERXrMHhkEJWj9A9BhGVLRReICgsfTMmpx";
const POSTHOG_HOST =
  (import.meta.env.VITE_HYPERFRAMES_POSTHOG_HOST as string | undefined) ??
  "https://us.i.posthog.com";
const FLUSH_INTERVAL_MS = 1_000;

type EventProperties = Record<string, string | number | boolean | undefined>;

interface QueuedEvent {
  event: string;
  properties: EventProperties;
  timestamp: string;
}

let eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let telemetryEnabled: boolean | null = null;

function isDoNotTrackOn(): boolean {
  return typeof navigator !== "undefined" && navigator.doNotTrack === "1";
}

function isApiKeyConfigured(): boolean {
  return POSTHOG_API_KEY.startsWith("phc_");
}

function shouldTrack(): boolean {
  if (telemetryEnabled !== null) return telemetryEnabled;
  telemetryEnabled = isApiKeyConfigured() && !isOptedOut() && !isDoNotTrackOn();
  return telemetryEnabled;
}

export function trackEvent(event: string, properties: EventProperties = {}): void {
  if (!shouldTrack()) return;

  const sys = getBrowserSystemMeta();
  eventQueue.push({
    event,
    properties: { ...properties, ...sys },
    timestamp: new Date().toISOString(),
  });

  if (flushTimer === null) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, FLUSH_INTERVAL_MS);
  }
  showNoticeOnce();
}

function flush(): void {
  if (eventQueue.length === 0) return;
  const distinctId = getAnonymousId();
  const batch = eventQueue.map((e) => ({
    event: e.event,
    // $ip: null tells PostHog to not record the request IP.
    properties: { ...e.properties, $ip: null },
    distinct_id: distinctId,
    timestamp: e.timestamp,
  }));
  eventQueue = [];
  send(`${POSTHOG_HOST}/batch/`, JSON.stringify({ api_key: POSTHOG_API_KEY, batch }));
}

function send(url: string, payload: string): void {
  // Prefer fetch with keepalive (survives page navigation). sendBeacon is a
  // fallback for older runtimes where fetch isn't available.
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* silent */
    });
    return;
  } catch {
    /* fall through */
  }
  try {
    navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
  } catch {
    /* silent */
  }
}

function showNoticeOnce(): void {
  if (hasShownNotice()) return;
  markNoticeShown();
  // eslint-disable-next-line no-console
  console.info(
    "%c[HyperFrames]%c Anonymous studio usage analytics enabled. " +
      "Disable: localStorage.setItem('hyperframes-studio:telemetryDisabled','1') (then reload).",
    "color:#7c3aed;font-weight:bold",
    "color:inherit",
  );
}

// Flush queued events when the tab is being hidden or closed so tail events
// (e.g. a render_start fired moments before the user navigates away) aren't lost.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flush(), { capture: true });
  window.addEventListener("visibilitychange", () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") flush();
  });
}
