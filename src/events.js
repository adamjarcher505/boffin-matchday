"use strict";
/* ============ events.js: account actions, the name box and its suggestions, and the one click handler ============ */
/* ============ events ============ */
async function acctAct(act) {
  const am = t => {
    const m = $("amsg");
    if (m) {
      m.textContent = t;
      m.className = "msg";
    }
  };
  try {
    if (act === "google") {
      am("Off to Google…");
      const r = await Net.google();
      if (r && r.error) am("Google sign-in isn't working: " + r.error.message);
    } else if (act === "sendcode") {
      const em = ($("em").value || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
        am("That doesn't look like an email address.");
        return;
      }
      if (!navigator.onLine) {
        am("You're offline. Sign in when you've got signal.");
        return;
      }
      am("Sending…");
      const err = await Net.sendCode(em);
      if (err) {
        am(
          /fetch|network/i.test(err.message || "")
            ? "Couldn't reach the server. Check your signal and try again."
            : /rate|seconds/i.test(err.message || "")
              ? "Hang on a minute before asking for another code."
              : "Couldn't send it: " + err.message
        );
        return;
      }
      Net.pending = em;
      $("codebox").hidden = false;
      if (Net.handoffOK())
        am(
          "Sent to " +
            em +
            ". Tap Sign in in the email (check junk too). It opens Safari, that's fine: then come back here and you'll be signed in within a few seconds."
        );
      else {
        am("Sent to " + em + ". Open the email on this device and tap Sign in (check junk too). If it shows a 6-digit code, type it below.");
        try {
          $("otp").focus();
        } catch (e) {}
      }
    } else if (act === "verify") {
      const code = ($("otp").value || "").replace(/\D/g, "");
      if (code.length < 6) {
        am("The code is 6 digits.");
        return;
      }
      am("Checking…");
      const err = await Net.verifyCode(Net.pending, code);
      if (err) am("That code didn't work. Check it or send a new one.");
      else Net.pending = "";
    } else if (act === "delacct") {
      confirmSheet(
        "Delete your account?",
        "Your account, your saved progress online and your place in the shared tables go for good, badges included. This can't be undone. Progress on this device stays unless you also reset it.",
        "Delete it",
        async () => {
          try {
            toast("Deleting…");
            await Net.deleteAccount();
            S.owner = "";
            save();
            Net.signedOut();
            toast("Account deleted. Gone, like a free transfer.");
          } catch (e) {
            toast(
              /not find|does not exist|PGRST/i.test((e && e.message) || "")
                ? "Deleting accounts isn't switched on yet. Try again soon."
                : "Couldn't delete it just now. Check your signal and try again."
            );
          }
        }
      );
    } else if (act === "signout") {
      await Net.signOut();
      toast("Signed out. Progress stays on this device.");
    }
  } catch (e) {
    am("Something went wrong. Check your connection and try again.");
  }
}
function submitPick(i, raw) {
  const q = $("q");
  if (q) {
    q.value = "";
  }
  const s = $("sug");
  if (s) s.hidden = true;
  const c = $("clr");
  if (c) c.hidden = true;
  if (view === "grid") {
    if (i >= 0) gridPick(i);
  } else if (view === "chain") chainPick(i); else if (M && M.live && M.run && M.run.onPick) M.run.onPick(i, raw || "");
  if (q && q.isConnected) {
    try {
      q.focus();
    } catch (e) {}
  }
}
document.addEventListener("input", e => {
  const t = e.target;
  if (t.id === "q") showSugg(t.value);
  else if (t.id === "sl" && M && M.run && M.run.onInput) M.run.onInput(t.value);
});
document.addEventListener("change", e => {
  if (e.target.id === "ac") {
    albumClub = e.target.value;
    renderAlbum();
  }
});
/* the suggestion list under (or over) the name box */
function showSugg(val) {
  const s = $("sug"),
    c = $("clr");
  if (c) c.hidden = !val;
  if (!s) return;
  const r = search(val),
    used = view === "grid" && GRID ? gridState().c : [];
  s.hidden = !r.length;
  s.innerHTML = r
    .map((i, k) => {
      const u = used.includes(pkey(+i));
      return `<button type="button" class="${k === 0 ? "on" : ""}${i.fz ? " fz" : ""}${u ? " used" : ""}" data-act="sugg" data-v="${+i}"><span class="nm">${sugName(+i, val)}</span><span>${i.fz ? "<i>close</i>" : ""}${u ? "<i>used</i>" : ""}${POSN[PL[+i][2]]}${PL[+i][3] > 0 ? " · b. " + (1900 + PL[+i][3]) : ""}</span></button>`;
    })
    .join("");
}
document.addEventListener("keydown", e => {
  if (e.target.id !== "q") return;
  const s = $("sug"),
    rows = s && !s.hidden ? [...s.querySelectorAll("button")] : [],
    on = rows.findIndex(b => b.classList.contains("on"));
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && rows.length) {
    e.preventDefault();
    let n = on + (e.key === "ArrowDown" ? 1 : -1);
    n = (n + rows.length) % rows.length;
    rows.forEach((b, k) => b.classList.toggle("on", k === n));
    return;
  }
  if (e.key === "Escape" && rows.length) {
    s.hidden = true;
    return;
  }
  if (e.key !== "Enter") return;
  e.preventDefault();
  const pick = rows[on >= 0 ? on : 0],
    raw = M && M.run && M.run.raw && e.target.value.trim();
  if (pick && !(raw && pick.classList.contains("fz")))
    submitPick(+pick.dataset.v); // a near miss never overrides what was typed in a surname-only question
  else if (raw) submitPick(-1, e.target.value);
});
document.addEventListener("mousedown", e => {
  if (e.target.closest && e.target.closest(".sug")) e.preventDefault();
});
document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act,
    v = b.dataset.v;
  if (act === "go") {
    M = null;
    view = v;
    render();
  } else if (act === "kick") {
    if (!S.made) {
      profileSheet(true);
      return;
    }
    startLeagueMatch();
  } else if (act === "train") startTraining(v);
  else if (act === "long") startLong(v);
  else if (act === "google" || act === "sendcode" || act === "verify" || act === "signout" || act === "delacct") acctAct(act);
  else if (act === "kit") {
    S.kit = S.kit === false;
    save();
    chrome();
    profileSheet(false);
  } else if (act === "share") doShare();
  else if (act === "cup") {
    if (!S.made) {
      profileSheet(true);
      return;
    }
    startCupMatch();
  } else if (act === "take") takeChance();
  else if (act === "sugg") submitPick(+v);
  else if (act === "qreport") {
    if (b.disabled) return;
    b.disabled = true;
    b.textContent = "Reported";
    const x = QB.by[v] || {};
    Net.report({ id: v, bank: QB.v, src: x.src || [], d: S.div });
    toast("Thanks. We'll check that one against the sources.");
  } else if (act === "ghint") {
    const g = gridState(),
      k = gridCell;
    if (k < 0 || g.c[k] || g.h[k] >= TUNING.gridHint.length) return;
    if (gridHintTarget(k) < 0) {
      msg("No hint for this one, sorry.", "");
      return;
    }
    g.h[k]++;
    save();
    sfx.tick();
    const l = $("hintln");
    if (l) {
      l.hidden = false;
      l.innerHTML = gridHintText(k);
    }
    const hb = $("hintb");
    if (hb) hb.innerHTML = hintBtn(k);
    const q = $("q");
    if (q)
      try {
        q.focus();
      } catch (e) {}
  } else if (act === "clrq") {
    const q = $("q");
    if (q) {
      q.value = "";
      showSugg("");
      try {
        q.focus();
      } catch (e) {}
    }
  } else if (act === "tap") {
    if (M && M.live && M.run && M.run.onTap) M.run.onTap(v);
  } else if (act === "cont") {
    if (!M) return;
    if (M.mode === "league" && M.i >= 5) fullTime();
    else if (M.mode === "cup" && M.i >= M.rounds.length) cupContinue();
    else chanceCover();
  } else if (act === "quit") {
    if (!M) return;
    if (M.mode === "cup" && !(M.i === 0 && !M.live)) {
      confirmSheet("Walk off?", "Walk off a cup tie and you're knocked out.", "Walk off", () => {
        S.cup.l++;
        S.cup.best = Math.max(S.cup.best, S.cup.rd);
        S.cup.rd = 0;
        S.cup.runs++;
        save(true);
        quitMatch();
      });
      return;
    }
    if (M.mode === "train" || (M.i === 0 && !M.live)) quitMatch();
    else
      confirmSheet(
        "Walk off?",
        "An abandoned match doesn't count in the table. You keep nothing from it, and the rematch is five new questions.",
        "Abandon",
        abandonMatch
      );
  } else if (act === "ltab") {
    leagueTab = v;
    renderLeague();
  } else if (act === "cell") cellSheet(+v);
  else if (act === "gans") answersSheet(+v);
  else if (act === "chaingo") chainGo();
  else if (act === "pdgo") pdGo();
  else if (act === "pdlock") pdLock();
  else if (act === "pdopt") pdOption(+v);
  else if (act === "sharepd") {
    SHARE = sharePinDay();
    doShare();
  }
  else if (act === "sharechain") {
    SHARE = shareChain();
    doShare();
  } else if (act === "sharegrid") {
    SHARE = shareGrid();
    doShare();
  } else if (act === "shareseason") {
    if (S.note) {
      SHARE = shareSeason(S.note);
      doShare();
    }
  } else if (act === "hap") {
    S.hap = S.hap === false;
    save();
    if (S.hap) buzz(40);
    profileSheet(false);
  } else if (act === "profile") profileSheet(!S.made);
  else if (act === "chip") {
    if (!S.made) {
      profileSheet(true);
      return;
    }
    M = null;
    view = "me";
    render();
  }
  else if (act === "sound") {
    S.sound = !S.sound;
    save();
    profileSheet(false);
  } else if (act === "clearnote") {
    S.note = null;
    save();
    render();
  } else if (act === "reset")
    confirmSheet("Reset everything?", "Level, division, album and form all go back to nothing. This can't be undone.", "Reset", () => {
      const salt = S.salt;
      S = fresh();
      S.salt = salt;
      try {
        localStorage.removeItem(KEY);
      } catch (err) {}
      view = "home";
      render();
      profileSheet(true);
    });
  else if (act === "closeover") $("over").innerHTML = "";
});
let wasWide = wide();
addEventListener("resize", () => {
  const w = wide();
  if (w === wasWide) return;
  wasWide = w;
  if (view !== "match" && view !== "ft" && view !== "stk") render();
  else chrome();
});
