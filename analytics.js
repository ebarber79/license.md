/* =========================================================================
 * Neon Dash — lightweight, pluggable telemetry (H1 error logging + H2 events)
 *
 * No vendor lock-in and offline-safe by design:
 *  - If window.NEONDASH_ANALYTICS_URL is set, events are sent via sendBeacon.
 *  - Otherwise events are buffered in-memory (window.NeonAnalytics._buffer)
 *    and, with ?debug=1, echoed to the console — enough for QA case ND-AN-*.
 *  - Captures uncaught errors + unhandled promise rejections (ND-AN-05).
 *
 * ND-034: the Android app sends events to DEFAULT_ENDPOINT (Cloudflare relay,
 * pulled every 5 min into the VPS db /root/neondash-events). The web build never sends anything.
 * No persistent ID: the session id is random per app launch, kept in memory.
 * Override for tests: window.NEONDASH_ANALYTICS_URL / window.NEONDASH_BUILD.
 *
 * NOTE: the page ships a strict CSP with `connect-src 'self'`. If you point
 * NEONDASH_ANALYTICS_URL at a cross-origin collector, add that origin to the
 * `connect-src` directive in index.html (or proxy beacons through a
 * same-origin endpoint), otherwise the browser will block sendBeacon().
 * ========================================================================= */

(function (global) {
  "use strict";

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Bump with every release (matches android versionCode / versionName).
  var APP_BUILD = "7 (1.6)";
  var DEFAULT_ENDPOINT = "https://neondash-events.onboardingaudit.workers.dev/nd/e";

  function isNative() {
    try {
      return !!(global.Capacitor && global.Capacitor.isNativePlatform &&
        global.Capacitor.isNativePlatform());
    } catch (e) { return false; }
  }

  var sessionId = genId();
  var native = isNative();
  var platform = native ? "android" : "web";
  var buildVersion = global.NEONDASH_BUILD || APP_BUILD;
  var endpoint = global.NEONDASH_ANALYTICS_URL || (native ? DEFAULT_ENDPOINT : null);
  var debug = /[?&]debug=1/.test(global.location ? global.location.search : "");
  var buffer = [];
  var MAX_BUFFER = 200;

  function emit(payload) {
    payload.session = sessionId;
    payload.build = buildVersion;
    payload.platform = platform;
    payload.t = Date.now();
    if (endpoint && global.navigator && global.navigator.sendBeacon) {
      try {
        global.navigator.sendBeacon(endpoint, JSON.stringify(payload));
      } catch (e) { /* fall through to buffer */ }
    }
    buffer.push(payload);
    if (buffer.length > MAX_BUFFER) buffer.shift();
    if (debug && global.console) {
      global.console.log("[analytics]", payload.event, payload);
    }
  }

  function track(event, props) {
    emit({ event: event, props: props || {} });
  }

  function trackError(kind, message, stack, extra) {
    emit({
      event: "error",
      kind: kind,
      message: String(message == null ? "" : message),
      stack: String(stack == null ? "" : stack).slice(0, 1500),
      extra: extra || {},
    });
  }

  if (global.addEventListener) {
    global.addEventListener("error", function (e) {
      trackError("onerror", e.message, e.error && e.error.stack, {
        src: e.filename, line: e.lineno, col: e.colno,
      });
    });
    global.addEventListener("unhandledrejection", function (e) {
      var r = e.reason;
      trackError("unhandledrejection", r && r.message ? r.message : r, r && r.stack);
    });
  }

  global.NeonAnalytics = {
    track: track,
    trackError: trackError,
    sessionId: sessionId,
    platform: platform,
    endpoint: endpoint,
    _buffer: buffer, // exposed for QA harness / ND-AN-* verification
  };
  track("app_open", {});
})(window);
