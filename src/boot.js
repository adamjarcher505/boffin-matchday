/* ============ boot.js: start the game (loaded last) ============ */
render();
if (!S.made) profileSheet(true);
Net.init();

/* On-screen keyboard: question screens use the whole screen, but while the keyboard is up they switch to the compact
   layout so the answer box and what you're answering stay above it. The keyboard shrinks the visual viewport. */
(function () {
  const app = document.getElementById("app"),
    vv = window.visualViewport,
    touch = window.matchMedia("(pointer: coarse)").matches;
  const check = () => app.classList.toggle("kb", !!vv && innerHeight - vv.height > 140);
  if (vv) vv.addEventListener("resize", check);
  // a touch screen focusing a text box means the keyboard is on its way: go compact straight away instead of jumping after it lands
  document.addEventListener("focusin", e => {
    if (touch && e.target.matches && e.target.matches("input[type=text], input:not([type])")) app.classList.add("kb");
  });
  document.addEventListener("focusout", () => setTimeout(check, 250));
  check();
})();

/* Service worker: offline play, and a "new version ready" toast when an update has downloaded.
   A new version never takes over mid-session on its own: the player taps the toast (or it lands next launch). */
(function () {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  let asked = false,
    shown = false;
  const offer = w => {
    if (!w || shown || !navigator.serviceWorker.controller) return; // no controller = first install, nothing to update from
    shown = true;
    const b = document.createElement("button");
    b.className = "toast act";
    b.id = "uptoast";
    b.type = "button";
    b.textContent = "New version ready, tap to refresh";
    b.addEventListener("click", () => {
      asked = true;
      b.textContent = "Updating…";
      w.postMessage({ type: "SKIP_WAITING" });
      setTimeout(() => location.reload(), 4000);
    });
    $("toasts").appendChild(b);
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (asked) location.reload();
  });
  addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then(reg => {
        if (reg.waiting) offer(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          if (w)
            w.addEventListener("statechange", () => {
              if (w.state === "installed") offer(w);
            });
        });
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      })
      .catch(() => {});
  });
})();
