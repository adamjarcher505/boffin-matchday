"use strict";
/* ============ pinday.js (18/11/2026): Pin of the Day ============
   Five home grounds, the same five for everyone each day, one go. Drop a pin on each; scored like Pin the Ground
   (2 points inside TUNING.pinNear km, 1 inside TUNING.pinFar km). No clock. Uses the map from Pin the Ground and falls back
   to "pick the ground's name" with no signal (pinNoMap, pinOptions in rounds-more.js).
   Which five: one fixed shuffle of every ground, five along it per day, wrapping round. With 91 grounds that's 18 days
   before any ground comes back (91 / 5), the most any five-a-day scheme can promise. */
const PIN_N = 5;
const PIN_EPOCH = "2026-11-18T12:00:00";
const pinDayIdx = (day = dayKey()) => Math.round((new Date(day + "T12:00:00") - new Date(PIN_EPOCH)) / 864e5);
const pinDayNo = () => Math.max(1, pinDayIdx() + 1);
let PIN_ORDER = null;
function pinDayGrounds(day = dayKey()) {
  if (!PIN_ORDER) PIN_ORDER = shuffle(GROUNDS.map((g, i) => i), rngOf(hash("pinday-order")));
  const n = PIN_ORDER.length,
    start = (((pinDayIdx(day) * PIN_N) % n) + n) % n;
  return Array.from({ length: PIN_N }, (_, k) => PIN_ORDER[(start + k) % n]);
}
/* S.pd = { "yyyy-mm-dd": { res: [points per ground], km: [km or null], done, xp } }: the ground you're on is res.length */
const pdState = () => {
  const k = dayKey();
  if (!S.pd || !S.pd[k]) S.pd = { [k]: { res: [], km: [], done: false, xp: 0 } };
  return S.pd[k];
};
const pdPts = p => p.res.reduce((a, b) => a + b, 0);
const kmTxt = d => (d < 1 ? Math.round(d * 1000) + " m" : d.toFixed(1) + " km");
let PD = { go: false, pin: null, shown: false, say: "", map: null, marker: null, view: null, mc: false, t0: 0 };
const pdZoomOk = () => !PD.map || PD.map.getZoom() >= TUNING.pinZoom || Date.now() - PD.t0 >= TUNING.pinZoomWait * 1000;
function pdSync() {
  const b = document.querySelector('[data-act="pdlock"]'),
    h = document.getElementById("pinhint");
  if (b) b.disabled = !(PD.pin && pdZoomOk());
  if (h) h.hidden = pdZoomOk();
}
function pdMount(g) {
  const el = document.getElementById("pinmap");
  if (!el || typeof L === "undefined") return;
  if (PD.map) {
    try { PD.map.remove(); } catch (e) {}
    PD.map = null;
  }
  const map = L.map(el, { minZoom: 3, maxZoom: 19, zoomControl: true, attributionControl: true, worldCopyJump: false }),
    dot = (ll, col, r) => L.circleMarker(ll, { radius: r, color: col, weight: 3, fillColor: col, fillOpacity: 0.9 }).addTo(map),
    tiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics"
    }).addTo(map);
  let bad = 0,
    good = 0;
  tiles.on("tileload", () => good++);
  tiles.on("tileerror", () => {
    bad++;
    if (bad >= 4 && !good && !PD.mc && !PD.shown) {
      PD.mc = true; // the pictures won't come: names for the rest of the day
      try { map.remove(); } catch (e) {}
      PD.map = null;
      pdPaint();
    }
  });
  if (PD.view) map.setView(PD.view.c, PD.view.z);
  else map.setView([53.6, -2.4], 6);
  map.on("moveend", () => {
    PD.view = { c: map.getCenter(), z: map.getZoom() };
    pdSync();
  });
  if (!PD.shown) {
    if (PD.pin) PD.marker = dot(PD.pin, "#ffb000", 8);
    map.on("click", e => {
      PD.pin = [e.latlng.lat, e.latlng.lng];
      if (PD.marker) PD.marker.remove();
      PD.marker = dot(PD.pin, "#ffb000", 8);
      pdSync();
    });
    setTimeout(pdSync, Math.max(0, TUNING.pinZoomWait * 1000 - (Date.now() - PD.t0)) + 60);
  } else {
    const real = [g.la, g.ln];
    dot(real, "#2ecc71", 9);
    if (PD.pin) {
      dot(PD.pin, "#ffb000", 8);
      L.polyline([PD.pin, real], { color: "#ffffff", weight: 2, dashArray: "6 6" }).addTo(map);
    }
    map.setView(real, Math.max(map.getZoom(), 13));
  }
  PD.map = map;
  setTimeout(() => map.invalidateSize(), 0);
}
/* the live screen: pips, the club, the map (or four names), then the reveal */
function pdPaint() {
  if (view !== "pinday") return;
  const p = pdState(),
    gs = pinDayGrounds(),
    k = PD.shown ? p.res.length - 1 : p.res.length,
    g = GROUNDS[gs[k]],
    mc = PD.mc || pinNoMap(),
    pips = `<div class="pips">${gs.map((x, j) => `<i class="${j < p.res.length ? (p.res[j] === 2 ? "ok" : p.res[j] === 1 ? "half" : "no") : ""}"></i>`).join("")}</div>`,
    r = p.res[k];
  let body;
  if (mc) {
    const o = pinOptions({ qs: gs }, k);
    body = `<p class="ask">${esc(g.c)} home ground<span>No signal for the map, so it's names today</span></p><div class="quad sm">${o.map((x, j) => `<button class="tc ${PD.shown ? (GROUNDS[x].s === g.s ? "right" : PD.pick === j ? "wrong" : "") : ""}" data-act="pdopt" data-v="${j}"><b>${esc(GROUNDS[x].s)}</b></button>`).join("")}</div>${PD.shown ? `<p class="exv ${r ? "right" : "wrong"}">${esc(g.s)} · ${r ? "2 points" : "0 points"}</p>` : ""}`;
  } else {
    const d = PD.shown ? p.km[k] : null;
    body = `<p class="ask">${esc(g.c)} home ground<span>${PD.shown ? esc(PD.say) : "Tap the map to drop your pin"}</span></p><div class="pinbox"><div id="pinmap" class="pinmap" aria-label="Satellite map, no labels"></div>${PD.shown ? "" : `<span class="pinhint" id="pinhint">Zoom in to drop it accurately</span>`}</div>${
      PD.shown ? `<p class="exv ${r === 2 ? "right" : r === 1 ? "half" : "wrong"}">${esc(g.s)} · ${d === null ? "" : kmTxt(d) + " away · "}${r === 2 ? "2 points" : r === 1 ? "1 point" : "0 points"}</p>` : `<button class="btn" data-act="pdlock" disabled>Lock it in</button>`
    }`;
  }
  $("main").innerHTML = `<div class="hd"><h2>Pin of the Day No. ${pinDayNo()}</h2><span class="eyebrow">${Math.min(p.res.length + (PD.shown ? 0 : 1), PIN_N)} of ${PIN_N}</span></div>${pips}${body}`;
  if (!mc) pdMount(g);
}
function pdRecord(km, pts) {
  const p = pdState();
  p.res.push(pts);
  p.km.push(km === null ? null : Math.round(km * 100) / 100);
  PD.shown = true;
  PD.say = km === null ? "" : pickR(TALK.pin.find(x => km <= x[0])[1], Math.random);
  if (pts) sfx.tick();
  else sfx.no();
  save();
  pdPaint();
  setTimeout(pdNext, km === null ? 1800 : 2600);
}
function pdNext() {
  if (!PD.shown) return;
  PD.shown = false;
  PD.pin = null;
  PD.view = null;
  PD.pick = -1;
  PD.t0 = Date.now();
  if (PD.map) try { PD.map.remove(); } catch (e) {}
  PD.map = null;
  if (pdState().res.length >= PIN_N) pdFinish();
  else pdPaint();
}
function pdLock() {
  const p = pdState();
  if (PD.shown || !PD.pin || p.done || p.res.length >= PIN_N) return;
  const g = GROUNDS[pinDayGrounds()[p.res.length]],
    d = gKm(PD.pin, [g.la, g.ln]);
  pdRecord(d, pinPoints(d));
}
function pdOption(j) {
  const p = pdState(),
    k = p.res.length;
  if (PD.shown || p.done || k >= PIN_N) return;
  const gs = pinDayGrounds(),
    o = pinOptions({ qs: gs }, k);
  if (!(j >= 0 && j < o.length)) return;
  PD.pick = j;
  pdRecord(null, GROUNDS[o[j]].s === GROUNDS[gs[k]].s ? 2 : 0);
}
function pdFinish() {
  const p = pdState();
  if (p.done) return renderPinDay();
  p.done = true;
  p.xp = TUNING.pinDayBase + TUNING.pinDayXp * pdPts(p);
  addXp(p.xp);
  S.st.pins = (S.st.pins || 0) + 1;
  sfx.whistle();
  careerPinDay();
  save(true);
  renderPinDay();
}
function pdGo() {
  PD.go = true;
  PD.t0 = Date.now();
  sfx.whistle();
  renderPinDay();
}
function renderPinDay() {
  const p = pdState(),
    gs = pinDayGrounds();
  $("app").classList.remove("focus", "q");
  if (!p.done && p.res.length >= PIN_N && !PD.shown) return pdFinish();
  if (!p.done && (p.res.length || PD.go)) {
    if (!PD.t0) PD.t0 = Date.now();
    return pdPaint();
  }
  if (!p.done) {
    $("main").innerHTML = `<div class="hd"><h2>Pin of the Day No. ${pinDayNo()}</h2><span class="eyebrow">One go a day</span></div>
    <div class="panel pad chb"><p class="note">Five clubs, five home grounds. Drop a pin on each one on a satellite map with no place names. Within ${TUNING.pinNear} km is 2 points, within ${TUNING.pinFar} km is 1. Same five for everyone. No clock.</p>
    <button class="btn" data-act="pdgo">Kick off</button></div>`;
    return;
  }
  const pts = pdPts(p),
    known = p.km.every(x => x !== null);
  $("main").innerHTML = `<div class="hd"><h2>Pin of the Day No. ${pinDayNo()}</h2><span class="eyebrow">Finished</span></div>
  <div class="panel pad gscore"><div class="gsc"><span class="eyebrow">Points</span><b class="led">${pts}/${PIN_N * 2}</b><span class="note">${pts >= 9 ? "Sat nav on the dashboard. Frightening." : pts >= 6 ? "Knows his way round the grounds." : pts >= 3 ? "A few away days under your belt." : "Never left the sofa."}</span></div><div class="statline"><span>${known ? "Total off <b>" + kmTxt(p.km.reduce((a, b) => a + b, 0)) + "</b>" : "Names mode"}</span><span><b>+${p.xp}</b> XP</span></div></div>
  <div class="panel pad"><div class="rv">${gs.map((i, k) => `<div class="${p.res[k] ? "ok" : "no"}"><span>${esc(GROUNDS[i].c)}</span><i>${p.km[k] === null ? "–" : kmTxt(p.km[k])}</i><span>${esc(GROUNDS[i].s)}</span></div>`).join("")}</div></div>
  <div class="row"><button class="btn line" data-act="sharepd">Copy result</button><a class="btn line" href="https://wa.me/?text=${encodeURIComponent(sharePinDay())}" target="_blank" rel="noopener">WhatsApp</a></div><p class="note">A new five at midnight.</p>`;
}
/* spoiler-free: no ground names, only how close each pin was */
function sharePinDay() {
  const p = pdState(),
    known = p.km.length && p.km.every(x => x !== null);
  return `1X2 PIN No. ${pinDayNo()}\n${p.res.map(r => (r === 2 ? "🟩" : r === 1 ? "🟨" : "🟥")).join("")}\n${pdPts(p)}/${PIN_N * 2}${known ? " · " + kmTxt(p.km.reduce((a, b) => a + b, 0)) + " off" : ""}\n${shareTail()}`;
}
function pinDayTile() {
  const p = S.pd && S.pd[dayKey()],
    done = p && p.done;
  return `<button class="panel tile2 pindayt" data-act="go" data-v="pinday"><span class="eyebrow">Pin of the Day · No. ${pinDayNo()}</span><b>${done ? pdPts(p) + "/" + PIN_N * 2 : p && p.res.length ? p.res.length + " of " + PIN_N : "Five grounds"}</b><span class="sub">${done ? "Done. New five at midnight." : "Drop a pin on each home ground."}</span><span class="more">${done ? "See it ›" : "Play ›"}</span></button>`;
}
