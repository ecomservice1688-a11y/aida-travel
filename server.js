/* ==========================================================================
   AIDA TRAVEL · Serveur (zéro dépendance) · Djanet & Tamanrasset
   ---------------------------------------------------------------
   Lancement :  node server.js   ->   http://localhost:3000
   Comptes    :  Admin : admin / admin123 (modifiable ci-dessous)
   Données    :  stockées dans data/db.json
   ========================================================================== */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PORT = process.env.PORT || 3000;

const ADMIN = {
  username: process.env.ADMIN_USER || "admin",
  password: process.env.ADMIN_PASS || "admin123"
};

const SEED_TOURS = [
  { id: "tadrart-rouge",     title: "Tadrart Rouge",                    loc: "Djanet",        price: 340,  days: "3 jours / 2 nuits", image: "img/tadrart.jpg",
    desc: "Arches, canyons et dunes ocre à l'aube. Le joyau des photographes, à moins d'une heure de Djanet.", tags: ["4x4", "Trek", "Bivouac"] },
  { id: "sefar-essendilene", title: "Sefar & Essendilène",              loc: "Djanet",        price: 520,  days: "5 jours / 4 nuits", image: "img/sefar.jpg",
    desc: "Le « Grand Dieu de Sefar » et la plus belle galerie d'art rupestre préhistorique au monde.", tags: ["Art rupestre", "Chameau", "Guide local"] },
  { id: "iherir-oasis",      title: "Iherir & l'oasis cachée",          loc: "Djanet",        price: 290,  days: "2 jours / 1 nuit", image: "img/iherir.jpg",
    desc: "Palmiers, mares naturelles et falaise de Tan Alouf. Le poumon vert du désert.", tags: ["Oasis", "Photo", "Pique-nique"] },
  { id: "hoggar-assekrem",   title: "Hoggar & Assekrem",                loc: "Tamanrasset",   price: 640,  days: "6 jours / 5 nuits", image: "img/hoggar.jpg",
    desc: "Lever de soleil mythique à 2 700 m, chaos volcanique et ermitage du Père de Foucauld.", tags: ["4x4", "Sommets", "Lever de soleil"] },
  { id: "sebiba",            title: "Fête de la Sebiba",                loc: "Djanet",        price: 480,  days: "4 jours / 3 nuits", image: "img/sebiba.jpg",
    desc: "Danse millénaire, tambours et étoffe blanche : un moment unique au monde, au cœur de l'oasis.", tags: ["Culture", "Festival", "Dates 2026"] },
  { id: "grande-traversee",  title: "Grande traversée Djanet–Tamanrasset", loc: "Tassili & Hoggar", price: 1150, days: "9 jours / 8 nuits", image: "img/traversee.jpg",
    desc: "La grande aventure nomade : piste, dunes et montagnes entre les deux capitales du Sahara algérien.", tags: ["Caravane", "Expédition", "Aventure"] }
];

const STATUSES = ["pending", "confirmed", "paid", "cancelled"];

