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

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", "X-Admin-Token": aToken },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

const qs = obj => new URLSearchParams(obj).toString();
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString("fr-FR") : "—"; }
function statusHTML(s) { return `<span class="badge ${s}">${STATUS_LABELS[s] || s}</span>`; }
function fmtPrice(n) { return n.toLocaleString("fr-FR") + " €"; }

/* ---------- Auth ---------- */
$("adminLogin").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("adMsg"); msg.classList.add("hidden");
  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username: $("adUser").value, password: $("adPass").value })
    });
    aToken = data.token;
    localStorage.setItem(ATOKEN_KEY, aToken);
    enterDash();
  } catch (err) { msg.textContent = err.message; msg.classList.remove("hidden"); }
});

$("logoutBtn").addEventListener("click", () => {
  aToken = ""; localStorage.removeItem(ATOKEN_KEY);
  $("dashView").classList.add("hidden"); $("loginView").classList.remove("hidden");
});

function enterDash() {
  $("loginView").classList.add("hidden");
  $("dashView").classList.remove("hidden");
  $("barUser").textContent = "admin";
  $("logoutBtn").classList.remove("hidden");
  loadStats(); loadBookings(); loadClients(); loadMessages();
  loadToursAdmin(); loadDepartures(); loadPosts(); loadSiteData();
}

/* ---------- Stats ---------- */
async function loadStats() {
  try {
    const s = await api("/api/admin/stats");
    $("statsRow").innerHTML = `
      <div class="stat-card"><div class="n">${s.bookings}</div><div class="l">Réservations</div></div>
      <div class="stat-card"><div class="n">${s.clients}</div><div class="l">Clients</div></div>
      <div class="stat-card dark"><div class="n">${s.revenue.toLocaleString("fr-FR")} €</div><div class="l">Chiffre d'affaires (confirmées + payées)</div></div>
      <div class="stat-card"><div class="n">${s.pending}</div><div class="l">En attente</div></div>`;
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}

/* ---------- Onglets ---------- */
document.querySelectorAll(".tab[data-tab]").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab[data-tab]").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    ["bookings", "clients", "messages", "tours", "departures", "posts", "site"].forEach(t => $("tab-" + t).classList.toggle("hidden", t !== tab.dataset.tab));
  });
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
        <td><b>${b.clientName}</b><br><small>${b.clientEmail}</small></td>
        <td><b>${b.tourTitle}</b><br><small>${b.tourLoc} · n° ${b.id}</small></td>
        <td>${b.tripDate || "—"}</td>
        <td>${b.travellers}</td>
        <td><b>${fmtPrice(b.price)}</b></td>
        <td><small>${fmtDate(b.createdAt)}</small></td>
        <td>
          <select class="status" data-id="${b.id}">
            ${["pending", "confirmed", "paid", "cancelled"].map(s =>
              `<option value="${s}" ${b.status === s ? "selected" : ""}>${STATUS_LABELS[s]}</option>`).join("")}
          </select>
        </td>
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
        <td><b>${c.name}</b></td>
        <td>${c.email}</td>
        <td>${c.phone || "—"}</td>
        <td>${c.bookings}</td>
        <td><small>${fmtDate(c.createdAt)}</small></td>
      </tr>`).join("");
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
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
          <b>${m.name}</b> <small>· ${m.email}</small> ${m.subject ? `<small>· ${m.subject}</small>` : ""}
          <p>${m.message}</p>
          <small>${fmtDate(m.createdAt)}</small>
        </div>
        <div class="m-actions">
          ${m.read ? "" : `<button class="btn small ghost" data-read="${m.id}">Marquer lu</button>`}
          <button class="btn small danger" data-delmsg="${m.id}">Supprimer</button>
        </div>
      </div>`).join("");
    const unread = list.filter(m => !m.read).length;
    $("msgCount").textContent = unread ? `( ${unread} )` : "";
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
    $("sGallery").value = (s.gallery || []).join("\n");
  } catch (e) { if (e.message === "Accès refusé") handleAuth(); }
}
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

/* ---------- Session invalide ---------- */
function handleAuth() {
  aToken = ""; localStorage.removeItem(ATOKEN_KEY);
  $("dashView").classList.add("hidden"); $("loginView").classList.remove("hidden");
}

/* ---------- Init ---------- */
if (aToken) {
  api("/api/admin/stats").then(() => enterDash()).catch(() => handleAuth());
} else {
  handleAuth();
}