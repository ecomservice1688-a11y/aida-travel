/* AIDA TRAVEL · Espace client */
const $ = id => document.getElementById(id);
const TOKEN_KEY = "aida_client_token";
const INFO_KEY = "aida_client_info";

const STATUS_LABELS = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  cancelled: "Annulée"
};

let token = localStorage.getItem(TOKEN_KEY) || "";
let clientInfo = JSON.parse(localStorage.getItem(INFO_KEY) || "null");

/* ---------- Helpers ---------- */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

function statusHTML(s) {
  const label = STATUS_LABELS[s] || s;
  return `<span class="badge ${s}">${label}</span>`;
}

function fmtPrice(n) {
  return n.toLocaleString("fr-FR") + " €";
}

/* ---------- Auth UI ---------- */
function showAuth() { $("authView").classList.remove("hidden"); $("portalView").classList.add("hidden"); }
function showPortal() {
  $("authView").classList.add("hidden");
  $("portalView").classList.remove("hidden");
  $("welcomeName").textContent = clientInfo ? clientInfo.name : "voyageur";
  $("barUser").textContent = clientInfo ? clientInfo.name : "";
  $("logoutBtn").classList.remove("hidden");
}

function doLogin(data) {
  token = data.token;
  clientInfo = { name: data.name, email: data.email };
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(INFO_KEY, JSON.stringify(clientInfo));
  showPortal();
  loadBookings();
}

function logout() {
  token = ""; clientInfo = null;
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(INFO_KEY);
  showAuth();
}

/* ---------- Login / Register ---------- */
$("tabLogin").addEventListener("click", () => {
  $("tabLogin").classList.add("active"); $("tabRegister").classList.remove("active");
  $("loginForm").classList.remove("hidden"); $("regForm").classList.add("hidden");
});
$("tabRegister").addEventListener("click", () => {
  $("tabRegister").classList.add("active"); $("tabLogin").classList.remove("active");
  $("regForm").classList.remove("hidden"); $("loginForm").classList.add("hidden");
});
$("logoutBtn").addEventListener("click", logout);

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("liMsg"); msg.classList.add("hidden");
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: $("liEmail").value, password: $("liPass").value })
    });
    doLogin(data);
  } catch (err) { msg.textContent = err.message; msg.classList.remove("hidden"); }
});

$("regForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("reMsg"); msg.classList.add("hidden");
  try {
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name: $("reName").value, email: $("reEmail").value,
        phone: $("rePhone").value, password: $("rePass").value
      })
    });
    doLogin(data);
  } catch (err) { msg.textContent = err.message; msg.classList.remove("hidden"); }
});

/* ---------- Tours de réservation ---------- */
async function loadTours() {
  try {
    const tours = await api("/api/tours");
    const sel = $("bkTour");
    sel.innerHTML = tours.map(t =>
      `<option value="${t.id}" data-price="${t.price}">${t.title} — ${t.loc} — à partir de ${t.price} € (${t.days})</option>`
    ).join("");
    updateNote();
  } catch (e) { $("bkNote").textContent = "Impossible de charger les circuits : " + e.message; }
}
function updateNote() {
  const sel = $("bkTour");
  const opt = sel.selectedOptions[0];
  const nb = parseInt($("bkTravellers").value, 10) || 1;
  const price = opt ? parseInt(opt.dataset.price, 10) * nb : 0;
  $("bkNote").innerHTML = `Estimation : <b>${price.toLocaleString("fr-FR")} €</b> pour ${nb} voyageur(s) (base ~${opt ? opt.dataset.price : "?"} €/personnes). Paiement par virement ou espèces ; confirmation sous 24h.`;
}
$("bkTour").addEventListener("change", updateNote);
$("bkTravellers").addEventListener("change", updateNote);

$("bookForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("bkMsgErr"); err.classList.add("hidden");
  try {
    await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        token,
        tourId: $("bkTour").value,
        date: $("bkDate").value,
        travellers: $("bkTravellers").value,
        message: $("bkMsg").value
      })
    });
    $("bookForm").reset();
    loadBookings();
  } catch (ex) { err.textContent = ex.message; err.classList.remove("hidden"); }
});

/* ---------- Mes réservations ---------- */
async function loadBookings() {
  try {
    const list = await api("/api/bookings?token=" + encodeURIComponent(token));
    const tbody = $("bkList");
    if (!list.length) { $("bkEmpty").classList.remove("hidden"); tbody.innerHTML = ""; return; }
    $("bkEmpty").classList.add("hidden");
    tbody.innerHTML = list.map(b => `
      <tr>
        <td><b>${b.tourTitle}</b><br><small>${b.tourLoc}</small></td>
        <td>${b.tripDate || "—"}</td>
        <td>${b.travellers}</td>
        <td><b>${fmtPrice(b.price)}</b></td>
        <td>${statusHTML(b.status)}</td>
        <td style="white-space:nowrap">
          <button class="btn small" data-pdf="${b.id}" title="Devis / facture PDF">PDF</button>
          ${(b.status === "pending" || b.status === "confirmed") ? `<button class="btn danger small" data-cancel="${b.id}">Annuler</button>` : ""}
        </td>
      </tr>
    `).join("");
    tbody.querySelectorAll("[data-cancel]").forEach(btn => {
      btn.addEventListener("click", () => cancelBooking(btn.dataset.cancel));
    });
    tbody.querySelectorAll("[data-pdf]").forEach(btn => {
      btn.addEventListener("click", () => downloadPdf(btn.dataset.pdf));
    });
  } catch (e) { /* si token invalide */ logout(); }
}

function downloadPdf(id) {
  window.open("/api/bookings/" + id + "/pdf?token=" + encodeURIComponent(token), "_blank");
}

async function cancelBooking(id) {
  if (!confirm("Annuler cette réservation ?")) return;
  try {
    await api("/api/bookings/cancel", { method: "POST", body: JSON.stringify({ token, id }) });
    loadBookings();
  } catch (e) { alert(e.message); }
}

/* ---------- Init ---------- */
(async function init() {
  loadTours();
  const qTour = new URLSearchParams(location.search).get("tour");
  if (qTour) {
    const sel = $("bkTour");
    const wait = setInterval(() => {
      if (sel.options.length) {
        clearInterval(wait);
        sel.value = qTour;
        if (sel.value) updateNote();
      }
    }, 100);
  }
  if (token && clientInfo) {
    try {
      const r = await fetch("/api/bookings?token=" + encodeURIComponent(token));
      if (r.ok) { showPortal(); loadBookings(); }
      else { logout(); showAuth(); }
    } catch (e) { showAuth(); }
  } else {
    showAuth();
  }
})();