/* ---------------- Données initiales ---------------- */
function seedDepartures() {
  const d = days => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  return [
    { id: uid(), tourId: "tadrart-rouge",     date: d(24),  places: 8 },
    { id: uid(), tourId: "sefar-essendilene", date: d(40),  places: 6 },
    { id: uid(), tourId: "hoggar-assekrem",   date: d(57),  places: 8 },
    { id: uid(), tourId: "iherir-oasis",      date: d(33),  places: 10 },
    { id: uid(), tourId: "grande-traversee",  date: d(85),  places: 4 },
    { id: uid(), tourId: "sebiba",            date: d(125), places: 12 }
  ];
}
function seedPosts() {
  const now = new Date();
  const iso = days => new Date(now.getTime() + days * 864e5).toISOString();
  return [
    {
      id: uid(), title: "10 choses à savoir avant de partir à Djanet",
      excerpt: "Visa, climat, équipement, culture : tout ce qu'il faut savoir avant votre première fois dans le Tassili n'Ajjer.",
      content: "Djanet est un petit bijou du Sahara algérien, porte d'entrée du Tassili n'Ajjer, classé au patrimoine mondial de l'UNESCO.\n\n1. Le visa : la plupart des nationalités en ont besoin. Nous fournissons l'attestation d'invitation pour votre dossier.\n2. La saison : d'octobre à avril, les températures sont idéales (20-28°C le jour, fraîches la nuit).\n3. L'équipement : chaussures de marche, veste chaude pour les nuits, protection solaire et 2 litres d'eau minimum.\n4. Le confort : nos bivouacs sont équipés de tentes, matelas et cuisine de camp. L'hospitalité touarègue est légendaire.\n5. Les incontournables : la Tadrart Rouge, les gravures de Sefar, l'oasis d'Iherir, puis plus au sud le Hoggar et l'Assekrem.",
      author: "Aida", createdAt: iso(-6)
    },
    {
      id: uid(), title: "Sefar : un musée à ciel ouvert au pays des Touareg",
      excerpt: "Plus de 15 000 gravures et peintures racontent 10 000 ans d'histoire. Récit de notre expédition.",
      content: "Sefar est une véritable cathédrale de grès où le temps semble s'être arrêté.\n\nNous partons de Djanet à l'aube, direction le cœur du Tassili. Après quelques heures de piste et de marche, la première galerie apparaît : girafes, éléphants, hommes masqués, bateaux... témoins d'un Sahara jadis verdoyant.\n\nLe « Grand Dieu de Sefar », figure emblématique de 6 mètres, impressionne par sa sérénité. Nos guides, Achour et son équipe, connaissent chaque panneau et partagent leurs légendes.\n\nUn conseil : partez en petit groupe, prenez votre temps, et laissez la nuit tombée révéler les dunes sous un ciel étoilé incomparable.",
      author: "Achour", createdAt: iso(-3)
    },
    {
      id: uid(), title: "Lever de soleil sur l'Assekrem : le toit du Sahara",
      excerpt: "À 2 700 m d'altitude, au cœur du Hoggar, l'ermitage du Père de Foucauld offre l'un des plus beaux levers de soleil au monde.",
      content: "4h30 du matin, itinéraire depuis Tamanrasset. Le 4x4 grimpe dans un chaos de rochers volcaniques invraisemblable.\n\nÀ l'ermitage, le silence est total. Puis le ciel passe du bleu nuit à l'orange, et les pics de l'Atakor s'embrasent un à un. Un moment que l'on ne raconte pas : on l'offre.\n\nNotre guide Bébé connaît les meilleurs emplacements, le moment exact où le café est servi et la plus belle table de lecture pour contempler. Yacine, lui, assure le retour le sourire aux lèvres.\n\nLe Hoggar s'étend tel un océan de pierre : un incontournable pour tous les amoureux de grands espaces.",
      author: "Bébé", createdAt: iso(0)
    }
  ];
}

/* ---------------- Base de données ---------------- */
function seedSite() {
  return {
    hero: "img/hero-djanet.jpg",
    about: "img/dromadaire.jpg",
    team: [
      { name: "Aida",  role: "Fondatrice & organisatrice", photo: "https://images.unsplash.com/photo-1526406915894-7bcd65f60845?auto=format&fit=crop&w=500&q=70" },
      { name: "Achour", role: "Guide & Amghar du Tassili", photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=70" },
      { name: "Bébé",  role: "Guide du Hoggar & chauffeur 4x4", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=70" }
    ],
    gallery: [
      "img/hero-djanet.jpg", "img/tadrart.jpg", "img/sefar.jpg", "img/dunes-detail.jpg",
      "img/hoggar.jpg", "img/assekrem.jpg", "img/essendilene.jpg", "img/dromadaire.jpg"
    ]
  };
}
function migrateTours(db) {
  db.tours.forEach(t => {
    const seed = SEED_TOURS.find(s => s.id === t.id);
    if (t.desc === undefined) t.desc = seed ? seed.desc : "";
    if (!Array.isArray(t.tags)) t.tags = seed ? seed.tags.slice() : [];
    if (t.image === undefined) t.image = seed ? seed.image : "img/hero-djanet.jpg";
    if (t.priceHidden === undefined) t.priceHidden = false;
  });
  return db;
}
function ensureSchema(db) {
  if (!Array.isArray(db.tours)) db.tours = SEED_TOURS;
  if (!Array.isArray(db.clients)) db.clients = [];
  if (!Array.isArray(db.bookings)) db.bookings = [];
  if (!Array.isArray(db.messages)) db.messages = [];
  if (!Array.isArray(db.departures)) db.departures = seedDepartures();
  if (!Array.isArray(db.posts)) db.posts = seedPosts();
  if (!db.site) db.site = seedSite();
  if (!Array.isArray(db.visits)) db.visits = [];
  migrateTours(db);
  return db;
}
function loadDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    saveDB(ensureSchema({ tours: SEED_TOURS, clients: [], bookings: [], messages: [] }));
  }
  return ensureSchema(JSON.parse(fs.readFileSync(DB_FILE, "utf8")));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const sessions = {}; // token -> { type: "client"|"admin", id? }

/* ---------------- Utilitaires ---------------- */
const uid = () => crypto.randomBytes(4).toString("hex").toUpperCase();
const token = () => crypto.randomBytes(24).toString("hex");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", c => (d += c));
    req.on("end", () => {
      try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(new Error("JSON invalide")); }
    });
    req.on("error", reject);
  });
}

