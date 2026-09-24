/* AIDA TRAVEL · Carnets de voyage (blog) */
const $ = id => document.getElementById(id);

const nav = document.getElementById("nav");
document.getElementById("burger").addEventListener("click", () => {
  document.getElementById("burger").classList.toggle("close");
  document.getElementById("navLinks").classList.toggle("open");
});
document.querySelectorAll(".nav-links a").forEach(a => {
  a.addEventListener("click", () => {
    document.getElementById("burger").classList.remove("close");
    document.getElementById("navLinks").classList.remove("open");
  });
});
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll);
onScroll();

async function loadPosts() {
  try {
    const res = await fetch("/api/posts");
    const posts = await res.json();
    const list = $("blogList");
    $("blogEmpty").classList.toggle("hidden", posts.length > 0);
    list.innerHTML = posts.map(p => `
      <div class="blog-card">
        <div class="blog-meta">Aida Travel · ${p.author} · ${fmtDate(p.createdAt)}</div>
        <h2><a href="blog.html?post=${encodeURIComponent(p.id)}">${p.title}</a></h2>
        <p>${p.excerpt}</p>
        <a class="btn btn-primary btn-sm btn-blog" href="blog.html?post=${encodeURIComponent(p.id)}">Lire l'article</a>
      </div>`).join("");
  } catch (e) {
    $("blogList").innerHTML = `<p class="empty-blog">Impossible de charger les articles.</p>`;
  }
}

async function loadPost(id) {
  $("blogList").classList.add("hidden");
  $("postView").classList.remove("hidden");
  try {
    const res = await fetch("/api/posts/" + encodeURIComponent(id));
    if (!res.ok) throw new Error();
    const p = await res.json();
    $("postTitle").textContent = p.title;
    $("postMeta").textContent = "Aida Travel · " + (p.author || "Aida") + " · " + fmtDate(p.createdAt);
    $("postContent").textContent = p.content;
    document.title = p.title + " · Aida Travel";
  } catch (e) {
    $("postContent").textContent = "Article introuvable.";
  }
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
}

const q = new URLSearchParams(location.search).get("post");
if (q) loadPost(q); else loadPosts();