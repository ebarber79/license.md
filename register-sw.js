/* Service worker registration (external file so a strict CSP can use
 * script-src 'self' without allowing inline scripts). */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
