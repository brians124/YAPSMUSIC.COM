/* YAPSMusic shared site script (loaded with `defer` by every page).
   Small, dependency-free progressive enhancements. Pages work without it, and it
   never rewrites page content, so nothing Google needs to read is affected. */
(function () {
  "use strict";

  /* Highlight the current page in the main nav (if the page didn't already). */
  var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll("header nav a[href]").forEach(function (a) {
    var h = (a.getAttribute("href") || "").split("#")[0].split("?")[0].toLowerCase();
    if (h && h === here && !a.classList.contains("btn")) {
      a.classList.add("on");
      a.setAttribute("aria-current", "page");
    }
  });

  /* Open external links safely. */
  document.querySelectorAll('a[href^="http"]').forEach(function (a) {
    if (a.hostname && a.hostname !== location.hostname) {
      var rel = (a.getAttribute("rel") || "").split(/\s+/).filter(Boolean);
      ["noopener", "noreferrer"].forEach(function (r) { if (rel.indexOf(r) < 0) rel.push(r); });
      a.setAttribute("rel", rel.join(" "));
    }
  });

  /* Close the mobile menu with the Escape key. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var nav = document.getElementById("nav"), b = document.getElementById("burger");
    if (nav && nav.classList.contains("open")) {
      nav.classList.remove("open");
      if (b) b.setAttribute("aria-expanded", "false");
    }
  });
})();
