/* AIDA TRAVEL · Page merci */
(function () {
  const params = new URLSearchParams(location.search);
  const name = params.get("name");
  const email = params.get("email");
  const n = document.getElementById("thxName");
  const e = document.getElementById("thxEmail");
  if (n && name) n.textContent = name;
  if (e) {
    e.textContent = email ? email : "votre adresse email";
    if (email) e.title = "Envoyer un email à " + email;
  }
})();