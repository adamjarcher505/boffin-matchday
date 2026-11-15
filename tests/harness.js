// Loads the real game scripts (in index.html order) into a Node vm with a stub DOM,
// so tests can call the game's own functions. Dev-only: nothing in tests/ ships.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");

function dummyEl() {
  const store = { innerHTML: "", value: "", textContent: "", className: "", hidden: false, isConnected: false, style: {}, dataset: {}, children: [],
    classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } } };
  const el = new Proxy(function () { }, {
    get(t, k) {
      if (k in store) return store[k];
      if (k === "querySelector" || k === "closest") return () => null;
      if (k === "querySelectorAll") return () => [];
      if (k === "getBoundingClientRect") return () => ({ left: 0, top: 0, width: 0, height: 0 });
      if (k === Symbol.toPrimitive) return () => "";
      return () => undefined;       // addEventListener, focus, blur, remove, appendChild, scrollTo...
    },
    set(t, k, v) { store[k] = v; return true; }
  });
  return el;
}

function load(opts = {}) {
  const els = {}, ls = Object.assign({}, opts.localStorage || {});
  const listeners = {};
  const sandbox = {
    console, setTimeout: opts.realTimers ? setTimeout : () => 0, clearTimeout: () => { }, setInterval: () => 0, clearInterval: () => { },
    URLSearchParams, URL, Date, Math, JSON, Promise,
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => { },
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
    location: { hostname: opts.hostname || "localhost", search: opts.search || "", origin: "http://localhost:8080", pathname: "/", protocol: "http:", href: "http://localhost:8080/", reload() { } },
    navigator: { onLine: true, userAgent: "node-test" },
    document: { getElementById: id => els[id] || (els[id] = dummyEl()), createElement: () => dummyEl(), addEventListener() { }, querySelector: () => null, querySelectorAll: () => [], head: dummyEl(), body: dummyEl(), documentElement: dummyEl(), activeElement: null, visibilityState: "visible" },
    addEventListener(k, f) { (listeners[k] = listeners[k] || []).push(f); }, removeEventListener() { },
    matchMedia: () => ({ matches: !!opts.wide, addEventListener() { } }),
    scrollTo() { }, innerWidth: opts.wide ? 1280 : 390, innerHeight: 844
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  if (opts.config) sandbox.BOFFIN_CONFIG = opts.config;
  Object.assign(sandbox, opts.globals || {});
  const ctx = vm.createContext(sandbox);
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  for (const s of scripts) {
    if (s === "config.js" && opts.config) continue;
    if (opts.stopBefore && s === opts.stopBefore) break;
    if ((opts.skip || []).includes(s) || s.startsWith("vendor/") || !fs.existsSync(path.join(ROOT, s))) continue; // third-party map library: not needed headless
    vm.runInContext(fs.readFileSync(path.join(ROOT, s), "utf8"), ctx, { filename: s });
  }
  return { ctx, scripts, els, storage: ls, run: code => vm.runInContext(code, ctx), listeners };
}
module.exports = { load, ROOT };
