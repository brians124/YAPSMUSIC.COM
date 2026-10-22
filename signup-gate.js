/* YAPSMusic sign-up gate (loaded with `defer` by every page).
   Whenever a visitor taps a song (play, download, a song card, "Open in the app" for a song) this shows a
   "Create a free account" popup instead, and sends them to the app's Create account form.
   - Works on every page, including the generated song/ pages and the all-songs hub.
   - It runs in the capture phase, so it fires before each page's own click handlers.
   - Song details for the popup come from catalog.js (loaded only when the popup first opens).
   On a song page (a shared song link) that song plays free; the popup appears when it ends or on any other tap.
   Change the wording or the link in CONFIG below. */
(function () {
  "use strict";
  if (window.__yapsGate) return;
  window.__yapsGate = 1;

  /* ---------- CONFIG ---------- */
  var APP = "https://brians124.github.io/YAPSMUSIC.APP/";
  var SIGNUP = APP + "?go=signup";   /* the app opens the Create account form */
  var LOGIN = APP + "?go=login";     /* the app opens the Sign in form */
  var TITLE = "Enjoying the music? Create a free account";
  var PERKS = ["Stream and download unlimited songs", "Save favourites and build playlists", "Free, and it takes 30 seconds"];

  var cs = document.currentScript;
  var ROOT = cs && cs.src ? cs.src.replace(/[^\/?#]*([?#].*)?$/, "") : "";
  var asset = function (p) { return /^https?:/.test(p) ? p : APP + encodeURI(p); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var ini = function (s) { return s.split(" ").map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase(); };

  /* anything that plays, downloads or opens a song */
  /* On a song page (shared link) the visitor can listen to THAT song without an account.
     Downloads, next/previous and every other song still ask them to sign up. */
  var ON_SONG = document.body && document.body.getAttribute("data-hero") === "song";
  var FREE = "#hpP,#hpApp,.acts a";
  /* FREE_PLAY = true: visitors can PLAY any song (hero player on every page) with no account.
     Only Download asks them to sign up, plus a popup when a song finishes. Set false to gate every tap again. */
  var FREE_PLAY = true;
  var SEL_ALL = "[data-song],[data-play],a[href*='?track='],a[href*='&track='],#pp,#dl,#hpP,#hpDl,#hpPrev,#hpNext";
  var SEL = FREE_PLAY ? "#dl,#hpDl" : SEL_ALL;

  /* ---------- finding which song was tapped ---------- */
  function trackFromHref(h) { var m = /[?&]track=(\d+)/.exec(h || ""); return m ? +m[1] : 0; }
  function idOf(el) {
    var v = el.getAttribute("data-song") || el.getAttribute("data-play");
    if (/^\d+$/.test(v || "")) return +v;
    var h = el.getAttribute("href") || "";
    return trackFromHref(h) || 0;
  }
  function currentId() {
    var ids = ["po", "hpApp"];
    for (var i = 0; i < ids.length; i++) {
      var a = document.getElementById(ids[i]);
      if (a) { var t = trackFromHref(a.getAttribute("href")); if (t) return t; }
    }
    var m = /-(\d+)\.html(?:[?#].*)?$/.exec(location.pathname);   /* song/<slug>-<id>.html */
    return m ? +m[1] : 0;
  }

  /* ---------- catalogue (for the song name + cover in the popup) ---------- */
  var catReady = null;
  function withCat(cb) {
    if (window.YAPS_CAT) return cb();
    if (!catReady) {
      catReady = [];
      var s = document.createElement("script");
      s.src = ROOT + "catalog.js";
      s.onload = s.onerror = function () { var q = catReady; catReady = null; q.forEach(function (f) { f(); }); };
      document.head.appendChild(s);
    }
    catReady.push(cb);
  }
  function find(id) {
    var c = window.YAPS_CAT || [];
    for (var i = 0; i < c.length; i++) if (c[i][0] === id) return { id: id, title: c[i][1], artist: c[i][2], img: c[i][3] };
    return null;
  }

  /* ---------- the popup ---------- */
  var css = document.createElement("style");
  css.textContent =
    ".sg{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(6,7,9,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:0;transition:opacity .2s}" +
    ".sg.in{opacity:1}" +
    ".sg-card{position:relative;width:min(100%,420px);max-height:calc(100dvh - 40px);overflow:auto;padding:28px 24px 22px;text-align:center;color:#f4f5f7;border-radius:28px;background:linear-gradient(160deg,rgba(60,63,69,.96),rgba(24,25,28,.98));border:1px solid rgba(255,255,255,.18);box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.14);transform:translateY(14px) scale(.98);transition:transform .25s}" +
    ".sg.in .sg-card{transform:none}" +
    "@media(max-width:560px){.sg{align-items:flex-end;padding:0}.sg-card{width:100%;max-height:92dvh;border-radius:28px 28px 0 0;padding-bottom:calc(22px + env(safe-area-inset-bottom,0px))}}" +
    ".sg-x{position:absolute;top:12px;right:12px;width:36px;height:36px;border:0;border-radius:50%;background:rgba(255,255,255,.09);color:#e8eaed;font-size:20px;line-height:1;cursor:pointer}" +
    ".sg-x:hover{background:rgba(255,255,255,.18)}" +
    ".sg-art{position:relative;width:96px;height:96px;margin:2px auto 16px;border-radius:20px;overflow:hidden;display:grid;place-items:center;font-size:30px;font-weight:800;color:#ffffffcc;background:linear-gradient(135deg,#8f949c,#34373c);box-shadow:0 14px 34px rgba(0,0,0,.5)}" +
    ".sg-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
    ".sg-art[hidden]{display:none}" +
    ".sg h2{margin:0 0 6px;font-size:clamp(21px,5vw,25px);font-weight:800;letter-spacing:-.02em;line-height:1.15;overflow-wrap:anywhere}" +
    ".sg-song{margin:0 0 14px;font-size:14px;color:#b9bdc4;overflow-wrap:anywhere}" +
    ".sg-song:empty{display:none}" +
    ".sg ul{margin:0 0 20px;padding:0;list-style:none;text-align:left;display:inline-block}" +
    ".sg li{position:relative;padding:5px 0 5px 28px;font-size:14.5px;color:#e8eaed}" +
    ".sg li::before{content:'\\2713';position:absolute;left:0;top:5px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;color:#111214;background:#7ce3a1}" +
    ".sg a.sg-pri,.sg a.sg-sec{display:flex;align-items:center;justify-content:center;min-height:50px;padding:13px 20px;border-radius:999px;font-weight:700;font-size:15.5px;text-decoration:none;transition:transform .15s,background .2s}" +
    ".sg a.sg-pri{background:#f4f5f7;color:#111214;box-shadow:0 10px 28px rgba(0,0,0,.4)}" +
    ".sg a.sg-pri:hover{background:#fff;transform:translateY(-1px)}" +
    ".sg a.sg-sec{margin-top:10px;color:#f4f5f7;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06)}" +
    ".sg a.sg-sec:hover{background:rgba(255,255,255,.14)}" +
    ".sg-later{margin-top:12px;border:0;background:none;color:#b9bdc4;font:inherit;font-size:13.5px;cursor:pointer;padding:8px 12px;text-decoration:underline;text-underline-offset:3px}" +
    ".sg-later:hover{color:#fff}" +
    "@media(prefers-reduced-motion:reduce){.sg,.sg-card{transition:none}}";
  document.head.appendChild(css);

  var box = null, lastFocus = null, pending = null, bypass = false;
  var seen = function () { try { return sessionStorage.getItem("yapsGateSeen") === "1"; } catch (e) { return false; } };
  var markSeen = function () { try { sessionStorage.setItem("yapsGateSeen", "1"); } catch (e) {} };

  function close() {
    if (!box) return;
    var b = box; box = null;
    b.classList.remove("in");
    document.removeEventListener("keydown", onKey, true);
    document.documentElement.style.overflow = b.__ov || "";
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 200);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    var f = pending; pending = null;
    if (f) setTimeout(f, 0);   /* dismissed -> carry on with what they asked for (e.g. the download) */
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab" || !box) return;
    var f = box.querySelectorAll("a[href],button");
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open(id, after) {
    if (box) return;
    pending = after || null;
    markSeen();
    lastFocus = document.activeElement;
    var go = function (path, tid) { return path + (tid ? "&track=" + tid : ""); };
    box = document.createElement("div");
    box.className = "sg";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "sgT");
    box.__ov = document.documentElement.style.overflow;
    box.innerHTML =
      '<div class="sg-card">' +
      '<button class="sg-x" type="button" aria-label="Close">&times;</button>' +
      '<div class="sg-art" id="sgArt" hidden></div>' +
      '<h2 id="sgT">' + esc(TITLE) + '</h2>' +
      '<p class="sg-song" id="sgS"></p>' +
      '<ul>' + PERKS.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" +
      '<a class="sg-pri" id="sgGo" href="' + esc(go(SIGNUP, id)) + '">Create free account</a>' +
      '<a class="sg-sec" id="sgLog" href="' + esc(go(LOGIN, id)) + '">I already have an account</a>' +
      '<button class="sg-later" type="button">' + (after ? "No thanks, download now" : "Maybe later") + '</button>' +
      "</div>";
    document.body.appendChild(box);
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(function () { if (box) box.classList.add("in"); });
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest(".sg-x,.sg-later")) close();
    });
    document.addEventListener("keydown", onKey, true);
    var main = box.querySelector("#sgGo");
    if (main) main.focus();

    if (id) withCat(function () {
      var s = find(id);
      if (!s || !box) return;
      var art = box.querySelector("#sgArt");
      art.hidden = false;
      art.innerHTML = esc(ini(s.title)) + '<img src="' + esc(asset(s.img)) + '" alt="" onerror="this.remove()">';
      box.querySelector("#sgS").innerHTML = "&ldquo;" + esc(s.title) + "&rdquo; by " + esc(s.artist) + " is waiting for you";
    });
  }
  window.yapsSignupGate = open;

  /* ---------- intercept taps (capture phase = before each page's own handlers) ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest(".sg")) return;
    var el = t.closest(SEL);
    if (!el) return;
    if (bypass) return;
    if (ON_SONG && el.closest(FREE)) return;   /* let them play this song */
    e.preventDefault();
    e.stopImmediatePropagation();
    if (FREE_PLAY) {
      /* friendly, optional prompt: "No thanks" simply carries on with the download */
      if (seen()) { bypass = true; el.click(); bypass = false; return; }
      open(idOf(el) || currentId(), function () { bypass = true; el.click(); bypass = false; });
      return;
    }
    open(idOf(el) || currentId());
  }, true);

  /* the native audio controls on song pages (and media keys): stop playback and ask for an account */
  document.addEventListener("play", function (e) {
    var a = e.target;
    if (!a || a.tagName !== "AUDIO") return;
    if (ON_SONG || FREE_PLAY) return;   /* playback is free */
    try { a.pause(); } catch (x) {}
    open(currentId());
  }, true);

  /* song page: when the song finishes, invite them to create an account for more */
  var endedOnce = false;
  document.addEventListener("ended", function (e) {
    if (!(ON_SONG || FREE_PLAY) || endedOnce || !e.target || e.target.tagName !== "AUDIO") return;
    endedOnce = true;
    open(currentId());
  }, true);
})();
