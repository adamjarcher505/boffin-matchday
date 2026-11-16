"use strict";
/* ============ pindaily.js (16/11/2026): Pin the Ground, the daily map game ============
   Five home grounds a day, same for everyone. Drop a pin where each club plays, drag it to adjust, lock it in.
   Untimed, one go a day, like Maptap. The map is built once and kept, so nothing flashes between grounds.
   Every ground is scored by distance, and the reveal zooms out to show how far off you were.
   Tiles: Esri World Imagery (no place names). Esri's terms don't allow bulk-downloading tiles, so nothing is bundled. */
const PN_GROUNDS = 5;
const PN_NEAR_KM = 1.5, PN_CLOSE_KM = 8; // 2 points within 1.5km, 1 point within 8km, else 0
const PN_XP = 2, PN_XP_CAP = 20;
const PN_UK = [53.6, -2.4], PN_UK_ZOOM = 6;
const PN_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const pnNo = () => Math.max(1, Math.round((new Date(dayKey() + "T12:00:00") - new Date("2026-11-16T12:00:00")) / 864e5) + 1);
const pnPts = d => (d <= PN_NEAR_KM ? 2 : d <= PN_CLOSE_KM ? 1 : 0);
const pnKm = d => (d < 1 ? Math.round(d * 1000) + " m" : d.toFixed(1) + " km");
function pnGrounds(day) {
  const out = [];
  for (let t = 0; out.length < PN_GROUNDS && t < 200; t++) {
    const i = pickR(GROUNDS.map((g, k) => k), rngOf(hash("pin" + day + "-" + t)));
    if (!out.includes(i)) out.push(i);
  }
  return out;
}
const pnState = () => {
  const k = dayKey();
  if (!S.pn || typeof S.pn !== "object") S.pn = {};
  if (!S.pn[k]) S.pn[k] = { k: 0, res: [], d: [], done: false, xp: 0 };
  return S.pn[k];
};
function gKm(a, b) {
  const R = 6371, t = x => (x * Math.PI) / 180;
  const dLa = t(b[0] - a[0]), dLn = t(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(t(a[0])) * Math.cos(t(b[0])) * Math.sin(dLn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const pnTotal = p => p.res.reduce((a, b) => a + b, 0);

/* the map and its layers live here while the screen is open */
let PNMAP = null, PNREV = null, PNTIMERS = [], PNPIN = null, PNMARK = null, PNLOCK = false;
const pnClear = () => {
  PNTIMERS.forEach(clearTimeout);
  PNTIMERS = [];
};
function pnUnmount() {
  pnClear();
  if (PNMAP) {
    try { PNMAP.remove(); } catch (e) {}
  }
  PNMAP = null;
  PNREV = null;
  PNPIN = null;
  PNMARK = null;
  PNLOCK = false;
}
const pnIcon = (kind, html) =>
  L.divIcon({ className: "pn-wrap " + kind, html: `<div class="pn-drop">${html}</div>`, iconSize: [34, 44], iconAnchor: [17, 42] });
const PN_PIN_SVG = '<svg viewBox="0 0 34 44" aria-hidden="true"><path d="M17 1C8 1 1.5 7.6 1.5 16c0 11.5 15.5 27 15.5 27s15.5-15.5 15.5-27C32.5 7.6 26 1 17 1z"/><circle cx="17" cy="16" r="6"/></svg>';

function pnTile() {
  const p = S.pn && S.pn[dayKey()],
    done = p && p.done;
  return `<button class="panel tile2 pnt" data-act="go" data-v="pin"><span class="eyebrow">Pin the Ground · No. ${pnNo()}</span><span class="sub">${
    done ? "Done for today. A new set of grounds at midnight." : "Five home grounds on the satellite. No clock, take your time."
  }</span><span class="more">${done ? "See it ›" : "Play ›"}</span><b class="big">${done ? pnTotal(p) + "/10" : "5"}</b></button>`;
}

function renderPin() {
  const p = pnState(),
    app = document.getElementById("app");
  app.classList.remove("focus", "q");
  if (!PNMAP || !document.getElementById("pnmap")) {
    pnUnmount();
    $("main").innerHTML = `<div class="pnb"><div class="pnhd"><div><h3>Pin the Ground</h3><span class="eyebrow">No. ${pnNo()} · same five grounds for everyone</span></div></div>
      <div id="pnmap" class="pnmap" aria-label="Satellite map with no place names"></div><div id="pnpanel" class="pnpanel"></div></div>`;
    if (typeof L === "undefined") {
      $("pnmap").innerHTML = '<p class="note">The map didn\'t load. Check your connection and try again.</p>';
    } else {
      PNMAP = L.map("pnmap", { minZoom: 3, maxZoom: 18, zoomControl: false, attributionControl: true, worldCopyJump: false, tap: false });
      L.control.zoom({ position: "bottomright" }).addTo(PNMAP);
      L.tileLayer(PN_TILES, { maxZoom: 18, attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics" }).addTo(PNMAP);
      PNMAP.setView(PN_UK, PN_UK_ZOOM);
      PNMAP.on("click", e => pnPlace(e.latlng));
    }
  }
  pnPanel();
  window.scrollTo(0, 0);
}

function pnPlace(ll) {
  const p = pnState();
  if (!PNMAP || p.done || PNLOCK || PNREV) return;
  PNPIN = [ll.lat, ll.lng];
  if (!PNMARK) {
    PNMARK = L.marker(PNPIN, { icon: pnIcon("pn-you", PN_PIN_SVG), draggable: true, keyboard: false }).addTo(PNMAP);
    PNMARK.on("dragend", () => {
      const q = PNMARK.getLatLng();
      PNPIN = [q.lat, q.lng];
    });
  } else {
    PNMARK.setLatLng(PNPIN);
    const el = PNMARK.getElement();
    if (el) {
      const d = el.querySelector(".pn-drop");
      if (d) {
        d.classList.remove("pn-pop");
        void d.offsetWidth;
        d.classList.add("pn-pop");
      }
    }
  }
  if (typeof buzz === "function") buzz(12);
  pnPanel();
}

function pnPanel() {
  const box = $("pnpanel");
  if (!box) return;
  const p = pnState(),
    days = pnGrounds(dayKey());
  if (p.done) {
    box.innerHTML = `<div class="pnsum"><span class="eyebrow">Today's result</span><div class="pnrow">${p.res.map(x => `<i class="${x === 2 ? "g" : x === 1 ? "y" : "r"}"></i>`).join("")}</div><b>${pnTotal(p)} of 10</b><p class="note">A new set of grounds lands at midnight.</p><div class="row"><button class="btn" data-act="pinshare">Copy result</button><a class="btn line" href="https://wa.me/?text=${encodeURIComponent(pnShare())}" target="_blank" rel="noopener">WhatsApp</a></div></div>`;
    return;
  }
  const gi = days[p.k],
    g = GROUNDS[gi];
  if (!g) return;
  const dots = days.map((_, k) => `<i class="${k < p.res.length ? (p.res[k] === 2 ? "g" : p.res[k] === 1 ? "y" : "r") : k === p.k ? "cur" : ""}"></i>`).join("");
  if (PNREV) {
    const last = p.res.length - 1;
    box.innerHTML = `<div class="pnrev"><div class="pnrow">${dots}</div><p class="pnv"><b>${esc(g.s)}</b> · ${pnKm(p.d[last])} off · <b>+${p.res[last]}</b></p><button class="btn" data-act="pinnext">${p.k + 1 >= PN_GROUNDS ? "See your result" : "Next ground"}</button></div>`;
    return;
  }
  box.innerHTML = `<div class="pnask"><div class="pnrow">${dots}</div><p class="ask">${esc(g.c)} home ground<span>${PNPIN ? "Drag the pin to adjust, then lock it in" : "Tap the map where they play"}</span></p><button class="btn" data-act="pinlock" ${PNPIN ? "" : "disabled"}>Lock it in</button></div>`;
}

function pnLock() {
  const p = pnState(),
    days = pnGrounds(dayKey()),
    g = GROUNDS[days[p.k]];
  if (!PNMAP || !PNPIN || !g || PNLOCK || PNREV || p.done) return;
  PNLOCK = true;
  const real = [g.la, g.ln],
    d = gKm(PNPIN, real),
    pts = pnPts(d);
  p.d.push(d);
  p.res.push(pts);
  save();
  PNREV = { real, d, pts };
  if (PNMARK) PNMARK.remove();
  PNMARK = null;
  if (pts) sfx.tick();
  else sfx.no();
  if (typeof buzz === "function") buzz(pts ? [20, 40, 20] : 60);
  PNMAP.dragging.disable();
  PNMAP.touchZoom.disable();
  PNMAP.scrollWheelZoom.disable();
  const youLL = PNPIN,
    layer = L.layerGroup().addTo(PNMAP);
  const real_m = L.marker(real, { icon: pnIcon("pn-real", PN_PIN_SVG), interactive: false }).addTo(layer);
  const youM = L.marker(youLL, { icon: pnIcon("pn-you", PN_PIN_SVG), interactive: false }).addTo(layer);
  const line = L.polyline([youLL, real], { className: "pn-line", color: "#ffffff", weight: 3, dashArray: "2 8", lineCap: "round" }).addTo(layer);
  PNREV.layer = layer;
  PNREV.youM = youM;
  PNREV.real_m = real_m;
  PNREV.line = line;
  // 1. zoom out to show both points
  PNMAP.flyToBounds(L.latLngBounds([youLL, real]).pad(0.35), { duration: 1.4, maxZoom: 14 });
  // 2. label the distance on the line
  PNTIMERS.push(setTimeout(() => {
    if (!PNMAP || !PNREV) return;
    const mid = [(youLL[0] + real[0]) / 2, (youLL[1] + real[1]) / 2];
    PNREV.bubble = L.marker(mid, {
      icon: L.divIcon({ className: "pn-bub-wrap", html: `<div class="pn-bub">${pnKm(d)} off · +${pts}</div>`, iconSize: null }),
      interactive: false
    }).addTo(layer);
  }, 1500));
  // 3. zoom in on the ground
  PNTIMERS.push(setTimeout(() => {
    if (!PNMAP || !PNREV) return;
    PNMAP.flyTo(real, 16, { duration: 1.4 });
  }, 2900));
  pnPanel();
}

function pnNext() {
  const p = pnState();
  if (!PNREV) return;
  pnClear();
  const days = pnGrounds(dayKey());
  if (PNREV.layer && PNMAP) PNMAP.removeLayer(PNREV.layer);
  PNREV = null;
  PNLOCK = false;
  PNPIN = null;
  if (PNMAP) {
    PNMAP.dragging.enable();
    PNMAP.touchZoom.enable();
    PNMAP.scrollWheelZoom.enable();
  }
  p.k++;
  if (p.k >= days.length) {
    p.done = true;
    p.xp = Math.min(PN_XP_CAP, pnTotal(p) * PN_XP);
    if (p.xp) addXp(p.xp);
    S.st.pin = Math.max(S.st.pin || 0, pnTotal(p));
    save(true);
    sfx.whistle();
    if (PNMAP) PNMAP.flyTo(PN_UK, PN_UK_ZOOM, { duration: 1 });
  } else if (PNMAP) {
    PNMAP.flyTo(PN_UK, PN_UK_ZOOM, { duration: 1 });
  }
  pnPanel();
}

function pnShare() {
  const p = pnState();
  const row = p.res.map(x => (x === 2 ? "🟩" : x === 1 ? "🟨" : "🟥")).join("");
  const kms = p.d.map(d => pnKm(d)).join(" · ");
  return `Pin the Ground No. ${pnNo()} ${row} ${pnTotal(p)}/10\n${kms}`;
}