function send(res, code, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

/* ---------------- Générateur PDF (zéro dépendance) ---------------- */
function pdfEsc(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function pdfText(lines) {
  // lines: [{ x, y, size, font, color, text }]
  const ops = [];
  for (const l of lines) {
    ops.push(`BT /${l.font || "F1"} ${l.size || 11} Tf ${l.color || "0 0 0 rg"} ${l.x} ${l.y} Td (${pdfEsc(l.text)}) Tj ET`);
  }
  return ops.join("\n");
}
function makePdf(invoice) {
  const W = 595, H = 842;
  const objs = [];
  const content = pdfText(invoice.lines);
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>");
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objs.push("<< /Length " + Buffer.byteLength(content, "latin1") + " >>\nstream\n" + content + "\nendstream");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objs.forEach((o, i) => {
    const n = i + 1;
    offsets[n] = Buffer.byteLength(pdf, "latin1");
    pdf += n + " 0 obj\n" + o + "\nendobj\n";
  });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
  for (let i = 1; i <= objs.length; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF";
  return Buffer.from(pdf, "latin1");
}
function buildInvoice(booking, tour) {
  const now = new Date();
  const d = iso => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");
  const lines = [];
  lines.push({ font: "F2", size: 20, x: 50, y: 780, text: "AIDA TRAVEL" });
  lines.push({ size: 9, x: 50, y: 768, text: "Circuits dans le Sahara algérien — Djanet & Tamanrasset" });
  lines.push({ size: 9, x: 50, y: 756, text: "Devis / Facture n° " + booking.id });
  lines.push({ size: 9, x: 50, y: 744, text: "Date : " + now.toLocaleDateString("fr-FR") + " " + now.toLocaleTimeString("fr-FR") });
  lines.push({ size: 10, x: 50, y: 706, text: "CLIENT" });
  lines.push({ size: 11, x: 50, y: 690, text: "Nom : " + booking.clientName });
  lines.push({ size: 11, x: 50, y: 676, text: "Email : " + booking.clientEmail });
  lines.push({ size: 10, x: 50, y: 646, text: "CIRCUIT" });
  lines.push({ size: 11, x: 50, y: 630, text: booking.tourTitle + " — " + booking.tourLoc });
  lines.push({ size: 11, x: 50, y: 616, text: "Départ : " + (booking.tripDate || "à convenir") });
  lines.push({ size: 11, x: 50, y: 602, text: "Voyageurs : " + booking.travellers });
  lines.push({ size: 11, x: 50, y: 588, text: (tour ? "Prix unitaire : " + tour.price + " €" : "") });
  lines.push({ font: "F2", size: 16, x: 50, y: 552, text: "TOTAL ESTIMÉ : " + booking.price + " €" });
  lines.push({ size: 11, x: 50, y: 536, text: "Statut : " + (booking.status === "paid" ? "Payé" : booking.status === "confirmed" ? "Confirmé" : "En attente") });
  lines.push({ size: 9, x: 50, y: 500, text: "Paiement : virement bancaire ou espèces. Un acompte de 30% confirme la réservation." });
  lines.push({ size: 9, x: 50, y: 486, text: "Logistique, guide, repas et bivouac inclus. Vols et visa non inclus." });
  lines.push({ size: 9, x: 50, y: 60, text: "Aida Travel — Djanet, Wilaya d'Illizi, Algérie — contact@aidatravel-dz.com — +213 6XX XX XX XX" });
  return makePdf({ lines });
}

/* ---------------- API ---------------- */
const api = {};

/* --- Auth client --- */
api["POST /api/register"] = async (req, res, body) => {
  const { name, email, phone, password } = body;
  if (!name || !email || !password) return send(res, 400, { error: "Champs manquants" });
  const db = loadDB();
  if (db.clients.find(c => c.email.toLowerCase() === email.toLowerCase()))
    return send(res, 409, { error: "Un compte existe déjà avec cet email" });
  if (password.length < 4) return send(res, 400, { error: "Mot de passe trop court (min 4)" });
  const client = { id: uid(), name, email, phone: phone || "", password, createdAt: new Date().toISOString() };
  db.clients.push(client);
  saveDB(db);
  const t = token();
  sessions[t] = { type: "client", id: client.id };
  send(res, 201, { token: t, name: client.name, email: client.email });
};

api["POST /api/login"] = async (req, res, body) => {
  const { email, password } = body;
  const db = loadDB();
  const client = db.clients.find(c => c.email.toLowerCase() === (email || "").toLowerCase() && c.password === password);
  if (!client) return send(res, 401, { error: "Email ou mot de passe incorrect" });
  const t = token();
  sessions[t] = { type: "client", id: client.id };
  send(res, 200, { token: t, name: client.name, email: client.email });
};

/* --- Tours --- */
api["GET /api/tours"] = (req, res) => {
  send(res, 200, loadDB().tours);
};

/* --- Réservations client (sans compte) --- */
api["POST /api/bookings"] = async (req, res, body) => {
  const { token: t, tourId, date, travellers, message, name, email, phone } = body;
  const db = loadDB();
  const tour = db.tours.find(x => x.id === tourId);
  if (!tour) return send(res, 400, { error: "Circuit inconnu" });
  const nb = parseInt(travellers, 10) || 1;
  let cName = String(name || "").trim();
  let cEmail = String(email || "").trim();
  let cPhone = String(phone || "").trim();
  const sess = sessions[t];
  if (sess && sess.type === "client") {
    const client = db.clients.find(c => c.id === sess.id);
    if (client) { cName = client.name; cEmail = client.email; cPhone = client.phone || ""; }
  }
  if (!cName || !cEmail) return send(res, 400, { error: "Nom et email requis" });
  const booking = {
    id: uid(),
    clientId: sess && sess.type === "client" ? (sess.id || "") : "",
    clientName: cName,
    clientEmail: cEmail,
    clientPhone: cPhone,
    tourId: tour.id,
    tourTitle: tour.title,
    tourLoc: tour.loc,
    tripDate: date || "",
    travellers: nb,
    message: message || "",
    price: tour.price * nb,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  db.bookings.push(booking);
  saveDB(db);
  send(res, 201, { booking });
};

api["POST /api/bookings/cancel"] = async (req, res, body) => {
  const { token: t, id } = body;
  const sess = sessions[t];
  if (!sess || sess.type !== "client") return send(res, 401, { error: "Non connecté" });
  const db = loadDB();
  const b = db.bookings.find(x => x.id === id && x.clientId === sess.id);
  if (!b) return send(res, 404, { error: "Réservation introuvable" });
  if (b.status !== "pending" && b.status !== "confirmed")
    return send(res, 400, { error: "Impossible d'annuler ce statut" });
  b.status = "cancelled";
  saveDB(db);
  send(res, 200, { ok: true, booking: b });
};

api["GET /api/bookings"] = (req, res) => {
  const t = new URL(req.url, "http://x").searchParams.get("token");
  const sess = sessions[t];
  if (!sess || sess.type !== "client") return send(res, 401, { error: "Non connecté" });
  const mine = loadDB().bookings.filter(b => b.clientId === sess.id);
  send(res, 200, mine);
};

/* --- Messages (formulaire contact) --- */
api["POST /api/contact"] = async (req, res, body) => {
  const { name, email, message, subject = "" } = body;
  if (!name || !email || !message) return send(res, 400, { error: "Champs manquants" });
  const db = loadDB();
  db.messages.push({ id: uid(), name, email, subject, message, read: false, createdAt: new Date().toISOString() });
  saveDB(db);
  send(res, 201, { ok: true });
};

/* --- Suivi de visites (pays détecté par IP) --- */
const geoCache = new Map(); // ip -> { country, ts }
function clientIp(req) {
  const fwd = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket.remoteAddress || "";
}
async function geoCountry(ip) {
  if (!ip) return "";
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < 86400000) return cached.country;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch("https://ipwho.is/" + encodeURIComponent(ip), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error();
    const j = await r.json();
    const country = j && j.success !== false && j.country ? String(j.country) : "";
    geoCache.set(ip, { country, ts: Date.now() });
    return country;
  } catch (e) {
    geoCache.set(ip, { country: "", ts: Date.now() });
    return "";
  }
}
api["POST /api/visit"] = async (req, res, body) => {
  const ip = clientIp(req);
  const db = loadDB();
  const now = Date.now();
  const page = String(body.page || "/").slice(0, 120);
  const ref = String(body.ref || "").slice(0, 300);
  const recent = db.visits.filter(v => v.ip === ip && v.page === page && now - v.at < 300000);
  if (recent.length >= 3) return send(res, 200, { ok: true, tracked: false });
  const country = await geoCountry(ip);
  db.visits.push({ id: uid(), ip, country, page, ref, at: now });
  if (db.visits.length > 5000) db.visits = db.visits.slice(-5000);
  saveDB(db);
  send(res, 201, { ok: true, tracked: true });
};

api["GET /api/admin/visits"] = (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const db = loadDB();
  const visits = db.visits.slice().reverse();
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const today = visits.filter(v => v.at >= today0.getTime());
  const uniq = new Set(visits.map(v => v.ip));
  const countries = {};
  visits.forEach(v => {
    const c = v.country || "Inconnu";
    countries[c] = (countries[c] || 0) + 1;
  });
  const top = Object.entries(countries)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  send(res, 200, { total: visits.length, today: today.length, unique: uniq.size, top, recent: visits.slice(0, 25) });
};

/* --- Admin --- */
api["POST /api/admin/login"] = async (req, res, body) => {
  if (body.username === ADMIN.username && body.password === ADMIN.password) {
    const t = token();
    sessions[t] = { type: "admin" };
    return send(res, 200, { token: t });
  }
  send(res, 401, { error: "Identifiants administrateur incorrects" });
};

function needAdmin(req) {
  const t = new URL(req.url, "http://x").searchParams.get("admintoken")
    || (req.headers["x-admin-token"] || "");
  const s = sessions[t];
  return s && s.type === "admin";
}

api["GET /api/admin/stats"] = (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const db = loadDB();
  const revenue = db.bookings.filter(b => b.status === "confirmed" || b.status === "paid")
    .reduce((s, b) => s + b.price, 0);
  send(res, 200, {
    bookings: db.bookings.length,
    clients: db.clients.length,
    messages: db.messages.length,
    revenue,
    pending: db.bookings.filter(b => b.status === "pending").length,
    visits: db.visits.length
  });
};

api["GET /api/admin/bookings"] = (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  send(res, 200, loadDB().bookings.slice().reverse());
};

api["PATCH /api/admin/bookings"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const url = new URL(req.url, "http://x");
  const id = url.pathname.split("/").pop();
  const db = loadDB();
  const b = db.bookings.find(x => x.id === id);
  if (!b) return send(res, 404, { error: "Réservation introuvable" });
  if (!STATUSES.includes(body.status)) return send(res, 400, { error: "Statut invalide" });
  b.status = body.status;
  saveDB(db);
  send(res, 200, { ok: true, booking: b });
};

api["GET /api/admin/clients"] = (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const db = loadDB();
  const clients = db.clients.map(c => ({
    id: c.id, name: c.name, email: c.email, phone: c.phone,
    createdAt: c.createdAt,
    bookings: db.bookings.filter(b => b.clientId === c.id).length
  }));
  send(res, 200, clients);
};

api["GET /api/admin/messages"] = (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  send(res, 200, loadDB().messages.slice().reverse());
};

api["POST /api/admin/messages/read"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const db = loadDB();
  const m = db.messages.find(x => x.id === body.id);
  if (!m) return send(res, 404, { error: "Message introuvable" });
  m.read = true;
  saveDB(db);
  send(res, 200, { ok: true });
};

api["GET /api/admin/tours"] = (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  send(res, 200, loadDB().tours);
};

api["POST /api/admin/tours"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const { title, loc, price, days } = body;
  if (!title || !price) return send(res, 400, { error: "Titre et prix requis" });
  const db = loadDB();
  db.tours.push({
    id: uid().toLowerCase(),
    title, loc: loc || "", price: parseFloat(price) || 0, days: days || ""
  });
  saveDB(db);
  send(res, 201, { ok: true, tours: db.tours });
};

api["DELETE /api/admin/messages"] = async (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const url = new URL(req.url, "http://x");
  const id = url.pathname.split("/").pop();
  const db = loadDB();
  const idx = db.messages.findIndex(x => x.id === id);
  if (idx < 0) return send(res, 404, { error: "Message introuvable" });
  db.messages.splice(idx, 1);
  saveDB(db);
  send(res, 200, { ok: true });
};

/* --- Départs (public) --- */
api["GET /api/departures"] = (req, res) => {
  const db = loadDB();
  const today = new Date().toISOString().slice(0, 10);
  const list = db.departures
    .filter(x => x.date >= today)
    .map(x => {
      const t = db.tours.find(y => y.id === x.tourId);
      return { id: x.id, date: x.date, places: x.places, tourId: x.tourId, tourTitle: t ? t.title : "", tourLoc: t ? t.loc : "", price: t ? t.price : 0, priceHidden: !!(t && t.priceHidden) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  send(res, 200, list);
};

/* --- Articles (public) --- */
api["GET /api/posts"] = (req, res) => {
  const list = loadDB().posts.map(p => ({
    id: p.id, title: p.title, excerpt: p.excerpt, author: p.author, createdAt: p.createdAt
  })).slice().reverse();
  send(res, 200, list);
};

api["GET /api/posts/id"] = (req, res) => {
  const id = new URL(req.url, "http://x").pathname.split("/").pop();
  const p = loadDB().posts.find(x => x.id === id);
  if (!p) return send(res, 404, { error: "Article introuvable" });
  send(res, 200, p);
};

/* --- Site (public) --- */
api["GET /api/site"] = (req, res) => {
  send(res, 200, loadDB().site);
};

/* --- Site (admin) --- */
api["PATCH /api/admin/site"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const db = loadDB();
  const s = db.site || seedSite();
  if (typeof body.hero === "string") s.hero = body.hero;
  if (typeof body.about === "string") s.about = body.about;
  if (Array.isArray(body.team)) s.team = body.team.slice(0, 6).map(m => ({
    name: String(m.name || ""), role: String(m.role || ""), photo: String(m.photo || "img/hero-djanet.jpg")
  }));
  if (Array.isArray(body.gallery)) s.gallery = body.gallery.map(x => String(x)).filter(Boolean).slice(0, 12);
  db.site = s;
  saveDB(db);
  send(res, 200, { ok: true, site: db.site });
};

/* --- Admin : tours --- */
function parseTags(v) {
  if (Array.isArray(v)) return v.filter(Boolean).slice(0, 6);
  if (typeof v === "string") return v.split(/[,;]/).map(s => s.trim()).filter(Boolean).slice(0, 6);
  return [];
}
api["POST /api/admin/tours"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const { title, loc, price, days } = body;
  if (!title) return send(res, 400, { error: "Titre requis" });
  const db = loadDB();
  const slug = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "tour";
  const id = slug + "-" + uid().toLowerCase();
  db.tours.push({
    id, title, loc: loc || "Djanet", price: parseFloat(price) || 0, days: days || "",
    desc: body.desc || "", tags: parseTags(body.tags), image: body.image || "img/hero-djanet.jpg",
    priceHidden: body.priceHidden === true
  });
  saveDB(db);
  send(res, 201, { ok: true, tours: db.tours });
};

api["PATCH /api/admin/tours"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const id = new URL(req.url, "http://x").pathname.split("/").pop();
  const db = loadDB();
  const t = db.tours.find(x => x.id === id);
  if (!t) return send(res, 404, { error: "Circuit introuvable" });
  if (body.title !== undefined) t.title = body.title;
  if (body.loc !== undefined) t.loc = body.loc;
  if (body.price !== undefined) t.price = parseFloat(body.price) || t.price;
  if (body.days !== undefined) t.days = body.days;
  if (body.desc !== undefined) t.desc = body.desc;
  if (body.tags !== undefined) t.tags = parseTags(body.tags);
  if (body.image !== undefined) t.image = body.image;
  if (body.priceHidden !== undefined) t.priceHidden = !!body.priceHidden;
  saveDB(db);
  send(res, 200, { ok: true, tours: db.tours });
};

api["POST /api/admin/upload"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const { data, mime } = body;
  if (!data) return send(res, 400, { error: "Image manquante" });
  const buf = Buffer.from(data, "base64");
  const max = 4 * 1024 * 1024;
  if (!buf.length) return send(res, 400, { error: "Fichier vide" });
  if (buf.length > max) return send(res, 400, { error: "Image trop lourde (max 4 Mo)" });
  const m = MIME_TO_EXT2((mime || "image/jpeg"));
  const ext = m || "png";
  const name = "upload-" + uid().toLowerCase() + "." + ext;
  fs.writeFileSync(path.join(ROOT, "img", name), buf);
  send(res, 201, { ok: true, url: "img/" + name });
};
function MIME_TO_EXT2(m) {
  return { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[m] || null;
}

api["DELETE /api/admin/tours"] = (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const id = new URL(req.url, "http://x").pathname.split("/").pop();
  const db = loadDB();
  const idx = db.tours.findIndex(x => x.id === id);
  if (idx < 0) return send(res, 404, { error: "Circuit introuvable" });
  db.tours.splice(idx, 1);
  saveDB(db);
  send(res, 200, { ok: true, tours: db.tours });
};

/* --- Admin : départs --- */
api["GET /api/admin/departures"] = (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const db = loadDB();
  const list = db.departures.map(x => {
    const t = db.tours.find(y => y.id === x.tourId);
    return { id: x.id, tourId: x.tourId, tourTitle: t ? t.title : "—", date: x.date, places: x.places };
  }).slice().reverse();
  send(res, 200, list);
};

api["POST /api/admin/departures"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const { tourId, date, places } = body;
  if (!tourId || !date) return send(res, 400, { error: "Circuit et date requis" });
  const db = loadDB();
  if (!db.tours.find(t => t.id === tourId)) return send(res, 400, { error: "Circuit inconnu" });
  db.departures.push({ id: uid(), tourId, date, places: parseInt(places, 10) || 1 });
  saveDB(db);
  send(res, 201, { ok: true, departures: db.departures });
};

api["PATCH /api/admin/departures"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const id = new URL(req.url, "http://x").pathname.split("/").pop();
  const db = loadDB();
  const d = db.departures.find(x => x.id === id);
  if (!d) return send(res, 404, { error: "Départ introuvable" });
  if (body.tourId !== undefined) d.tourId = body.tourId;
  if (body.date !== undefined) d.date = body.date;
  if (body.places !== undefined) d.places = parseInt(body.places, 10) || 1;
  saveDB(db);
  send(res, 200, { ok: true, departures: db.departures });
};

api["DELETE /api/admin/departures"] = (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const id = new URL(req.url, "http://x").pathname.split("/").pop();
  const db = loadDB();
  const idx = db.departures.findIndex(x => x.id === id);
  if (idx < 0) return send(res, 404, { error: "Départ introuvable" });
  db.departures.splice(idx, 1);
  saveDB(db);
  send(res, 200, { ok: true, departures: db.departures });
};

/* --- Admin : articles --- */
api["POST /api/admin/posts"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const { title, excerpt, content, author } = body;
  if (!title || !content) return send(res, 400, { error: "Titre et contenu requis" });
  const db = loadDB();
  db.posts.push({ id: uid(), title, excerpt: excerpt || "", content, author: author || "Aida", createdAt: new Date().toISOString() });
  saveDB(db);
  send(res, 201, { ok: true, posts: db.posts });
};

api["PATCH /api/admin/posts"] = async (req, res, body) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const id = new URL(req.url, "http://x").pathname.split("/").pop();
  const db = loadDB();
  const p = db.posts.find(x => x.id === id);
  if (!p) return send(res, 404, { error: "Article introuvable" });
  if (body.title !== undefined) p.title = body.title;
  if (body.excerpt !== undefined) p.excerpt = body.excerpt;
  if (body.content !== undefined) p.content = body.content;
  if (body.author !== undefined) p.author = body.author;
  saveDB(db);
  send(res, 200, { ok: true, posts: db.posts });
};

api["DELETE /api/admin/posts"] = (req, res) => {
  if (!needAdmin(req)) return send(res, 401, { error: "Accès refusé" });
  const id = new URL(req.url, "http://x").pathname.split("/").pop();
  const db = loadDB();
  const idx = db.posts.findIndex(x => x.id === id);
  if (idx < 0) return send(res, 404, { error: "Article introuvable" });
  db.posts.splice(idx, 1);
  saveDB(db);
  send(res, 200, { ok: true, posts: db.posts });
};

/* --- PDF devis/facture --- */
api["GET /api/bookings/pdf"] = (req, res) => {
  const url = new URL(req.url, "http://x");
  const id = url.pathname.split("/")[3];
  const isAdmin = needAdmin(req);
  const sess = sessions[url.searchParams.get("token")];
  const db = loadDB();
  const b = db.bookings.find(x => x.id === id);
  if (!b) return send(res, 404, { error: "Réservation introuvable" });
  const okClient = sess && sess.type === "client" && sess.id === b.clientId;
  if (!isAdmin && !okClient) return send(res, 403, { error: "Accès refusé" });
  const tour = db.tours.find(t => t.id === b.tourId);
  const pdf = buildInvoice(b, tour);
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment; filename=devis-aida-" + b.id + ".pdf",
    "Content-Length": pdf.length
  });
  res.end(pdf);
};

/* ---------------- Router ---------------- */
async function serveApi(req, res) {
  const url = new URL(req.url, "http://x");
  const pathname = url.pathname.replace(/\/$/, "");
  const p = req.method + " " + pathname;

  let body = {};
  try {
    body = (req.method === "GET" || req.method === "DELETE")
      ? Object.fromEntries(url.searchParams)
      : await readBody(req);
  } catch (e) {
    return send(res, 400, { error: e.message });
  }

  if (req.method === "PATCH" && /\/bookings\/[^/]+$/.test(pathname))
    return api["PATCH /api/admin/bookings"](req, res, body);
  if (req.method === "DELETE" && /\/messages\/[^/]+$/.test(pathname))
    return api["DELETE /api/admin/messages"](req, res, body);
  if (req.method === "PATCH" && /\/tours\/[^/]+$/.test(pathname))
    return api["PATCH /api/admin/tours"](req, res, body);
  if (req.method === "DELETE" && /\/tours\/[^/]+$/.test(pathname))
    return api["DELETE /api/admin/tours"](req, res, body);
  if (req.method === "PATCH" && /\/departures\/[^/]+$/.test(pathname))
    return api["PATCH /api/admin/departures"](req, res, body);
  if (req.method === "DELETE" && /\/departures\/[^/]+$/.test(pathname))
    return api["DELETE /api/admin/departures"](req, res, body);
  if (req.method === "PATCH" && /\/posts\/[^/]+$/.test(pathname))
    return api["PATCH /api/admin/posts"](req, res, body);
  if (req.method === "DELETE" && /\/posts\/[^/]+$/.test(pathname))
    return api["DELETE /api/admin/posts"](req, res, body);
  if (req.method === "GET" && /\/api\/posts\/[^/]+$/.test(pathname))
    return api["GET /api/posts/id"](req, res);
  if (req.method === "GET" && /\/api\/bookings\/[^/]+\/pdf$/.test(pathname))
    return api["GET /api/bookings/pdf"](req, res);

  const route = api[p];
  if (!route) return send(res, 404, { error: "Route inconnue" });
  return route(req, res, body);
}

function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/client.html") {
    res.writeHead(302, { "Location": "/#contact" });
    return res.end();
  }
  const file = path.resolve(ROOT, "." + pathname);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    return send(res, 403, { error: "Accès interdit" });
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end("<h1>404</h1><p>Fichier introuvable.</p>");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) return serveApi(req, res);
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log("==============================================");
  console.log("  AIDA TRAVEL  ·  serveur démarré");
  console.log("  Site vitrine : http://localhost:" + PORT);
  console.log("  Espace admin  : http://localhost:" + PORT + "/admin.html");
  console.log("  Admin : " + ADMIN.username + " / " + ADMIN.password);
  console.log("==============================================");
});