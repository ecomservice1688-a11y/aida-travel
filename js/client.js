/* AIDA TRAVEL · Demande de réservation (sans compte) */
const $ = id => document.getElementById(id);

const STATUS_LABELS = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  cancelled: "Annulée"
};

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

/* ---------- Circuits ---------- */
async function loadTours() {
  try {
    const tours = await api("/api/tours");
    const sel = $("bkTour");
    sel.innerHTML = tours.map(t =>
      `<option value="${t.id}">${t.title} — ${t.loc}${t.days ? " (" + t.days + ")" : ""}</option>`
    ).join("");
    updateNote();
    loadDepartures();
  } catch (e) { $("bkNote").textContent = "Impossible de charger les circuits : " + e.message; }
}

async function loadDepartures() {
  const dateSel = $("bkDate");
  if (!dateSel || dateSel.dataset.filled) return;
  try {
    const res = await fetch("/api/departures");
    if (!res.ok) return;
    const list = await res.json();
    dateSel.dataset.filled = "1";
    list.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.date;
      opt.dataset.tour = d.tourId;
      opt.textContent = new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) + " — " + d.tourTitle;
      dateSel.appendChild(opt);
    });
  } catch (e) { /* silencieux */ }
}

function updateNote() {
  $("bkNote").innerHTML = `Votre demande est envoyée à Aida Travel : <b>devis gratuit sur mesure</b>. Confirmation de disponibilité et budget précis sous 24 h, sans engagement.`;
}
$("bkTour").addEventListener("change", updateNote);
$("bkTravellers").addEventListener("change", updateNote);

/* ---------- Envoi → page merci ---------- */
$("bookForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("bkMsgErr"); err.classList.add("hidden");
  const submitBtn = e.target.querySelector("button[type=submit]");
  const original = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi en cours…";
  try {
    await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        name: $("bkName").value,
        email: $("bkEmail").value,
        phone: $("bkPhone").value,
        tourId: $("bkTour").value,
        date: $("bkDate").value,
        travellers: $("bkTravellers").value,
        message: $("bkMsg").value
      })
    });
    const params = new URLSearchParams({ name: $("bkName").value, email: $("bkEmail").value });
    location.href = "merci.html?" + params.toString();
  } catch (ex) {
    err.textContent = ex.message; err.classList.remove("hidden");
    submitBtn.disabled = false; submitBtn.textContent = original;
  }
});

/* ---------- Init ---------- */
(function init() {
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
})();