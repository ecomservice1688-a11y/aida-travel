/* AIDA TRAVEL · Espace admin */
const $ = id => document.getElementById(id);
const ATOKEN_KEY = "aida_admin_token";

const STATUS_LABELS = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  cancelled: "Annulée"
};

let aToken = localStorage.getItem(ATOKEN_KEY) || "";
let me = null;                                  // profil de la session (nom, email, rôle, droits)
let resetToken = new URLSearchParams(location.search).get("reset");

if ($("verBadge")) $("verBadge").textContent = "v3 — page " + (new Date().toISOString());

const TAB_PERM = { bookings: "bookings", clients: "clients", messages: "messages", tours: "tours", departures: "departures", posts: "posts", site: "site", visits: "visits", users: "users" };
const PERM_LABELS = { bookings: "Réservations", clients: "Clients", messages: "Messages", tours: "Circuits", departures: "Départs", posts: "Articles", site: "Site", visits: "Visites" };
function can(key) { return !!(me && (me.role === "admin" || (me.perms && me.perms[key]))); }

async function api(path, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 28000);
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", "X-Admin-Token": aToken },
    signal: ctrl.signal,
    ...opts
  }).catch(err => {
    clearTimeout(t);
    if (err.name === "AbortError") throw new Error("Le serveur met du temps à répondre (réveil ?). Réessayez dans quelques secondes.");
    throw err;
  });
  clearTimeout(t);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

