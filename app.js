// Emails & Blog — simple JavaScript, no database.
// The list of files comes from content.js, which Render generates with build.js on every deploy.

// Optional: put your email between the quotes (e.g. "hello@yourbrand.com") so your client gets
// a "Send feedback" button on every email/blog post. Empty = the button is hidden.
const FEEDBACK_EMAIL = "";

const LABELS = { email: "Email", blog: "Blog" };
const THUMB_WIDTH = { email: 700, blog: 1280 }; // "real" width each thumbnail is drawn at
const PAGE_TITLE = document.title;
const content = Array.isArray(window.CONTENT) ? window.CONTENT : null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const link = (path) => path.split("/").map(encodeURIComponent).join("/");
const formatDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// ---------------------------------------------------------------- Home
function renderHome() {
  if (!content) {
    return showEmpty("The content list was not found. In Render, the Build Command should be: npm run build");
  }
  $("#list").innerHTML = content.map((c) => `
    <a class="card" data-type="${c.type}" href="#${link(c.path)}">
      <div class="thumb" data-width="${THUMB_WIDTH[c.type]}">
        <iframe src="${link(c.path)}" loading="lazy" sandbox tabindex="-1" aria-hidden="true" scrolling="no"></iframe>
      </div>
      <div class="card-info">
        <span class="tag ${c.type}">${LABELS[c.type]}</span>
        <h3>${esc(c.title)}</h3>
        ${c.date ? `<time datetime="${c.date}">${formatDate(c.date)}</time>` : ""}
      </div>
    </a>`).join("");

  document.querySelectorAll("[data-filter]").forEach((b) => {
    const type = b.dataset.filter;
    b.querySelector("span").textContent = content.filter((c) => type === "all" || c.type === type).length;
    b.addEventListener("click", () => filter(type));
  });
  document.querySelectorAll(".thumb").forEach((t) => scaleThumbs.observe(t));
  filter("all");
}

function filter(type) {
  document.querySelectorAll("[data-filter]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.filter === type));
  let visible = 0;
  document.querySelectorAll(".card").forEach((card) => {
    card.hidden = type !== "all" && card.dataset.type !== type;
    if (!card.hidden) visible++;
  });
  showEmpty(visible ? "" : { email: "No emails yet.", blog: "No blog posts yet." }[type] || "Nothing here yet.");
}

function showEmpty(text) {
  $("#empty").textContent = text;
  $("#empty").hidden = !text;
}

// Each thumbnail draws the page at full size and scales it down to fit the card.
const scaleThumbs = new ResizeObserver((changes) => changes.forEach(({ target }) => {
  const width = Number(target.dataset.width);
  const scale = target.clientWidth / width;
  if (!scale) return;
  Object.assign(target.querySelector("iframe").style, {
    width: `${width}px`, height: `${target.clientHeight / scale}px`, transform: `scale(${scale})`,
  });
}));

// ---------------------------------------------------------------- Viewer
let cameFromHome = false;
let homeScroll = 0;

function openViewer(item) {
  if ($("#viewer").hidden) homeScroll = window.scrollY;
  $("#home").hidden = true;
  $("#viewer").hidden = false;
  $("#viewer-tag").textContent = LABELS[item.type];
  $("#viewer-tag").className = `tag ${item.type}`;
  $("#viewer-title").textContent = item.title;
  document.title = `${item.title} · Emails & Blog`;
  $("#open").href = link(item.path);
  $("#feedback").hidden = !FEEDBACK_EMAIL;
  $("#feedback").href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`Feedback: ${item.title}`)}&body=${encodeURIComponent(`${location.href}\n\n`)}`;
  $("#frame").src = link(item.path);
}

function closeViewer() {
  cameFromHome = false;
  if ($("#viewer").hidden) return;
  $("#viewer").hidden = true;
  $("#home").hidden = false;
  $("#frame").src = "about:blank";
  document.title = PAGE_TITLE;
  window.scrollTo(0, homeScroll);
}

// The address (#emails/file.html) decides what is shown, so every email has its own link.
function route() {
  let path = "";
  try { path = decodeURIComponent(location.hash.slice(1)); } catch { /* malformed address */ }
  const item = content && content.find((c) => c.path === path);
  if (item) openViewer(item); else closeViewer();
}

function goBack() {
  if (cameFromHome) return history.back();
  history.replaceState(null, "", location.pathname + location.search);
  closeViewer();
}

function setWidth(button) {
  document.querySelectorAll(".device [data-width]").forEach((b) => b.setAttribute("aria-pressed", b === button));
  $("#frame").style.width = button.dataset.width;
}

// Links inside an email/blog post open in a new tab instead of inside the viewer.
$("#frame").addEventListener("load", () => {
  try {
    $("#frame").contentDocument.querySelectorAll("a[href]:not([target])").forEach((a) => {
      if (!a.getAttribute("href").startsWith("#")) a.target = "_blank";
    });
  } catch { /* page from another domain: can't be changed */ }
});

$("#list").addEventListener("click", (e) => { if (e.target.closest(".card")) cameFromHome = true; });
$("#back").addEventListener("click", goBack);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#viewer").hidden) goBack(); });
document.querySelectorAll(".device [data-width]").forEach((b) => b.addEventListener("click", () => setWidth(b)));
window.addEventListener("hashchange", route);

renderHome();
route();
