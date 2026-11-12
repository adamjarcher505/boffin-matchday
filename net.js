/* ============ net.js: everything that talks to a shared backend ============
   The game only ever calls `Net`. `Net` picks one backend and drives it through the same small interface:

     start()              -> true if this backend can be used here
     players()            -> league rows [{ id, n, c, d, w, cg, cp, s, p, pl, wn, dr, ls, gf, ga, xp, g, cu, t, f, m }]
     pushPlayer(row)      -> write my league row
     stampSave()          -> last-updated stamp of my cloud save, or null (cheap "has another device written?" check)
     loadSave()           -> { json, t } or null
     writeSave(json, t)   -> write my full save
     clubWars(week)       -> [{ c, gf, pts, fans, filled }] or null (null = not available, the game works it out from players())
     logMatch(rec)        -> anonymous per-match question log (best effort)
     questionStats(minN)  -> aggregate rows or null
     deleteAccount()      -> remove my rows and sign-in

   Backends: `supabase` (config.js filled in: sign-in, cloud saves, shared tables), `claude` (inside a claude.ai
   artifact), `local` (neither: solo play, everything on the device). Offline is always fine: the device save is
   the source of truth while playing and the cloud catches up afterwards.
   Anything that needs supabase/002_additions.sql fails soft until that script has been run. */
const SUPA_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
const loadScript = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
const COLS = "id,n,c,d,w,cg,cp,s,p,pl,wn,dr,ls,gf,ga,xp,g,cu,t,f,m";
const notThere = e => !!e && (["PGRST202", "PGRST205", "42883", "42P01", "404"].includes(String(e.code)) || /could not find|does not exist|not found in the schema/i.test(e.message || ""));

