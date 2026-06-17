/* =========================================================================
 * Neon Dash — lightweight, pluggable telemetry (H1 error logging + H2 events)
 *
 * No vendor lock-in and offline-safe by design:
 *  - If window.NEONDASH_ANALYTICS_URL is set, events are sent via sendBeacon.
 *  - Otherwise events are buffered in-memory (window.NeonAnalytics._buffer)
 *    and, with ?debug=1, echoed to the console — enough for QA case ND-AN-*.
 *  - Captures uncaught errors + unhandled promise rejections (ND-AN-05).
 *
 * To wire a real sink later, set before this script loads:
 *   window.NEONDASH_ANALYTICS_URL = "https://your-collector/ingest";
 *   window.NEONDASH_BUILD = "2026-06-17.1";
 * ========================================================================= */

(function (global) {
  "use strict";

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  var sessionId = genId();
  var buildVersion = global.NEONDASH_BUILD || "dev";
  var endpoint = global.NEONDASH_ANALYTICS_URL || null;
  var debug = /[?&]debug=1/.test(global.location ? global.location.search : "");
  var buffer = [];
  var MAX_BUFFER = 200;

  function emit(payload) {
    payload.session = sessionId;
    payload.build = buildVersion;
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
      stack: String(stack == null ? "" : stack),
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
    _buffer: buffer, // exposed for QA harness / ND-AN-* verification
  };
})(window);
