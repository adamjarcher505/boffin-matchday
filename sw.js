// Offline support. The whole game (shell + football data) is cached when this worker installs, so the app
// opens and plays with no signal.
//
// Updating: the game's own files are served from this version's cache only. A new version reaches players
// when VERSION below changes: the new worker downloads everything fresh, then waits, and the game shows a
// "New version ready, tap to refresh" toast (or it takes over the next time the app is opened from cold).
//
//   >>> Run `node tools/bump-sw.js` before every deploy. It sets VERSION from the contents of the shipped
//   >>> files and checks the list below is complete. (tests/unit/sw.test.js fails if you forget.)
const VERSION = "boffin-f9e04b597a";
const SHELL = [
  "./", "index.html", "config.js", "data.js", "grounds.js", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "questions.js", "sticker-pages.js", "kits.js", "src/styles.css", "src/core.js", "src/state.js", "src/fx.js", "src/career.js", "src/league.js", "src/generators.js", "src/rounds.js", "src/rounds-more.js", "src/dbx.js", "src/match.js", "src/grid.js", "src/chain.js", "src/screens.js", "src/events.js", "src/extras.js", "src/stickers.js", "src/stickers2.js", "src/progress.js", "src/net.js", "src/boot.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"
];
// Third-party files worth keeping offline: fonts and the Supabase client library (refreshed in the background).
const RUNTIME = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)\//;

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's HTTP cache so a new version always gets fresh files
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))));
});

self.addEventListener("message", e => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url), same = url.origin === location.origin;
  if (!same && !RUNTIME.test(req.url)) return;          // Supabase API calls etc. go straight to the network
  if (same && url.pathname.includes("/data/x/")) {
    // 1X2 database chunks (loaded on demand, see src/dbx.js). The manifest asks the network first so a fresh build is seen; the chunks are
    // named by content hash, so once cached they're good forever and play offline.
    const isManifest = url.pathname.endsWith("manifest.json");
    e.respondWith(caches.open(VERSION).then(async cache => {
      const hit = await cache.match(req);
      if (hit && !isManifest) return hit;
      try { const res = await fetch(req); if (res && res.ok) cache.put(req, res.clone()); return res; }
      catch (err) { return hit || new Response("Offline", { status: 503, statusText: "Offline" }); }
    }));
    return;
  }
  e.respondWith(caches.open(VERSION).then(async cache => {
    if (same) {
      // the page itself: ignore ?query (sign-in return links, ?preview=) so it still opens offline
      const hit = await cache.match(req.mode === "navigate" ? "index.html" : req, { ignoreSearch: true });
      if (hit) return hit;
      try { return await fetch(req); } catch (err) { return new Response("Offline", { status: 503, statusText: "Offline" }); }
    }
    const hit = await cache.match(req);
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response("Offline", { status: 503, statusText: "Offline" });
  }));
});