const qs = obj => new URLSearchParams(obj).toString();
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString("fr-FR") : "—"; }
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR") + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function statusHTML(s) { return `<span class="badge ${s}">${STATUS_LABELS[s] || s}</span>`; }
function fmtPrice(n) { return n.toLocaleString("fr-FR") + " €"; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function digits(p) { return String(p || "").replace(/\D/g, ""); }
function ctaBtns(email, phone) {
  const parts = [];
  const d = digits(phone);
  if (d) parts.push(`<a class="btn cta wa" href="https://wa.me/${d}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (d) parts.push(`<a class="btn cta tel" href="tel:+${d}">Appeler</a>`);
  if (email) parts.push(`<a class="btn cta mail" href="mailto:${esc(email)}">Email</a>`);
  return parts.length ? `<div class="cta-wrap">${parts.join("")}</div>` : "";
}

/* ---------- Auth ---------- */
window.addEventListener("error", e => {
  const b = $("errBanner");
  if (b) { b.textContent = "Erreur : " + (e.message || e.error || "inconnue"); b.classList.remove("hidden"); }
});
window.addEventListener("unhandledrejection", e => {
  const b = $("errBanner");
  if (b) { b.textContent = "Erreur : " + (e.reason && e.reason.message || e.reason || "inconnue"); b.classList.remove("hidden"); }
});
$("adminLogin").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("adminLogin").querySelector("button[type=submit]");
  const msg = $("adMsg");
  msg.classList.add("hidden");
  const prev = btn.textContent;
  btn.textContent = "Connexion…"; btn.disabled = true;
  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ email: $("adUser").value, password: $("adPass").value })
    });
    aToken = data.token;
    me = data.me || null;
    localStorage.setItem(ATOKEN_KEY, aToken);
    enterDash();
  } catch (err) { msg.textContent = "Échec : " + err.message; msg.classList.remove("hidden"); }
  finally { btn.textContent = prev; btn.disabled = false; }
});

$("logoutBtn").addEventListener("click", () => {
  aToken = ""; me = null; localStorage.removeItem(ATOKEN_KEY);
  stopPolling();
  $("dashView").classList.add("hidden"); $("loginView").classList.remove("hidden");
});

function enterDash() {
  $("loginView").classList.add("hidden");
  $("dashView").classList.remove("hidden");
  $("barUser").textContent = me.name + (me.role === "admin" ? " · (admin)" : "");
  $("logoutBtn").classList.remove("hidden");
  document.querySelectorAll(".tab[data-tab]").forEach(tab => {
    const k = TAB_PERM[tab.dataset.tab];
    tab.classList.toggle("hidden", !can(k));
    if (!can(k)) $("tab-" + tab.dataset.tab).classList.add("hidden");
  });
  loadStats();
  if (can("bookings")) { loadBookings(); populateManualTours(); }
  if (can("clients")) loadClients();
  if (can("messages")) loadMessages();
  if (can("tours")) loadToursAdmin();
  if (can("departures")) loadDepartures();
  if (can("posts")) loadPosts();
  if (can("site")) loadSiteData();
  if (can("visits")) loadVisits();
  if (can("users")) loadUsers();
  startPolling();
}

/* ---------- Stats ---------- */
async function loadStats() {
  try {
    const s = await api("/api/admin/stats");
    $("statsRow").innerHTML = `
      <div class="stat-card"><div class="n">${s.bookings}</div><div class="l">Réservations</div></div>
      <div class="stat-card"><div class="n">${s.clients}</div><div class="l">Clients</div></div>
      <div class="stat-card dark"><div class="n">${s.revenue.toLocaleString("fr-FR")} €</div><div class="l">Chiffre d'affaires (confirmées + payées)</div></div>
      <div class="stat-card"><div class="n">${s.pending}</div><div class="l">En attente</div></div>
      <div class="stat-card"><div class="n">${(s.visits || 0).toLocaleString("fr-FR")}</div><div class="l">Visites</div></div>`;
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}

/* ---------- Onglets ---------- */
document.querySelectorAll(".tab[data-tab]").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab[data-tab]").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    ["bookings", "clients", "messages", "tours", "departures", "posts", "site", "users", "visits"].forEach(t => $("tab-" + t).classList.toggle("hidden", t !== tab.dataset.tab));
  });
});

/* ---------- Réservation manuelle ---------- */
$("manualToggle").addEventListener("click", () => $("manualForm").classList.toggle("hidden"));
$("mbCancel").addEventListener("click", () => { $("manualForm").classList.add("hidden"); $("manualForm").reset(); });
async function populateManualTours() {
  try {
    const tours = await api("/api/admin/tours");
    $("mbTour").innerHTML = '<option value="">Sur mesure / autre</option>' + tours.map(t => `<option value="${t.id}">${t.title} — ${t.loc || ""}</option>`).join("");
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}
$("manualForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/admin/bookings", {
      method: "POST",
      body: JSON.stringify({
        name: $("mbName").value, email: $("mbEmail").value, phone: $("mbPhone").value,
        tourId: $("mbTour").value, date: $("mbDate").value,
        travellers: $("mbTravellers").value || "1", price: $("mbPrice").value, message: $("mbMsg").value
      })
    });
    $("manualForm").reset(); $("manualForm").classList.add("hidden");
    loadStats(); loadBookings(); loadClients();
  } catch (err) { alert("Erreur : " + err.message); }
});

/* ---------- Réservations ---------- */
async function loadBookings() {
  try {
    const list = await api("/api/admin/bookings");
    const tb = $("bkTable");
    if (!list.length) { $("bkEmpty").classList.remove("hidden"); tb.innerHTML = ""; return; }
    $("bkEmpty").classList.add("hidden");
    tb.innerHTML = list.map(b => `
      <tr>
        <td>
          <b>${esc(b.clientName)}</b><br>
          <a href="mailto:${esc(b.clientEmail)}" style="color:#1A5FB4">${esc(b.clientEmail)}</a>
          ${b.clientPhone ? `<br><b>📞 ${esc(b.clientPhone)}</b>` : ""}
          ${ctaBtns(b.clientEmail, b.clientPhone)}
        </td>
        <td>
          <b>${esc(b.tourTitle)}</b><br><small>${esc(b.tourLoc || "")} · n° ${esc(b.id)}</small>
          ${b.message ? `<div class="note"><b>Demande :</b> ${esc(b.message)}</div>` : ""}
        </td>
        <td>${b.tripDate || "—"}</td>
        <td>${b.travellers}</td>
        <td>${b.price > 0 ? `<b>${fmtPrice(b.price)}</b>` : `<span class="muted">Sur devis</span>`}</td>
        <td><small>${fmtDateTime(b.createdAt)}</small></td>
        <td>
          <select class="status" data-id="${b.id}">
            ${["pending", "confirmed", "paid", "cancelled"].map(s =>
              `<option value="${s}" ${b.status === s ? "selected" : ""}>${STATUS_LABELS[s]}</option>`).join("")}
          </select>
        </td>
        <td style="white-space:nowrap"><button type="button" class="btn small danger" data-del-book="${b.id}">Supprimer</button></td>
      </tr>
    `).join("");
    tb.querySelectorAll(".status").forEach(sel => {
      sel.addEventListener("change", async () => {
        try {
          await api("/api/admin/bookings/" + sel.dataset.id, {
            method: "PATCH",
            body: JSON.stringify({ status: sel.value })
          });
          loadStats(); loadBookings();
        } catch (e) { alert(e.message); loadBookings(); }
      });
    });
    tb.querySelectorAll("[data-del-book]").forEach(b => b.addEventListener("click", () => delBooking(b.dataset.delBook)));
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}

/* ---------- Clients ---------- */
async function loadClients() {
  try {
    const list = await api("/api/admin/clients");
    const tb = $("clTable");
    if (!list.length) { $("clEmpty").classList.remove("hidden"); tb.innerHTML = ""; return; }
    $("clEmpty").classList.add("hidden");
    tb.innerHTML = list.map(c => `
      <tr>
        <td><b>${esc(c.name)}</b></td>
        <td><a href="mailto:${esc(c.email)}" style="color:#1A5FB4">${esc(c.email)}</a></td>
        <td>${c.phone ? `<b>📞 ${esc(c.phone)}</b>` : "—"}</td>
        <td>${ctaBtns(c.email, c.phone)}</td>
        <td>${c.bookings}</td>
        <td><small>${fmtDate(c.createdAt)}</small></td>
        <td style="white-space:nowrap">
          <button type="button" class="btn small danger" data-del-clien="${c.id}">Supprimer</button>
</td>
      </tr>`).join("");
    tb.querySelectorAll("[data-del-clien]").forEach(b => b.addEventListener("click", () => delClient(b.dataset.delClien)));
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}

async function delClient(id) {
  if (!confirm("Supprimer ce client et ses réservations ?")) return;
  try { await api("/api/admin/clients/" + id, { method: "DELETE" }); loadClients(); loadBookings(); loadStats(); }
  catch (e) { alert(e.message); }
}
async function delBooking(id) {
  if (!confirm("Supprimer cette réservation ?")) return;
  try { await api("/api/admin/bookings/" + id, { method: "DELETE" }); loadBookings(); loadClients(); loadStats(); }
  catch (e) { alert(e.message); }
}

/* ---------- Messages ---------- */
async function loadMessages() {
  try {
    const list = await api("/api/admin/messages");
    const el = $("msgList");
    if (!list.length) { $("msgEmpty").classList.remove("hidden"); el.innerHTML = ""; return; }
    $("msgEmpty").classList.add("hidden");
    el.innerHTML = list.map(m => `
      <div class="msg-item ${m.read ? "" : "unread"}">
        <div class="m-main">
          <div class="m-head">
            <b>${esc(m.name)}</b>
            ${m.validated ? `<span class="badge paid">Validé → réservation</span>` : ""}
          </div>
          <div class="client-card">
            <div class="cf"><span class="c-label">Email</span><a class="c-val" href="mailto:${esc(m.email)}">${esc(m.email)}</a></div>
            <div class="cf"><span class="c-label">Numéro</span><span class="c-val">${m.phone ? esc(m.phone) : "non renseigné"}</span></div>
            <div class="cf"><span class="c-label">Recherché</span><span class="c-val">${esc(m.subject || "—")}</span></div>
            <div class="cf"><span class="c-label">Reçu</span><span class="c-val">${fmtDateTime(m.createdAt)}</span></div>
          </div>
          <p class="m-msg">${esc(m.message)}</p>
          <div class="m-contact">${ctaBtns(m.email, m.phone)}</div>
        </div>
        <div class="m-actions">
          ${m.validated ? "" : `<button class="btn small wa-green" data-valid="${m.id}">✓ Valider → Réservation</button>`}
          ${m.read ? "" : `<button class="btn small ghost" data-read="${m.id}">Marquer lu</button>`}
          <button class="btn small danger" data-delmsg="${m.id}">Supprimer</button>
        </div>
      </div>`).join("");
    const unread = list.filter(m => !m.read).length;
    $("msgCount").textContent = unread ? `( ${unread} )` : "";
    if ($("msgUpdated")) $("msgUpdated").textContent = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    el.querySelectorAll("[data-valid]").forEach(b => b.addEventListener("click", async () => {
      try {
        const r = await api("/api/admin/messages/validate", { method: "POST", body: JSON.stringify({ id: b.dataset.valid }) });
        loadMessages(); loadBookings(); loadClients(); loadStats();
        alert("Message validé : la réservation n° " + r.booking.id + " a été créée et le client est enregistré.");
      } catch (e) { alert("Erreur : " + e.message); }
    }));
    el.querySelectorAll("[data-read]").forEach(b => b.addEventListener("click", async () => {
      await api("/api/admin/messages/read", { method: "POST", body: JSON.stringify({ id: b.dataset.read }) });
      loadMessages(); loadStats();
    }));
    el.querySelectorAll("[data-delmsg]").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Supprimer ce message ?")) return;
      await api("/api/admin/messages/" + b.dataset.delmsg, { method: "DELETE" });
      loadMessages(); loadStats();
    }));
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}

/* ---------- Circuits (admin) ---------- */
let tourEditId = null;
async function loadToursAdmin() {
  try {
    const tours = await api("/api/admin/tours");
    const tb = $("toursTable");
    $("toursEmpty").classList.toggle("hidden", tours.length > 0);
    tb.innerHTML = tours.map(t => `
      <tr>
        <td><img src="${t.image || "img/hero-djanet.jpg"}" alt="" style="width:70px;height:46px;object-fit:cover;border-radius:6px"></td>
        <td><b>${t.title}</b><br><small class="muted">${t.loc || "—"}</small></td>
        <td>${t.priceHidden ? `<span class="muted">Sur devis</span>` : `<b>${t.price} €</b>`}</td>
        <td>${t.days || "—"}</td>
        <td style="white-space:nowrap">
          <button class="btn small ghost" data-edit-tour="${t.id}">Modifier</button>
          <button class="btn small danger" data-del-tour="${t.id}">Supprimer</button>
        </td>
      </tr>`).join("");
    tb.querySelectorAll("[data-edit-tour]").forEach(b => b.addEventListener("click", () => fillTourForm(b.dataset.editTour)));
    tb.querySelectorAll("[data-del-tour]").forEach(b => b.addEventListener("click", () => delTour(b.dataset.delTour)));
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}
async function fillTourForm(id) {
  const tours = await api("/api/admin/tours");
  const t = tours.find(x => x.id === id);
  if (!t) return;
  tourEditId = id;
  pendingImage = null;
  $("tTitle").value = t.title; $("tLoc").value = t.loc; $("tPrice").value = t.price; $("tDays").value = t.days;
  $("tDesc").value = t.desc || ""; $("tTags").value = (t.tags || []).join(" ; ");
  $("tImageUrl").value = t.image || ""; $("tImageFile").value = "";
  $("tPreview").src = t.image || "img/hero-djanet.jpg";
  if ($("tPriceHidden")) $("tPriceHidden").checked = !!t.priceHidden;
  $("tourSubmit").textContent = "Enregistrer"; $("tourCancel").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function delTour(id) {
  if (!confirm("Supprimer ce circuit ?")) return;
  await api("/api/admin/tours/" + id, { method: "DELETE" });
  loadToursAdmin(); loadTourSelect();
}

let pendingImage = null;
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ data: String(r.result).split(",")[1] || "", mime: file.type });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
$("tImageFile").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("tPreview").src = r.result; pendingImage = f; };
  r.readAsDataURL(f);
});

$("tourForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    let image = $("tImageUrl").value.trim();
    if (pendingImage) {
      const up = await readFileAsBase64(pendingImage);
      const resp = await api("/api/admin/upload", { method: "POST", body: JSON.stringify(up) });
      image = resp.url;
    }
    const payload = {
      title: $("tTitle").value, loc: $("tLoc").value, price: $("tPrice").value, days: $("tDays").value,
      desc: $("tDesc").value, tags: $("tTags").value, image
    };
    if ($("tPriceHidden")) payload.priceHidden = $("tPriceHidden").checked;
    if (tourEditId) await api("/api/admin/tours/" + tourEditId, { method: "PATCH", body: JSON.stringify(payload) });
    else await api("/api/admin/tours", { method: "POST", body: JSON.stringify(payload) });
    tourEditId = null; pendingImage = null; $("tourForm").reset();
    $("tPreview").src = "img/hero-djanet.jpg";
    $("tourSubmit").textContent = "Ajouter"; $("tourCancel").classList.add("hidden");
    loadToursAdmin(); loadTourSelect();
  } catch (err) { alert("Erreur : " + err.message); }
});
$("tourCancel").addEventListener("click", () => {
  tourEditId = null; pendingImage = null; $("tourForm").reset();
  $("tPreview").src = "img/hero-djanet.jpg";
  if ($("tPriceHidden")) $("tPriceHidden").checked = false;
  $("tourSubmit").textContent = "Ajouter"; $("tourCancel").classList.add("hidden");
});

/* ---------- Départs (admin) ---------- */
let depEditId = null;
async function loadTourSelect() {
  const tours = await api("/api/admin/tours");
  $("depTour").innerHTML = tours.map(t => `<option value="${t.id}">${t.title} — ${t.loc || ""}</option>`).join("");
}
async function loadDepartures() {
  try {
    await loadTourSelect();
    const list = await api("/api/admin/departures");
    const tb = $("depsTable");
    $("depsEmpty").classList.toggle("hidden", list.length > 0);
    tb.innerHTML = list.map(d => `
      <tr>
        <td><b>${d.date}</b></td>
        <td>${d.tourTitle}</td>
        <td>${d.places} places</td>
        <td style="white-space:nowrap">
          <button class="btn small ghost" data-edit-dep="${d.id}">Modifier</button>
          <button class="btn small danger" data-del-dep="${d.id}">Supprimer</button>
        </td>
      </tr>`).join("");
    tb.querySelectorAll("[data-edit-dep]").forEach(b => b.addEventListener("click", () => fillDepForm(b.dataset.editDep)));
    tb.querySelectorAll("[data-del-dep]").forEach(b => b.addEventListener("click", async () => {
      if (confirm("Supprimer ce départ ?")) { await api("/api/admin/departures/" + b.dataset.delDep, { method: "DELETE" }); loadDepartures(); }
    }));
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}
async function fillDepForm(id) {
  const list = await api("/api/admin/departures");
  const d = list.find(x => x.id === id);
  if (!d) return;
  depEditId = id;
  $("depTour").value = d.tourId; $("depDate").value = d.date; $("depPlaces").value = d.places;
  $("depSubmit").textContent = "Enregistrer"; $("depCancel").classList.remove("hidden");
}
$("depForm").addEventListener("submit", async e => {
  e.preventDefault();
  const payload = { tourId: $("depTour").value, date: $("depDate").value, places: $("depPlaces").value };
  if (depEditId) await api("/api/admin/departures/" + depEditId, { method: "PATCH", body: JSON.stringify(payload) });
  else await api("/api/admin/departures", { method: "POST", body: JSON.stringify(payload) });
  depEditId = null; $("depForm").reset(); $("depPlaces").value = 8;
  $("depSubmit").textContent = "Ajouter"; $("depCancel").classList.add("hidden");
  loadDepartures();
});
$("depCancel").addEventListener("click", () => {
  depEditId = null; $("depForm").reset(); $("depPlaces").value = 8;
  $("depSubmit").textContent = "Ajouter"; $("depCancel").classList.add("hidden");
});

/* ---------- Articles (admin) ---------- */
let postEditId = null;
async function loadPosts() {
  try {
    const list = await api("/api/posts");
    const tb = $("postsTable");
    tb.innerHTML = list.map(p => `
      <tr>
        <td><b>${p.title}</b></td>
        <td>${p.author}</td>
        <td>${fmtDate(p.createdAt)}</td>
        <td style="white-space:nowrap">
          <a class="btn small ghost" href="/blog.html?post=${p.id}" target="_blank">Voir</a>
          <button class="btn small ghost" data-edit-post="${p.id}">Modifier</button>
          <button class="btn small danger" data-del-post="${p.id}">Supprimer</button>
        </td>
      </tr>`).join("");
    tb.querySelectorAll("[data-edit-post]").forEach(b => b.addEventListener("click", () => fillPostForm(b.dataset.editPost)));
    tb.querySelectorAll("[data-del-post]").forEach(b => b.addEventListener("click", async () => {
      if (confirm("Supprimer cet article ?")) { await api("/api/admin/posts/" + b.dataset.delPost, { method: "DELETE" }); loadPosts(); }
    }));
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}
async function fillPostForm(id) {
  const list = await api("/api/posts");
  const p = list.find(x => x.id === id);
  const full = await api("/api/posts/" + id);
  if (!p) return;
  postEditId = id;
  $("pTitle").value = p.title; $("pExcerpt").value = p.excerpt; $("pAuthor").value = p.author; $("pContent").value = full.content || "";
  $("postSubmit").textContent = "Enregistrer"; $("postCancel").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$("postForm").addEventListener("submit", async e => {
  e.preventDefault();
  const payload = { title: $("pTitle").value, excerpt: $("pExcerpt").value, author: $("pAuthor").value, content: $("pContent").value };
  if (postEditId) await api("/api/admin/posts/" + postEditId, { method: "PATCH", body: JSON.stringify(payload) });
  else await api("/api/admin/posts", { method: "POST", body: JSON.stringify(payload) });
  postEditId = null; $("postForm").reset();
  $("postSubmit").textContent = "Publier"; $("postCancel").classList.add("hidden");
  loadPosts();
});
$("postCancel").addEventListener("click", () => {
  postEditId = null; $("postForm").reset();
  $("postSubmit").textContent = "Publier"; $("postCancel").classList.add("hidden");
});

/* ---------- Site (admin) ---------- */
let gallery = [];
function bindSiteUpload(fileId, urlId, prevId) {
  $(fileId).addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const up = await readFileAsBase64(f);
      const resp = await api("/api/admin/upload", { method: "POST", body: JSON.stringify(up) });
      $(urlId).value = resp.url;
      $(prevId).src = resp.url;
    } catch (err) { alert("Erreur upload : " + err.message); }
  });
}
async function loadSiteData() {
  try {
    const s = await api("/api/site");
    bindSiteUpload("sHeroFile", "sHeroUrl", "sHeroPrev");
    bindSiteUpload("sAboutFile", "sAboutUrl", "sAboutPrev");
    for (let i = 0; i < 3; i++) bindSiteUpload("sTeam" + i + "File", "sTeam" + i + "Photo", "sTeam" + i + "Prev");
    $("sHeroUrl").value = s.hero || ""; $("sHeroPrev").src = s.hero || "";
    $("sAboutUrl").value = s.about || ""; $("sAboutPrev").src = s.about || "";
    (s.team || []).forEach((m, i) => {
      if (i > 2) return;
      $("sTeam" + i + "Name").value = m.name || "";
      $("sTeam" + i + "Role").value = m.role || "";
      $("sTeam" + i + "Photo").value = m.photo || "";
      $("sTeam" + i + "Prev").src = m.photo || "";
    });
    gallery = (s.gallery || []).slice(0, 12);
    renderGallery();
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}
function renderGallery() {
  const wrap = $("galList");
  if (!gallery.length) { wrap.innerHTML = '<p class="muted empty">Aucune photo. Ajoutez des photos ci-dessous.</p>'; }
  else {
    wrap.innerHTML = gallery.map((url, i) => `
      <div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--sand-2);border-radius:10px;padding:6px 10px">
        <img src="${esc(url)}" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0">
        <span class="muted" style="flex:1;font-size:11px;word-break:break-all;line-height:1.4">${i + 1}. ${esc(url)}</span>
        <button type="button" class="btn small ghost" data-gmove="${i}:up" title="Monter">↑</button>
        <button type="button" class="btn small ghost" data-gmove="${i}:down" title="Descendre">↓</button>
        <button type="button" class="btn small danger" data-gdel="${i}" title="Retirer">✕</button>
      </div>`).join("");
  }
  $("sGallery").value = gallery.join("\n");
  const msg = $("galMsg");
  msg.textContent = gallery.length + "/12 photo(s) — utilisez ↑ ↓ pour ordonner, ✕ pour retirer.";
}
$("galList").addEventListener("click", e => {
  const mv = e.target.closest("[data-gmove]");
  const del = e.target.closest("[data-gdel]");
  if (mv) {
    const [i, dir] = mv.dataset.gmove.split(":");
    const x = +i, y = dir === "up" ? x - 1 : x + 1;
    if (y < 0 || y >= gallery.length) return;
    [gallery[x], gallery[y]] = [gallery[y], gallery[x]];
    renderGallery();
  } else if (del) {
    gallery.splice(+del.dataset.gdel, 1);
    renderGallery();
  }
});
$("gFile").addEventListener("change", async e => {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  if (!files.length) return;
  const btn = $("gAddUrl"); btn.textContent = "Envoi des photos…"; btn.disabled = true;
  try {
    for (const f of files) {
      if (gallery.length >= 12) { alert("Maximum 12 photos atteint."); break; }
      const up = await readFileAsBase64(f);
      const resp = await api("/api/admin/upload", { method: "POST", body: JSON.stringify(up) });
      gallery.push(resp.url);
      renderGallery();
    }
  } catch (err) { alert("Erreur d'envoi : " + err.message); }
  finally { btn.textContent = "Ajouter l'URL"; btn.disabled = false; }
});
$("gAddUrl").addEventListener("click", () => {
  if (gallery.length >= 12) { alert("Maximum 12 photos atteint."); return; }
  const url = $("gUrl").value.trim();
  if (!url) return;
  gallery.push(url);
  $("gUrl").value = "";
  renderGallery();
});
$("siteForm").addEventListener("submit", async e => {
  e.preventDefault();
  const team = [0, 1, 2].map(i => ({
    name: $("sTeam" + i + "Name").value,
    role: $("sTeam" + i + "Role").value,
    photo: $("sTeam" + i + "Photo").value.trim()
  }));
  const gallery = $("sGallery").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  try {
    await api("/api/admin/site", {
      method: "PATCH",
      body: JSON.stringify({ hero: $("sHeroUrl").value.trim(), about: $("sAboutUrl").value.trim(), team, gallery })
    });
    const ok = $("siteSaved"); ok.textContent = "✅ Site mis à jour !";
    setTimeout(() => { ok.textContent = ""; }, 4000);
  } catch (err) { alert("Erreur : " + err.message); }
});

/* ---------- Visites (admin) ---------- */
async function loadVisits() {
  try {
    const v = await api("/api/admin/visits");
    const cards = $("visitStats").children;
    cards[0].querySelector(".n").textContent = v.total.toLocaleString("fr-FR");
    cards[1].querySelector(".n").textContent = v.today.toLocaleString("fr-FR");
    cards[2].querySelector(".n").textContent = v.unique.toLocaleString("fr-FR");
    const top = $("visitTop");
    const max = v.top.length ? v.top[0].count : 1;
    top.innerHTML = v.top.length
      ? v.top.map(c => `
          <li>
            <span class="cname">${esc(c.name)}</span>
            <div class="cbar"><i style="width:${Math.round(c.count / max * 100)}%"></i></div>
            <span class="ccount">${c.count}</span>
          </li>`).join("")
      : `<li class="muted">Pas encore de données.</li>`;
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ---------- Mot de passe oublié ---------- */
$("forgotLink").addEventListener("click", e => { e.preventDefault(); $("forgotBox").classList.toggle("hidden"); });
$("forgotGo").addEventListener("click", async () => {
  const em = $("forgotEmail").value.trim();
  if (!em) return;
  const btn = $("forgotGo"); btn.disabled = true;
  try {
    const r = await api("/api/admin/forgot", { method: "POST", body: JSON.stringify({ email: em }) });
    $("forgotMsg").textContent = r.via === "console"
      ? "Lien de réinitialisation généré : regarde la console du serveur."
      : "Si cet e-mail existe, un lien vient d'être envoyé (valable 15 minutes).";
  } catch (e) { $("forgotMsg").textContent = "Erreur : " + e.message; }
  btn.disabled = false;
});

/* ---------- Réinitialisation (lien reçu) ---------- */
$("adminReset").addEventListener("submit", async e => {
  e.preventDefault();
  const m = $("rsMsg"); m.classList.add("hidden");
  if ($("rsPass").value !== $("rsPass2").value) {
    m.textContent = "Les deux mots de passe ne correspondent pas."; m.classList.remove("hidden"); return;
  }
  try {
    await api("/api/admin/reset", { method: "POST", body: JSON.stringify({ token: resetToken, password: $("rsPass").value }) });
    $("resetView").classList.add("hidden"); $("loginView").classList.remove("hidden");
    const ok = $("adMsg");
    ok.classList.remove("err"); ok.classList.add("ok");
    ok.textContent = "Mot de passe changé. Connectez-vous avec le nouveau mot de passe.";
    ok.classList.remove("hidden");
    $("rsPass").value = ""; $("rsPass2").value = ""; resetToken = null;
  } catch (err) { m.textContent = err.message; m.classList.remove("hidden"); }
});

/* ---------- Équipe (comptes) ---------- */
let userEditId = null;
function renderPermGrid(perms) {
  $("permGrid").innerHTML = Object.entries(PERM_LABELS)
    .map(([k, lab]) => `<label><input type="checkbox" class="uperm" value="${k}" ${perms && perms[k] ? "checked" : ""}> ${lab}</label>`)
    .join("");
}
async function loadUsers() {
  try {
    const list = await api("/api/admin/users");
    const tb = $("usersTable");
    $("usersEmpty").classList.toggle("hidden", list.length > 0);
    tb.innerHTML = list.map(u => {
      const acc = Object.entries(PERM_LABELS).filter(([k]) => u.perms && u.perms[k]).map(([, lab]) => lab).join(", ") || "—";
      return `<tr>
        <td><b>${esc(u.name)}</b></td>
        <td>${esc(u.email)}</td>
        <td>${u.role === "admin" ? `<span class="badge paid">Admin</span>` : `<span class="badge pending">Membre</span>`}</td>
        <td><small>${acc}</small></td>
        <td style="white-space:nowrap">
          <button class="btn small ghost" data-edit-user="${u.id}">Modifier</button>
          <button class="btn small danger" data-del-user="${u.id}">Supprimer</button>
        </td></tr>`;
    }).join("");
    tb.querySelectorAll("[data-edit-user]").forEach(b => b.addEventListener("click", () => fillUserForm(b.dataset.editUser)));
    tb.querySelectorAll("[data-del-user]").forEach(b => b.addEventListener("click", () => delUser(b.dataset.delUser)));
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}
async function fillUserForm(id) {
  const list = await api("/api/admin/users");
  const u = list.find(x => x.id === id);
  if (!u) return;
  userEditId = id;
  $("uName").value = u.name; $("uEmail").value = u.email; $("uRole").value = u.role;
  $("uPass").value = ""; $("uPass").placeholder = "Laisser vide pour ne pas changer";
  renderPermGrid(u.perms);
  $("userSubmit").textContent = "Enregistrer"; $("userCancel").classList.remove("hidden");
  $("userMsg").classList.add("hidden");
}
function userFormPerms() {
  const o = {};
  document.querySelectorAll("#permGrid .uperm:checked").forEach(c => { o[c.value] = true; });
  return o;
}
$("userForm").addEventListener("submit", async e => {
  e.preventDefault();
  const payload = { name: $("uName").value, email: $("uEmail").value, role: $("uRole").value, perms: userFormPerms() };
  const pw = $("uPass").value;
  if (pw) payload.password = pw;
  try {
    if (userEditId) await api("/api/admin/users/" + userEditId, { method: "PATCH", body: JSON.stringify(payload) });
    else await api("/api/admin/users", { method: "POST", body: JSON.stringify(payload) });
    userEditId = null; $("userForm").reset(); $("uPass").placeholder = ""; renderPermGrid({});
    $("userSubmit").textContent = "Ajouter"; $("userCancel").classList.add("hidden");
    loadUsers();
  } catch (err) { const m = $("userMsg"); m.textContent = err.message; m.classList.remove("hidden"); }
});
$("userCancel").addEventListener("click", () => {
  userEditId = null; $("userForm").reset(); $("uPass").placeholder = ""; renderPermGrid({});
  $("userSubmit").textContent = "Ajouter"; $("userCancel").classList.add("hidden");
});
async function delUser(id) {
  if (!confirm("Supprimer ce compte ?")) return;
  try { await api("/api/admin/users/" + id, { method: "DELETE" }); loadUsers(); }
  catch (e) { alert(e.message); }
}

/* ---------- Actualisation automatique (temps réel Messages) ---------- */
let pollTimer = null;
function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
          if (can("messages")) await loadMessages();
          if (can("bookings")) await loadBookings();
          if (can("visits")) await loadVisits();
        } catch (e) { if (e && e.message === "Accès refusé") handleAuth(); }
  }, 8000);
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

/* ---------- Session invalide ---------- */
function handleAuth() {
  aToken = ""; me = null; localStorage.removeItem(ATOKEN_KEY);
  stopPolling();
  $("dashView").classList.add("hidden"); $("loginView").classList.remove("hidden");
}

/* ---------- Init ---------- */
if (resetToken) {
  window.history.replaceState({}, "", location.pathname);
  $("loginView").classList.add("hidden");
  $("resetView").classList.remove("hidden");
}
if (aToken) {
  api("/api/admin/stats").then(s => { me = s.me || null; renderPermGrid({}); enterDash(); }).catch(() => handleAuth());
} else {
  handleAuth();
}