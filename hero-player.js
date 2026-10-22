/* YAPSMusic hero player (shared by every page, loaded with `defer`).
   - Puts a player (play / pause, seek, previous / next, DOWNLOAD, song search) in the hero of the page.
   - Any song you tap on the page (cards, rows, chart entries, album tracks, search results) loads into it.
   - All 91 songs come from catalog.js, which build-seo.js regenerates from music.html.
   Pages work without it; it only enhances them. The homepage keeps its own hero player (#player). */
(function () {
  "use strict";
  if (window.__yapsHero || document.getElementById("player")) return;
  window.__yapsHero = 1;

  var cs = document.currentScript;
  var ROOT = cs && cs.src ? cs.src.replace(/[^\/?#]*([?#].*)?$/, "") : "";
  var APP = "https://brians124.github.io/YAPSMUSIC.APP/";
  var MODE = document.body.getAttribute("data-hero") || "page"; /* page | hub | song */
  var HUE = [265, 200, 292, 155];

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var asset = function (p) { return /^https?:/.test(p) ? p : APP + encodeURI(p); };
  var ini = function (s) { return s.split(" ").map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase(); };
  var mmss = function (t) { return isFinite(t) ? Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0") : "0:00"; };
  var cov = function (h) { return "linear-gradient(135deg,hsl(" + h + " 0% 48%),hsl(" + (h + 35) + " 0% 16%))"; };
  /* part() + slug() MUST match build-seo.js (link to each song's own page) */
  var part = function (s) { return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, ""); };
  var slug = function (t) { return [part(t.title), part(t.artist), t.id].filter(Boolean).join("-"); };

  /* ---------- download (fetch → file, falls back to opening the mp3) ---------- */
  function download(url, name, btn) {
    var label = btn.innerHTML;
    btn.disabled = true; btn.textContent = "Downloading…";
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (b) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = name.replace(/[\\\/:*?"<>|]+/g, "_") + ".mp3";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    }).catch(function () { window.open(url, "_blank", "noopener"); })
      .then(function () { btn.disabled = false; btn.innerHTML = label; });
  }

  /* ---------- song pages: they ARE the hero. Add Download, a song finder, and let ANY song swap into it ---------- */
  if (MODE === "song") {
    var au = document.querySelector(".hero audio"), acts = document.querySelector(".hero .acts"), h1 = document.querySelector(".hero h1");
    if (au && acts && h1) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.innerHTML = "&#11015; Download";
      b.onclick = function () { var by = document.querySelector(".hero .by a"); download(au.getAttribute("src"), (by ? by.textContent + " - " : "") + h1.textContent, b); };
      acts.insertBefore(b, acts.firstChild);

      var load1 = function () {
        if (!window.YAPS_CAT) return;
        var BY1 = {};
        window.YAPS_CAT.forEach(function (c) { BY1[c[0]] = { id: c[0], title: c[1], artist: c[2], img: c[3], audio: c[4], dur: c[5], genre: c[6] }; });
        var art = document.querySelector(".hero .art"), by = document.querySelector(".hero .by"), facts = document.querySelector(".hero .facts"), appA = acts.querySelector("a.btn.pri");
        function swap(id, push) {
          var s = BY1[id]; if (!s) return;
          h1.textContent = s.title;
          if (by) by.innerHTML = 'by <a href="../artist.html?artist=' + encodeURIComponent(s.artist) + '">' + esc(s.artist) + "</a>";
          if (art) art.innerHTML = esc(ini(s.title)) + '<img src="' + esc(asset(s.img)) + '" alt="' + esc(s.title) + ' cover art" onerror="this.remove()">';
          if (facts) facts.innerHTML = "<span>" + esc(s.genre) + "</span><span>" + esc(s.dur) + "</span><span>Uganda &amp; East Africa</span>";
          if (appA) appA.href = APP + "?track=" + id;
          au.src = asset(s.audio);
          au.play().catch(function () {});
          document.title = s.title + " \u2013 " + s.artist + " | YAPSMusic";
          try { history.replaceState(null, "", slug(s) + ".html"); } catch (e) {}
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        /* any song link on the page (More from…, etc.) loads into this hero instead of reloading the page */
        document.addEventListener("click", function (e) {
          if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !e.target.closest) return;
          var a = e.target.closest("a[href$='.html'],a[href*='?track=']");
          if (!a || a.closest("header,footer,.acts")) return;
          var m = /-(\d+)\.html(?:[?#].*)?$/.exec(a.getAttribute("href") || "") || /[?&]track=(\d+)/.exec(a.getAttribute("href") || "");
          if (!m || !BY1[+m[1]]) return;
          e.preventDefault(); e.stopImmediatePropagation();
          swap(+m[1]);
        }, true);
        /* find any of the songs */
        var f = document.createElement("div");
        f.style.cssText = "position:relative;max-width:560px;margin:0 0 14px";
        f.innerHTML = '<input type="search" placeholder="Find any song to play" autocomplete="off" aria-label="Find a song to play" style="width:100%;padding:11px 16px;border-radius:999px;border:1px solid rgba(214,217,222,.2);background:rgba(255,255,255,.06);color:inherit;font:inherit;font-size:14px"><div hidden style="position:absolute;left:0;right:0;top:46px;max-height:320px;overflow:auto;padding:6px;border-radius:16px;background:rgba(18,19,22,.97);border:1px solid rgba(214,217,222,.2);box-shadow:0 18px 40px rgba(0,0,0,.55);z-index:20"></div>';
        au.parentNode.insertBefore(f, au);
        var q = f.firstChild, r = f.lastChild;
        q.addEventListener("input", function () {
          var t = q.value.trim().toLowerCase();
          if (!t) { r.hidden = true; return; }
          var hits = window.YAPS_CAT.filter(function (c) { return (c[1] + " " + c[2]).toLowerCase().indexOf(t) > -1; }).slice(0, 8);
          r.innerHTML = hits.length ? hits.map(function (c) { return '<button type="button" data-id="' + c[0] + '" style="display:block;width:100%;padding:8px 10px;border:0;border-radius:12px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer"><b style="display:block;font-size:14px">' + esc(c[1]) + '</b><small style="color:#b9bdc4">' + esc(c[2]) + "</small></button>"; }).join("") : '<p style="padding:10px;margin:0;color:#b9bdc4;font-size:14px">No songs found</p>';
          r.hidden = false;
        });
        r.addEventListener("click", function (e) { var bt = e.target.closest("button[data-id]"); if (!bt) return; r.hidden = true; q.value = ""; swap(+bt.getAttribute("data-id")); });
      };
      if (window.YAPS_CAT) load1();
      else { var s1 = document.createElement("script"); s1.src = ROOT + "catalog.js"; s1.onload = load1; document.head.appendChild(s1); }
    }
    return;
  }

  /* ---------- load catalogue, then build the hero player ---------- */
  function boot() {
    if (!window.YAPS_CAT || !window.YAPS_CAT.length) return;
    var ALL = [], BY = {};
    window.YAPS_CAT.forEach(function (c) {
      BY[c[0]] = { id: c[0], title: c[1], artist: c[2], img: c[3], audio: c[4], dur: c[5], genre: c[6], hue: HUE[c[0] % 4] };
      ALL.push(c[0]);
    });
    build(ALL, BY);
  }
  if (window.YAPS_CAT) boot();
  else { var s = document.createElement("script"); s.src = ROOT + "catalog.js"; s.onload = boot; document.head.appendChild(s); }

  function build(ALL, BY) {
    var css = document.createElement("style");
    css.textContent =
      "#bar,#pbar,#mp{display:none!important}" +
      ".hp-wrap{width:100%;margin:0;padding:6px clamp(14px,2vw,40px) 26px;position:relative;z-index:6;scroll-margin-top:92px}" +
      ".hp-wrap.in{padding:4px 0 22px}" +
      ".hp{position:relative;display:grid;grid-template-columns:150px minmax(0,1fr);gap:20px;align-items:center;padding:12px 0;color:var(--txt,#f4f5f7);border-top:1px solid var(--line,rgba(214,217,222,.2));border-bottom:1px solid var(--line,rgba(214,217,222,.2))}" +
      ".hp-art{position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;display:grid;place-items:center;font-weight:800;font-size:34px;color:#ffffffcc;box-shadow:0 10px 24px rgba(0,0,0,.45)}" +
      ".hp-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
      ".hp.playing .hp-art{animation:hpglow 2.2s ease-in-out infinite alternate}" +
      "@keyframes hpglow{from{box-shadow:0 0 0 rgba(160,160,160,0)}to{box-shadow:0 0 40px rgba(190,194,200,.5)}}" +
      ".hp-main{min-width:0}" +
      ".hp-head{display:flex;gap:14px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}" +
      ".hp-info{min-width:0;flex:1 1 220px}" +
      ".hp-kind{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute,#b9bdc4)}" +
      ".hp h3{font-size:clamp(20px,3vw,28px);font-weight:800;letter-spacing:-.01em;line-height:1.15;margin:2px 0;overflow-wrap:anywhere}" +
      ".hp-sub{color:var(--mute,#b9bdc4);font-size:14px;margin:0}" +
      ".hp-find{position:relative;flex:0 1 280px;min-width:200px}" +
      ".hp-find input{width:100%;padding:11px 16px 11px 38px;border-radius:999px;border:1px solid var(--line,rgba(214,217,222,.2));background:rgba(255,255,255,.06);color:inherit;font:inherit;font-size:14px}" +
      ".hp-find input::placeholder{color:var(--mute,#b9bdc4)}" +
      ".hp-find svg{position:absolute;left:13px;top:12px;width:16px;height:16px;stroke:var(--sky,#d2d5da);fill:none;stroke-width:2;pointer-events:none}" +
      ".hp-res{position:absolute;left:0;right:0;top:46px;max-height:320px;overflow:auto;padding:6px;border-radius:16px;background:rgba(18,19,22,.97);border:1px solid var(--line,rgba(214,217,222,.2));box-shadow:0 18px 40px rgba(0,0,0,.55);z-index:20}" +
      ".hp-res[hidden]{display:none}" +
      ".hp-res button{display:flex;width:100%;gap:10px;align-items:center;padding:7px;border:0;border-radius:12px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}" +
      ".hp-res button:hover,.hp-res button:focus-visible{background:rgba(255,255,255,.09)}" +
      ".hp-res .c{position:relative;width:38px;height:38px;border-radius:8px;overflow:hidden;flex:none;display:grid;place-items:center;font-size:11px;font-weight:800}" +
      ".hp-res .c img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
      ".hp-res b{display:block;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".hp-res small{display:block;font-size:12px;color:var(--mute,#b9bdc4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".hp-res div{min-width:0}.hp-res p{padding:10px;font-size:14px;color:var(--mute,#b9bdc4);margin:0}" +
      ".hp-seek{display:flex;align-items:center;gap:10px;margin:12px 0 12px;font-size:12px;color:var(--mute,#b9bdc4)}" +
      ".hp-seek input{flex:1;min-width:0;accent-color:#9aa0a8}" +
      ".hp-btns{display:flex;gap:10px;flex-wrap:wrap;align-items:center}" +
      ".hp .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 20px;border-radius:999px;border:1px solid var(--line,rgba(214,217,222,.2));background:var(--glass,rgba(214,217,222,.1));color:inherit;font:inherit;font-weight:600;font-size:15px;line-height:1.2;cursor:pointer;text-decoration:none;transition:transform .15s,background .2s}" +
      ".hp .btn:hover{transform:translateY(-2px);background:rgba(255,255,255,.14)}" +
      ".hp .btn.pri{background:var(--btn,linear-gradient(100deg,#868b93,#5f636a 50%,#464a50));border:0;color:#fff;min-width:120px;box-shadow:0 8px 24px rgba(0,0,0,.4)}" +
      ".hp .btn.sm{padding:10px 14px;min-width:44px}" +
      ".hp .btn[disabled]{opacity:.6;cursor:progress}" +
      ".hp .lk{font-size:13px;color:var(--sky,#d2d5da);padding:0 4px;text-decoration:underline;text-underline-offset:3px}" +
      ".hp-err{font-size:13px;color:var(--mute,#b9bdc4);margin-top:8px;min-height:0}" +
      "[data-song].on,[data-play].on{outline:0}" +
      "@media(max-width:720px){.hp{grid-template-columns:96px minmax(0,1fr);gap:14px;padding:12px 0}.hp-art{font-size:24px;border-radius:12px}.hp-find{flex:1 1 100%}.hp-btns .btn{flex:1 1 auto}.hp-btns .btn.sm{flex:0 0 auto}}" +
      "@media(max-width:420px){.hp{grid-template-columns:1fr}.hp-art{width:96px}}" +
      "@media(prefers-reduced-motion:reduce){.hp.playing .hp-art{animation:none}}";
    document.head.appendChild(css);

    var wrap = document.createElement("div");
    wrap.className = "hp-wrap";
    wrap.innerHTML =
      '<section class="hp" aria-label="Hero player">' +
      '<div class="hp-art" id="hpArt"></div>' +
      '<div class="hp-main">' +
      '<div class="hp-head"><div class="hp-info"><span class="hp-kind">Now playing</span><h3 id="hpT"></h3><p class="hp-sub" id="hpA"></p></div>' +
      '<div class="hp-find"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input type="search" id="hpQ" placeholder="Find any song to play" autocomplete="off" aria-label="Find a song to play"><div class="hp-res" id="hpR" hidden></div></div></div>' +
      '<div class="hp-seek"><span id="hpC">0:00</span><input type="range" id="hpS" min="0" max="100" step="0.1" value="0" aria-label="Seek"><span id="hpD">0:00</span></div>' +
      '<div class="hp-btns"><button class="btn sm" id="hpPrev" type="button" aria-label="Previous song">&#9198;&#xFE0E;</button>' +
      '<button class="btn pri" id="hpP" type="button">&#9654; Play</button>' +
      '<button class="btn sm" id="hpNext" type="button" aria-label="Next song">&#9197;&#xFE0E;</button>' +
      '<button class="btn" id="hpDl" type="button">&#11015; Download</button>' +
      '<a class="btn" id="hpApp" href="' + APP + '">Open in app</a>' +
      '<a class="lk" id="hpPage" href="#">Song page</a></div>' +
      '<div class="hp-err" id="hpE" role="status"></div>' +
      '<audio id="hpAud" preload="none"></audio></div></section>';

    var $ = function (id) { return wrap.querySelector("#" + id); };
    var aud = $("hpAud"), hp = wrap.firstChild;
    var cur = null, queue = ALL, touched = false;

    /* ---------- placement: right under the page's hero ---------- */
    function findHero() {
      var sel = document.body.getAttribute("data-hero-after");
      if (sel) return document.querySelector(sel);
      var m = document.querySelector("main");
      if (!m) return null;
      for (var i = 0; i < m.children.length; i++) {
        var k = m.children[i];
        if (k === wrap || k.hidden || k.tagName === "SCRIPT") continue;
        if (k.tagName === "H1" || k.querySelector("h1")) return k;
      }
      return m.firstElementChild === wrap ? null : m.firstElementChild;
    }
    function place() {
      var h = findHero();
      if (h && h.parentNode) {
        wrap.classList.toggle("in", h.parentNode.classList.contains("wrap"));
        if (h.nextSibling !== wrap) h.parentNode.insertBefore(wrap, h.nextSibling);
      } else if (!wrap.parentNode) {
        var m = document.querySelector("main") || document.body;
        m.insertBefore(wrap, m.firstChild);
      }
    }
    place();
    var mainEl = document.querySelector("main");
    if (mainEl && window.MutationObserver) {
      var pend = 0;
      new MutationObserver(function () {
        if (pend) return;
        pend = setTimeout(function () { pend = 0; place(); if (!touched) { var f = firstSong(); if (f && (!cur || cur.id !== f)) load(f, false); } }, 60);
      }).observe(mainEl, { childList: true });
    }

    /* ---------- reading song ids off the page ---------- */
    var TRIG = "[data-song],[data-play],a[href*='song/'][href$='.html'],a[href*='?track=']";
    function idOf(el) {
      var v = el.getAttribute("data-song") || el.getAttribute("data-play");
      if (!/^\d+$/.test(v || "")) { var h = el.getAttribute("href") || "", m = /-(\d+)\.html(?:[?#].*)?$/.exec(h) || /[?&]track=(\d+)/.exec(h); v = m && m[1]; }
      return v && BY[+v] ? +v : 0;
    }
    function listIds(scope) {
      var ids = [], seen = {};
      (scope || document).querySelectorAll(TRIG).forEach(function (el) {
        if (wrap.contains(el)) return;
        var id = idOf(el);
        if (id && !seen[id]) { seen[id] = 1; ids.push(id); }
      });
      return ids;
    }
    var firstSong = function () { return listIds()[0] || 0; };

    /* ---------- the player ---------- */
    function paint(s) {
      $("hpArt").style.background = cov(s.hue);
      $("hpArt").innerHTML = esc(ini(s.title)) + '<img src="' + esc(asset(s.img)) + '" alt="' + esc(s.title) + ' cover art" onerror="this.remove()">';
      $("hpT").textContent = s.title;
      $("hpA").textContent = s.artist + " · " + s.genre;
      $("hpD").textContent = s.dur; $("hpC").textContent = "0:00"; $("hpS").value = 0; $("hpE").textContent = "";
      $("hpApp").href = APP + "?track=" + s.id;
      $("hpPage").href = ROOT + "song/" + slug(s) + ".html";
      document.querySelectorAll("[data-song],[data-play]").forEach(function (el) { el.classList.toggle("on", !wrap.contains(el) && idOf(el) === s.id); });
      if ("mediaSession" in navigator && window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: s.title, artist: s.artist, album: "YAPSMusic", artwork: [{ src: asset(s.img) }] });
        navigator.mediaSession.setActionHandler("play", function () { aud.play().catch(function () {}); });
        navigator.mediaSession.setActionHandler("pause", function () { aud.pause(); });
        navigator.mediaSession.setActionHandler("previoustrack", function () { step(-1); });
        navigator.mediaSession.setActionHandler("nexttrack", function () { step(1); });
      }
    }
    function load(id, go, ids) {
      var s = BY[id]; if (!s) return;
      if (ids && ids.length > 1) queue = ids;
      if (queue.indexOf(id) < 0) queue = ALL;
      cur = s; aud.src = asset(s.audio); paint(s);
      if (go) {
        aud.play().catch(function () {});
        var r = wrap.getBoundingClientRect();
        if (r.top < 70 || r.bottom > innerHeight) wrap.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    function step(d) {
      if (!cur) return;
      var i = queue.indexOf(cur.id);
      touched = true;
      load(queue[(i + d + queue.length) % queue.length], true);
    }
    var playing = function () { return !aud.paused && !aud.ended; };
    $("hpP").onclick = function () { touched = true; if (!cur) return; playing() ? aud.pause() : aud.play().catch(function () {}); };
    $("hpPrev").onclick = function () { if (aud.currentTime > 3) aud.currentTime = 0; else step(-1); };
    $("hpNext").onclick = function () { step(1); };
    aud.onplay = aud.onpause = function () {
      var p = playing();
      $("hpP").innerHTML = p ? "&#10074;&#10074; Pause" : "&#9654; Play";
      hp.classList.toggle("playing", p);
    };
    aud.onended = function () { $("hpP").innerHTML = "&#9654; Play"; hp.classList.remove("playing"); if (queue.length > 1) step(1); };
    aud.ontimeupdate = function () { $("hpC").textContent = mmss(aud.currentTime); if (aud.duration) $("hpS").value = aud.currentTime / aud.duration * 100; };
    aud.onloadedmetadata = function () { if (isFinite(aud.duration)) $("hpD").textContent = mmss(aud.duration); };
    aud.onerror = function () { if (aud.getAttribute("src")) $("hpE").textContent = "This song could not load. Try Open in app."; };
    $("hpS").oninput = function () { if (aud.duration) aud.currentTime = $("hpS").value / 100 * aud.duration; };
    $("hpDl").onclick = function () { if (cur) download(asset(cur.audio), cur.artist + " - " + cur.title, $("hpDl")); };

    /* ---------- find any song ---------- */
    var q = $("hpQ"), res = $("hpR");
    q.addEventListener("input", function () {
      var v = q.value.trim().toLowerCase();
      if (!v) { res.hidden = true; return; }
      var m = ALL.filter(function (id) { var s = BY[id]; return (s.title + " " + s.artist + " " + s.genre).toLowerCase().indexOf(v) > -1; }).slice(0, 8);
      res.innerHTML = m.length ? m.map(function (id) {
        var s = BY[id];
        return '<button type="button" data-hp="' + id + '"><span class="c" style="background:' + cov(s.hue) + '">' + esc(ini(s.title)) + '<img src="' + esc(asset(s.img)) + '" alt="" loading="lazy" onerror="this.remove()"></span><div><b>' + esc(s.title) + '</b><small>' + esc(s.artist) + '</small></div></button>';
      }).join("") : "<p>No songs match “" + esc(q.value) + "”. Try an artist or title.</p>";
      res.hidden = false;
    });
    q.addEventListener("keydown", function (e) { if (e.key === "Escape") res.hidden = true; });
    res.addEventListener("click", function (e) {
      var b = e.target.closest("[data-hp]"); if (!b) return;
      touched = true; load(+b.getAttribute("data-hp"), true, ALL); res.hidden = true; q.value = "";
    });
    document.addEventListener("click", function (e) { if (!e.target.closest(".hp-find")) res.hidden = true; });

    /* ---------- tap any song on the page → it loads in the hero ---------- */
    window.addEventListener("click", function (e) {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !e.target.closest) return;
      if (wrap.contains(e.target)) return;
      var trig = e.target.closest(TRIG);
      if (!trig) return;
      var a = e.target.closest("a");
      if (a && a !== trig && trig.contains(a)) return; /* title, artist and app links keep working */
      var id = idOf(trig);
      if (!id) return;
      e.preventDefault(); e.stopImmediatePropagation();
      touched = true;
      if (cur && cur.id === id) { playing() ? aud.pause() : aud.play().catch(function () {}); return; }
      load(id, true, listIds(MODE === "hub" ? document.querySelector("main") : trig.closest("section,main")));
    }, true);

    var f = firstSong();
    load(f || ALL[0], false);
  }
})();