const Backends = {
  local: {
    name: "local",
    async start() { return true; },
    async players() { return []; }, async pushPlayer() { }, async stampSave() { return null; }, async loadSave() { return null; }, async writeSave() { },
    async clubWars() { return null; }, async logMatch() { }, async questionStats() { return null; }, async deleteAccount() { }
  },

  /* claude.ai artifact runtime: a small document db and a user id. Limits worth knowing: collection reads are capped
     at 500 unsorted records, so league tables and Club Wars only see up to 500 players there. */
  claude: {
    name: "claude", db: null, uid: null,
    async start() {
      if (!window.claude || !window.claude.use) return false;
      const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
      if (!db || !user) return false; const uid = await user.id(); if (!uid) return false;
      this.db = db; this.uid = uid; return true;
    },
    async players() { const q = await this.db.collection("players").limit(500).get(); return q.docs.map(d => Object.assign({ id: d.id }, d.data())); },
    async pushPlayer(row) { await this.db.doc("players/" + this.uid).set(row); },
    async loadSave() { const snap = await this.db.doc("data/users/" + this.uid + "/save").get(); if (!snap.exists) return null; const d = snap.data(); return d && d.json ? { json: d.json, t: d.t || 0 } : null; },
    async stampSave() { const s = await this.loadSave(); return s ? s.t : null; },
    async writeSave(json, t) { await this.db.doc("data/users/" + this.uid + "/save").set({ json, t }); },
    async clubWars() { return null; },
    async logMatch(rec) { await this.db.doc("qlog/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).set(rec); },
    async questionStats() { return null; },
    async deleteAccount() { const gone = { n: "", c: "", t: 0, gone: 1 }; await this.db.doc("players/" + this.uid).set(gone); await this.db.doc("data/users/" + this.uid + "/save").set({ json: "", t: 0 }); }
  },

  supabase: {
    name: "supabase", sb: null, uid: null, miss: {},
    async start() {
      if (!CFG.supabaseUrl || !CFG.supabaseKey) return false;
      await loadScript(SUPA_JS); if (!window.supabase) return false;
      this.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      return true;
    },
    async players() { const { data, error } = await this.sb.from("players").select(COLS).order("t", { ascending: false }).limit(500); if (error) throw error; return data || []; },
    async pushPlayer(row) { const { error } = await this.sb.from("players").update(row).eq("id", this.uid); if (error) throw error; },
    async stampSave() { const { data, error } = await this.sb.from("saves").select("t").eq("id", this.uid).maybeSingle(); if (error) throw error; return data ? data.t : null; },
    async loadSave() { const { data, error } = await this.sb.from("saves").select("json,t").eq("id", this.uid).maybeSingle(); if (error) throw error; return data && data.json ? { json: data.json, t: data.t || 0 } : null; },
    async writeSave(json, t) { const { error } = await this.sb.from("saves").upsert({ id: this.uid, json, t }); if (error) throw error; },
    // the three below need supabase/002_additions.sql; until it has been run they quietly report "not available"
    async clubWars(week) { if (this.miss.wars) return null; const { data, error } = await this.sb.rpc("club_wars", { wk: week }); if (error) { if (notThere(error)) this.miss.wars = true; return null; } return data || []; },
    async logMatch(rec) { if (this.miss.log) return; const { error } = await this.sb.from("question_log").insert({ d: rec.d, v: rec.v, q: rec.q }); if (error && notThere(error)) this.miss.log = true; },
    async questionStats(minN) { if (this.miss.stats) return null; const { data, error } = await this.sb.rpc("question_stats", { min_n: minN }); if (error) { if (notThere(error)) this.miss.stats = true; return null; } return data || []; },
    async deleteAccount() { const { error } = await this.sb.rpc("delete_my_account"); if (error) throw error; try { await this.sb.auth.signOut(); } catch (e) { } }
  }
};

/* which cloud stamp this device last synced against (kept outside the save so it never travels between devices) */
const SYNC_KEY = "boffin-sync";
const syncStamp = () => { try { const o = JSON.parse(localStorage.getItem(SYNC_KEY) || "null"); return o && o.u === Net.uid ? o.t : null; } catch (e) { return null; } };
const setSyncStamp = t => { try { localStorage.setItem(SYNC_KEY, JSON.stringify({ u: Net.uid, t })); } catch (e) { } };

const Net = {
  kind: "local", b: Backends.local, uid: null, email: "", ready: false, readonly: false, rows: [], last: 0, busy: false, again: false, checked: false, me: {}, pending: "",
  wars: null, warsAt: 0,
  canSignIn: () => Net.kind === "supabase",
  home: () => location.origin + location.pathname,
  async init() {
    try { await Net._init(); } catch (e) { } Net.checked = true; if (view === "home" || view === "stats") render();
    // the welcome/profile sheet was drawn before we knew sign-in was available: redraw it with the sign-in box, keeping what was typed
    if (Net.canSignIn() && $("pf") && !document.querySelector(".acct")) { const nm = $("nm") ? $("nm").value : "", cl = $("cl") ? $("cl").value : ""; profileSheet(!S.made); if ($("nm") && nm) $("nm").value = nm; if ($("cl") && cl) $("cl").value = cl; }
  },
  async _init() {
    for (const k of ["supabase", "claude"]) {
      let ok = false; try { ok = await Backends[k].start(); } catch (e) { ok = false; }
      if (!ok) continue; Net.kind = k; Net.b = Backends[k];
      if (k === "claude") { Net.uid = Net.b.uid; Net.ready = true; await Net.pull(true); await Net.push(); if (view !== "match") render(); }
      else await Net._auth();
      return;
    }
  },
  async _auth() {
    const sb = Net.b.sb;
    await Promise.race([new Promise(done => {
      sb.auth.onAuthStateChange((ev, session) => {
        setTimeout(async () => {   // supabase-js: don't await other calls inside this callback
          if (session && session.user.id !== Net.uid) await Net.signedIn(session.user, ev === "SIGNED_IN");
          else if (!session && Net.uid) Net.signedOut();
          if (ev === "INITIAL_SESSION") done();
        }, 0);
      });
    }), new Promise(done => setTimeout(done, 8000))]);
    if (!Net.uid) await Net.pull(true);
  },
  async signedIn(user, announce) {
    Net.uid = Net.b.uid = user.id; Net.email = user.email || ""; Net.ready = true;
    if (S.owner && S.owner !== user.id) S = fresh();   // someone else's progress on this device: start clean, never inherit it
    S.owner = user.id; persist();
    await Net.pull(true);
    await Net.push();                                   // merges with whatever the account already has, then writes back
    if (announce) toast(badgeOf(Net.me) === "fd" ? "The Founder is in the building." : "Signed in. Progress saved to your account.");
    if (view !== "match") { const open = !!$("over").innerHTML; render(); if (!S.made) profileSheet(true); else if (open) profileSheet(false); }
  },
  signedOut() { Net.uid = Net.b.uid = null; Net.email = ""; Net.ready = false; Net.me = {}; if (view !== "match") { render(); if ($("over").innerHTML) profileSheet(!S.made); } },
  async sendCode(email) { const { error } = await Net.b.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: Net.home() } }); return error; },
  async verifyCode(email, token) { const { error } = await Net.b.sb.auth.verifyOtp({ email, token, type: "email" }); return error; },
  google() { return Net.b.sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: Net.home() } }); },
  signOut() { return Net.b.sb.auth.signOut(); },
  async deleteAccount() { await Net.b.deleteAccount(); try { localStorage.removeItem(SYNC_KEY); } catch (e) { } },

  async pull(force) {
    if (Net.kind === "local" || (!force && Date.now() - Net.last < 20000)) return; Net.last = Date.now();
    try { const rows = await Net.b.players(); Net.rows = rows.filter(r => r && !r.gone); Net.me = Net.rows.find(r => r.id === Net.uid) || Net.me; } catch (e) { }
    Net.pullWars(force);
  },
  async pullWars(force) {
    if (Net.kind === "local" || (!force && Date.now() - Net.warsAt < 30000)) return; Net.warsAt = Date.now();
    try { Net.wars = await Net.b.clubWars(weekNo()); } catch (e) { Net.wars = null; }
  },
  row: () => ({ n: S.name.slice(0, 18), c: S.club, d: S.div, w: weekNo(), cg: cwNow().gf, cp: cwNow().pts, s: S.season, p: S.week.pts, pl: S.week.pl, wn: S.week.w, dr: S.week.d, ls: S.week.l, gf: S.week.gf, ga: S.week.ga, xp: S.xp, g: S.g, cu: S.cup.won, t: Date.now() }),
  /* Sync = pull-merge-push. If another device has written since we last synced, its save is merged into ours
     (mergeSaves in app.js) before we write, so two devices that both played offline keep both sets of progress. */
  async push() {
    if (!Net.ready || Net.readonly) return;
    if (Net.busy || (M && M.live)) { Net.again = true; return; }
    Net.busy = true;
    try {
      const stamp = await Net.b.stampSave(), mine = syncStamp();
      if (stamp != null && stamp !== mine) {
        const sv = await Net.b.loadSave();
        if (sv && sv.json) { const before = JSON.stringify(S), merged = mergeSaves(S, hydrate(JSON.parse(sv.json))); merged.owner = Net.uid; if (JSON.stringify(merged) !== before) { S = merged; persist(); if (view !== "match" && view !== "ft") render(); } }
      }
      if (S.made) { if (!S.t) S.t = Date.now(); await Net.b.pushPlayer(Net.row()); await Net.b.writeSave(JSON.stringify(S), S.t); setSyncStamp(S.t); }
      else if (stamp != null) setSyncStamp(stamp);
    } catch (e) { if (e && e.code === "invalid_argument") Net.readonly = true; }
    Net.busy = false; if (Net.again && !(M && M.live)) { Net.again = false; Net.push(); }
  },
  async log(rec) { try { await Net.b.logMatch(rec); } catch (e) { } },
  async stats(minN) { try { return await Net.b.questionStats(minN); } catch (e) { return null; } }
};
addEventListener("online", () => Net.push());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") Net.push(); });
