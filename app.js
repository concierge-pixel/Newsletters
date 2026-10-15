// Correos y Blog — JavaScript simple, sin base de datos.
// La lista de archivos viene de contenido.js, que Render genera con build.js en cada deploy.

// Opcional: escribe tu correo entre las comillas (ej. "hola@tumarca.com") para que tu clienta
// tenga un botón "Enviar comentarios" en cada correo/artículo. Vacío = el botón no aparece.
const CORREO_COMENTARIOS = "";

const NOMBRES = { correo: "Correo", blog: "Blog" };
const ANCHO_MINIATURA = { correo: 700, blog: 1280 }; // ancho "real" al que se dibuja cada miniatura
const contenido = Array.isArray(window.CONTENIDO) ? window.CONTENIDO : null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enlace = (ruta) => ruta.split("/").map(encodeURIComponent).join("/");
const fechaBonita = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

// ---------------------------------------------------------------- Portada
function pintarPortada() {
  if (!contenido) {
    return mostrarVacio("No se encontró la lista de contenido. En Render, el Build Command debe ser: npm run build");
  }
  $("#lista").innerHTML = contenido.map((c) => `
    <a class="tarjeta" data-tipo="${c.tipo}" href="#${enlace(c.ruta)}">
      <div class="miniatura" data-ancho="${ANCHO_MINIATURA[c.tipo]}">
        <iframe src="${enlace(c.ruta)}" loading="lazy" sandbox tabindex="-1" aria-hidden="true" scrolling="no"></iframe>
      </div>
      <div class="tarjeta-info">
        <span class="etiqueta ${c.tipo}">${NOMBRES[c.tipo]}</span>
        <h3>${esc(c.titulo)}</h3>
        ${c.fecha ? `<time datetime="${c.fecha}">${fechaBonita(c.fecha)}</time>` : ""}
      </div>
    </a>`).join("");

  document.querySelectorAll("[data-filtro]").forEach((b) => {
    const tipo = b.dataset.filtro;
    b.querySelector("span").textContent = contenido.filter((c) => tipo === "todo" || c.tipo === tipo).length;
    b.addEventListener("click", () => filtrar(tipo));
  });
  document.querySelectorAll(".miniatura").forEach((m) => escalarMiniaturas.observe(m));
  filtrar("todo");
}

function filtrar(tipo) {
  document.querySelectorAll("[data-filtro]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.filtro === tipo));
  let visibles = 0;
  document.querySelectorAll(".tarjeta").forEach((t) => {
    t.hidden = tipo !== "todo" && t.dataset.tipo !== tipo;
    if (!t.hidden) visibles++;
  });
  mostrarVacio(visibles ? "" : { correo: "Todavía no hay correos.", blog: "Todavía no hay artículos de blog." }[tipo] || "Todavía no hay contenido.");
}

function mostrarVacio(texto) {
  $("#vacio").textContent = texto;
  $("#vacio").hidden = !texto;
}

// Cada miniatura dibuja la página a tamaño real y la reduce para que quepa en la tarjeta.
const escalarMiniaturas = new ResizeObserver((cambios) => cambios.forEach(({ target }) => {
  const ancho = Number(target.dataset.ancho);
  const escala = target.clientWidth / ancho;
  if (!escala) return;
  Object.assign(target.querySelector("iframe").style, {
    width: `${ancho}px`, height: `${target.clientHeight / escala}px`, transform: `scale(${escala})`,
  });
}));

// ---------------------------------------------------------------- Visor
let vinoDeLaPortada = false;
let scrollPortada = 0;

function abrirVisor(item) {
  if ($("#visor").hidden) scrollPortada = window.scrollY;
  $("#portada").hidden = true;
  $("#visor").hidden = false;
  $("#visor-etiqueta").textContent = NOMBRES[item.tipo];
  $("#visor-etiqueta").className = `etiqueta ${item.tipo}`;
  $("#visor-nombre").textContent = item.titulo;
  document.title = `${item.titulo} · Correos y Blog`;
  $("#abrir").href = enlace(item.ruta);
  $("#comentar").hidden = !CORREO_COMENTARIOS;
  $("#comentar").href = `mailto:${CORREO_COMENTARIOS}?subject=${encodeURIComponent(`Comentarios: ${item.titulo}`)}&body=${encodeURIComponent(`${location.href}\n\n`)}`;
  $("#marco").src = enlace(item.ruta);
}

function cerrarVisor() {
  vinoDeLaPortada = false;
  if ($("#visor").hidden) return;
  $("#visor").hidden = true;
  $("#portada").hidden = false;
  $("#marco").src = "about:blank";
  document.title = "Correos y Blog · Revisión";
  window.scrollTo(0, scrollPortada);
}

// La dirección (#correos/archivo.html) decide qué se muestra, así cada correo tiene su propio link.
function segunLaDireccion() {
  let ruta = "";
  try { ruta = decodeURIComponent(location.hash.slice(1)); } catch { /* dirección mal escrita */ }
  const item = contenido && contenido.find((c) => c.ruta === ruta);
  if (item) abrirVisor(item); else cerrarVisor();
}

function volver() {
  if (vinoDeLaPortada) return history.back();
  history.replaceState(null, "", location.pathname + location.search);
  cerrarVisor();
}

function ponerAncho(boton) {
  document.querySelectorAll(".dispositivo [data-ancho]").forEach((b) => b.setAttribute("aria-pressed", b === boton));
  $("#marco").style.width = boton.dataset.ancho;
}

// Los enlaces dentro de un correo/artículo se abren en otra pestaña en lugar de dentro del visor.
$("#marco").addEventListener("load", () => {
  try {
    $("#marco").contentDocument.querySelectorAll("a[href]:not([target])").forEach((a) => {
      if (!a.getAttribute("href").startsWith("#")) a.target = "_blank";
    });
  } catch { /* página de otro dominio: no se puede modificar */ }
});

$("#lista").addEventListener("click", (e) => { if (e.target.closest(".tarjeta")) vinoDeLaPortada = true; });
$("#cerrar").addEventListener("click", volver);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#visor").hidden) volver(); });
document.querySelectorAll(".dispositivo [data-ancho]").forEach((b) => b.addEventListener("click", () => ponerAncho(b)));
window.addEventListener("hashchange", segunLaDireccion);

pintarPortada();
segunLaDireccion();
