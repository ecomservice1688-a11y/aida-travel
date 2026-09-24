/* AIDA TRAVEL · Suivi de visites (pays d'origine) */
(function () {
  try {
    const page = location.pathname.split("/").pop() || "/";
    const ref = document.referrer || "";
    const body = JSON.stringify({ page, ref });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/visit", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    }
  } catch (e) { /* silencieux */ }
})();