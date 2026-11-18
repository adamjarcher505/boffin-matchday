"use strict";
/* ============ fx.js: sound, club crests, commentary lines and small animation helpers ============
   Nothing here changes a score, a table or which questions a seed builds. It's all how the game feels.
   Every sound is made in code (Web Audio), so there are no audio files to download or cache. */

/* ---------- sound ---------- */
const sfx = (() => {
  let ac = null,
    hiss = null;
  const audio = () => {
    if (!S.sound) return null;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      return ac;
    } catch (e) {
      return null;
    }
  };
  /* one note: f Hz for d seconds at volume v, starting w seconds from now, optionally sliding to f2 */
  const tone = (f, d, v = 0.04, type = "triangle", w = 0, f2 = 0) => {
    const a = audio();
    if (!a) return;
    try {
      const o = a.createOscillator(),
        g = a.createGain(),
        t = a.currentTime + w;
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(a.destination);
      o.start(t);
      o.stop(t + d + 0.02);
    } catch (e) {}
  };
  /* a crowd: filtered noise that swells and dies away, the filter sliding from f0 to f1 */
  const crowd = (d, v, w, f0, f1, attack = 0.08) => {
    const a = audio();
    if (!a) return;
    try {
      if (!hiss) {
        hiss = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
        const ch = hiss.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      }
      const src = a.createBufferSource(),
        bp = a.createBiquadFilter(),
        g = a.createGain(),
        t = a.currentTime + w;
      src.buffer = hiss;
      src.loop = true;
      bp.type = "bandpass";
      bp.Q.value = 0.7;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.linearRampToValueAtTime(f1, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(bp);
      bp.connect(g);
      g.connect(a.destination);
      src.start(t);
      src.stop(t + d + 0.05);
    } catch (e) {}
  };
  const blast = (w, d) => {
    tone(2050, d, 0.022, "sine", w);
    tone(2110, d, 0.022, "sine", w);
    tone(4130, d, 0.006, "sine", w);
  };
  return {
    tick: () => tone(740, 0.07),
    click: () => tone(330, 0.035, 0.02, "sine"),
    no: () => tone(150, 0.18, 0.05, "sawtooth"),
    clock: last => tone(last ? 1175 : 880, 0.05, 0.03, "square"),
    goal: () => {
      crowd(1.9, 0.2, 0, 500, 1500);
      crowd(1.6, 0.07, 0.05, 1800, 2800);
      tone(523, 0.12, 0.05);
      tone(784, 0.14, 0.05, "triangle", 0.1);
      tone(1047, 0.3, 0.05, "triangle", 0.2);
    },
    miss: () => {
      crowd(0.9, 0.09, 0, 520, 200, 0.04);
      tone(196, 0.4, 0.035, "sine", 0, 120);
    },
    oppGoal: () => {
      crowd(0.8, 0.06, 0, 380, 220, 0.03);
      tone(110, 0.3, 0.05, "sine", 0, 80);
    },
    oppMiss: () => {
      crowd(0.6, 0.06, 0, 700, 1200, 0.05);
      tone(660, 0.08, 0.025, "triangle", 0.05);
    },
    whistle: () => blast(0, 0.45),
    fullTime: () => {
      blast(0, 0.16);
      blast(0.24, 0.16);
      blast(0.48, 0.7);
    },
    level: () => [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.16, 0.045, "triangle", k * 0.08)),
    medal: () => {
      tone(784, 0.1, 0.045);
      tone(988, 0.1, 0.045, "triangle", 0.09);
      tone(1568, 0.35, 0.04, "triangle", 0.18);
    },
    cheer: () => crowd(1.2, 0.1, 0, 600, 1300)
  };
})();

/* ---------- crests: a shield in two colours with the side's initials. Drawn in code; not any real club's badge. ----------
   House sides get colours from their name. The player's shield uses their club's home colours (kits.js). */
const CREST_COLS = [
  ["#c8102e", "#f4f4f1"],
  ["#1d3fa0", "#f4f4f1"],
  ["#f0b541", "#151515"],
  ["#0b6b3a", "#f4f4f1"],
  ["#20242a", "#f0b541"],
  ["#6c1d45", "#8dc3ea"],
  ["#e9e7e0", "#132257"],
  ["#e8641b", "#151515"],
  ["#8dc3ea", "#132257"],
  ["#5a2d82", "#f4f4f1"],
  ["#0e7c86", "#f4f4f1"],
  ["#7b1f32", "#f0b541"]
];
const initials = name => {
  const w = String(name)
    .replace(/[^A-Za-zÀ-ÿ0-9 ]/g, " ")
    .split(" ")
    .filter(x => x && !/^(fc|the|of|and|a)$/i.test(x));
  return (w.length > 1 ? w.slice(0, 3).map(x => x[0]) : [(w[0] || "?").slice(0, 2)]).join("").toUpperCase();
};
const lum = hex => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
let crestN = 0;
function crest(name, kit) {
  const h = hash("cr" + name),
    pick = CREST_COLS[h % CREST_COLS.length],
    a = kit ? kit.b : pick[0];
  let b = kit ? kit.s || kit.c || kit.t || "#f4f4f1" : pick[1];
  if (Math.abs(lum(a) - lum(b)) < 0.25) b = lum(a) > 0.5 ? "#151515" : "#f4f4f1";
  const ink = lum(a) > 0.55 ? "#151515" : "#f7f5ee",
    style = (h >>> 8) % 4,
    id = "cs" + ++crestN,
    ini = initials(name);
  const top =
    style === 0
      ? `<rect width="48" height="15" fill="${b}"/>`
      : style === 1
        ? `<path d="M0 0h48v9L24 21 0 9z" fill="${b}"/>`
        : style === 2
          ? [4, 14, 24, 34, 44].map(x => `<rect x="${x - 2.5}" width="5" height="16" fill="${b}"/>`).join("")
          : `<path d="M0 0h20L0 20zM48 0H28l20 20z" fill="${b}"/>`;
  return `<svg class="crest" viewBox="0 0 48 54" aria-hidden="true"><defs><clipPath id="${id}"><path d="M3 3h42v24c0 12-9 20-21 24C12 47 3 39 3 27z"/></clipPath></defs>
<g clip-path="url(#${id})"><rect width="48" height="54" fill="${a}"/>${top}<rect width="48" height="54" fill="#000" opacity=".0"/><path d="M24 0v54h24V0z" fill="#000" opacity=".1"/></g>
<path d="M3 3h42v24c0 12-9 20-21 24C12 47 3 39 3 27z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/>
<text x="24" y="${ini.length > 2 ? 36 : 37}" text-anchor="middle" font-family="'Big Shoulders Display','Arial Narrow',sans-serif" font-weight="900" font-size="${ini.length > 2 ? 15 : 19}" letter-spacing=".5" fill="${ink}">${esc(ini)}</text></svg>`;
}
const myCrest = () => crest(S.name || "You", (window.BOFFIN_KITS || {})[S.club]);

