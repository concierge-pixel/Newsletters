// Render ejecuta este archivo en cada deploy (Build Command: npm run build).
// Busca los .html dentro de "correos/" y "blog/" y escribe contenido.js con la lista,
// que la página (index.html) usa para mostrar las tarjetas. No necesitas tocarlo.

const fs = require("fs");
const path = require("path");

const CARPETAS = { correos: "correo", blog: "blog" };

function buscarHtml(carpeta) {
  if (!fs.existsSync(carpeta)) return [];
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(carpeta, e.name);
    if (e.isDirectory()) return buscarHtml(ruta);
    return /\.html?$/i.test(e.name) ? [ruta] : [];
  });
}

function decodificar(texto) {
  return texto
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// "2026-10-15-newsletter-octubre.html" → "Newsletter octubre"
function tituloDesdeNombre(nombre) {
  const t = nombre.replace(/\.html?$/i, "").replace(/^\d{4}-\d{2}-\d{2}[-_ ]?/, "").replace(/[-_]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : nombre;
}

const contenido = [];
for (const [carpeta, tipo] of Object.entries(CARPETAS)) {
  for (const archivo of buscarHtml(carpeta)) {
    const html = fs.readFileSync(archivo, "utf8");
    const nombre = path.basename(archivo);
    const titulo = decodificar(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();
    contenido.push({
      tipo,
      ruta: archivo.split(path.sep).join("/"),
      titulo: titulo || tituloDesdeNombre(nombre),
      fecha: nombre.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null,
    });
  }
}

// Primero los que tienen fecha en el nombre (más nuevos arriba), luego el resto por nombre.
contenido.sort((a, b) =>
  (b.fecha || "").localeCompare(a.fecha || "") || a.ruta.localeCompare(b.ruta));

fs.writeFileSync(
  "contenido.js",
  "// Archivo generado automáticamente por build.js — no lo edites.\n" +
  `window.CONTENIDO = ${JSON.stringify(contenido, null, 2)};\n`,
);

const correos = contenido.filter((c) => c.tipo === "correo").length;
console.log(`✓ contenido.js listo: ${correos} correo(s) y ${contenido.length - correos} artículo(s) de blog`);
