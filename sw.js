// Offline support. The game shell and its football data are cached on first visit, so the app
// opens and plays with no signal. Files are served from cache straight away and refreshed in the
// background, so a new version shows up the launch after it's deployed.
// Bump VERSION when you change the list below.
const VERSION = "boffin-v1";
const SHELL = [
  "./", "index.html", "app.js", "data.js", "config.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"
];
// Third-party files worth keeping offline: fonts and the Supabase client library.
const RUNTIME = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)\//;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url), same = url.origin === location.origin;
  if (!same && !RUNTIME.test(req.url)) return;          // Supabase API calls etc. go straight to the network
  e.respondWith(caches.open(VERSION).then(async cache => {
    // the page itself: ignore ?query (e.g. sign-in return links) so it still opens offline
    const key = same && req.mode === "navigate" ? "index.html" : req;
    const hit = await cache.match(key, { ignoreSearch: same });
    // our own files: always check with the server (skip the browser's HTTP cache) so updates land
    const net = (same ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req)).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response("Offline", { status: 503, statusText: "Offline" });
  }));
});