/* ---------- commentary: one line after each chance, read off the real score. Terrace voice, never an invented fact. ---------- */
const TALK = {
  // Pin the Ground reveal, by how far off: [up to km, lines]
  pin: [[0.3, ["On the centre spot.", "Dead centre. Groundsman's work."]], [1.5, ["In the car park.", "Round the corner from the turnstiles."]], [8, ["Right town, wrong street.", "Close enough to hear the roar."]], [50, ["Wrong side of the ring road.", "You'd miss kick-off."]], [1e9, ["Not even the right county.", "Sat nav's packed in."]]],
  lead: ["In front. Don't do anything daft now.", "You lead. The away end's gone quiet.", "Ahead. Now see it out.", "That's put you in front. Deserved, on balance."],
  level: ["Level. Game on.", "Back in it. They don't fancy this now.", "All square. Momentum's yours.", "Pegged them back."],
  clear: ["Daylight between you. Lovely stuff.", "Cruise control. They're chasing shadows.", "That should be that.", "The gaffer's sat down. Always a good sign."],
  hope: ["One back. There's a game here yet.", "A lifeline. Keep going.", "Not dead yet."],
  first: ["Up and running.", "Early doors, and you're off the mark.", "That'll settle the nerves."],
  missLevel: ["Should've buried it.", "Big chance, that. Gone.", "You'll see that one again tonight when you close your eyes."],
  missAhead: ["No harm done. Yet.", "Still in front. Don't make a habit of it.", "A let-off for them."],
  missBehind: ["That was the one. Head in hands.", "Not your day so far.", "The mountain just got steeper."],
  slow: ["Dallied on it.", "Too long on the ball.", "The chance went begging.", "Took a touch too many."],
  fire: ["Three on the spin. You're on fire.", "Can't miss. Everything's going in.", "Hat-trick of chances taken. Match ball territory."],
  oppGoal: ["{o} go straight up the other end and score.", "{o} answer. Typical.", "No mistake from {o}.", "{o} tuck theirs away."],
  oppLevel: ["{o} are level. It didn't last.", "Pegged back by {o}.", "{o} equalise. As you were."],
  oppLead: ["{o} lead. Work to do.", "{o} are in front now.", "Behind. {o} won't believe their luck."],
  oppMiss: ["{o} put theirs in Row Z.", "{o} waste it. Let off.", "{o} fluff their lines.", "Nothing doing for {o}. Wide."]
};
const runOf = arr => {
  let n = 0;
  for (let k = arr.length - 1; k >= 0 && arr[k]; k--) n++;
  return n;
};
/* o: goal, a0/b0 (score before this chance), a (my score after it), run (goals in a row now), timedOut */
function commentary(o) {
  if (o.goal) {
    if (o.run === 3) return pickR(TALK.fire);
    if (o.a0 + o.b0 === 0) return pickR(TALK.first);
    if (o.a0 === o.b0) return pickR(TALK.lead);
    if (o.a === o.b0) return pickR(TALK.level);
    if (o.a < o.b0) return pickR(TALK.hope);
    return pickR(TALK.clear);
  }
  if (o.timedOut) return pickR(TALK.slow);
  return pickR(o.a0 > o.b0 ? TALK.missAhead : o.a0 < o.b0 ? TALK.missBehind : TALK.missLevel);
}
/* their chance: og = they scored; a/b = the score after it; b was level or behind before if they scored */
function oppLine(og, a, b, name) {
  const pool = !og ? TALK.oppMiss : b === a ? TALK.oppLevel : b === a + 1 ? TALK.oppLead : TALK.oppGoal;
  return pickR(pool).replace("{o}", name);
}

/* ---------- small animation helpers ---------- */
const still = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
};
/* count a number up inside an element */
function countUp(el, to, ms, prefix) {
  if (!el) return;
  prefix = prefix || "";
  if (still() || !ms) {
    el.textContent = prefix + fmt(to);
    return;
  }
  const t0 = Date.now();
  (function step() {
    if (!el.isConnected) return;
    const p = Math.min(1, (Date.now() - t0) / ms);
    el.textContent = prefix + fmt(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  })();
}
/* sparks that fly out from the middle of a goal banner */
const sparks = n =>
  Array.from({ length: n }, (_, k) => `<i style="--a:${Math.round((360 / n) * k + (k % 2) * 9)}deg;--d:${70 + ((k * 37) % 60)}px;--t:${k % 3}"></i>`).join("");
