// Emails & Blog — simple JavaScript, no database.
// The list of files comes from content.js, which Render generates with build.js on every deploy.

// Optional: paste your free Web3Forms access key between the quotes (get it at https://web3forms.com).
// Your client then gets a "Leave feedback" button, and each comment arrives in your email inbox.
// Empty = the button is hidden.
const FEEDBACK_KEY = "d78468a5-b93c-4f3e-ae7f-9b7b69ff4419";

const LABELS = { email: "Email", blog: "Blog" };
const VERDICTS = { love: "♥ Loved it", changes: "✎ Changes requested" };
const THUMB_WIDTH = { email: 700, blog: 1280 }; // "real" width each thumbnail is drawn at
const PAGE_TITLE = document.title;
const content = Array.isArray(window.CONTENT) ? window.CONTENT : null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const link = (path) => path.split("/").map(encodeURIComponent).join("/");
const formatDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// Small memory in this browser only (which pieces got feedback, the client's name).
const memory = {
  get(key) { try { return localStorage.getItem(key) || ""; } catch { return ""; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};

// ---------------------------------------------------------------- Home
function renderHome() {
  if (!content) {
    return showEmpty("The content list was not found. In Render, the Build Command should be: npm run build");
  }
  $("#list").innerHTML = content.map((c) => `
    <a class="card" data-type="${c.type}" href="#${link(c.path)}">
      <div class="thumb" data-width="${THUMB_WIDTH[c.type]}">
        <iframe src="${link(c.path)}" loading="lazy" sandbox tabindex="-1" aria-hidden="true" scrolling="no"></iframe>
        <span class="thumb-cta" aria-hidden="true">Open preview →</span>
      </div>
      <div class="card-info">
        <div class="card-tags">
          <span class="tag ${c.type}">${LABELS[c.type]}</span>
          <span class="sent" data-path="${esc(c.path)}"></span>
        </div>
        <h3>${esc(c.title)}</h3>
        ${c.date ? `<time datetime="${c.date}">${formatDate(c.date)}</time>` : ""}
      </div>
    </a>`).join("");

  document.querySelectorAll("[data-filter]").forEach((b) => {
    const type = b.dataset.filter;
    b.querySelector("span").textContent = content.filter((c) => type === "all" || c.type === type).length;
    b.addEventListener("click", () => filter(type));
  });
  document.querySelectorAll(".thumb").forEach((t) => {
    scaleThumbs.observe(t);
    t.querySelector("iframe").addEventListener("load", (e) => e.target.classList.add("loaded"), { once: true });
  });
  showSentBadges();
  filter("all");
  setTimeout(() => document.body.classList.add("ready"), 1500); // after the first entrance animation
}

function filter(type) {
  document.querySelectorAll("[data-filter]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.filter === type));
  let visible = 0;
  document.querySelectorAll(".card").forEach((card) => {
    card.hidden = type !== "all" && card.dataset.type !== type;
    if (!card.hidden) card.style.setProperty("--i", Math.min(visible++, 12));
  });
  showEmpty(visible ? "" : { email: "No emails yet.", blog: "No blog posts yet." }[type] || "Nothing here yet.");
}

function showEmpty(text) {
  $("#empty").textContent = text;
  $("#empty").hidden = !text;
}

function showSentBadges() {
  document.querySelectorAll(".sent").forEach((badge) => {
    const verdict = memory.get(`feedback:${badge.dataset.path}`);
    badge.textContent = VERDICTS[verdict] || "";
    badge.className = `sent ${verdict}`;
  });
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
let current = null;
let cameFromHome = false;
let homeScroll = 0;

function openViewer(item) {
  if ($("#viewer").hidden) homeScroll = window.scrollY;
  current = item;
  $("#home").hidden = true;
  $("#viewer").hidden = false;
  $("#viewer-tag").textContent = LABELS[item.type];
  $("#viewer-tag").className = `tag ${item.type}`;
  $("#viewer-title").textContent = item.title;
  document.title = `${item.title} · MegaBliss`;
  $("#open").href = link(item.path);
  $("#feedback-open").hidden = !FEEDBACK_KEY;
  $("#frame").src = link(item.path);
}

function closeViewer() {
  cameFromHome = false;
  closeFeedback();
  if ($("#viewer").hidden) return;
  current = null;
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

// ---------------------------------------------------------------- Feedback
function openFeedback() {
  if (!current) return;
  $("#feedback-form").reset();
  $("#feedback-form").hidden = false;
  $("#feedback-done").hidden = true;
  $("#fb-status").textContent = "";
  $("#feedback-title").textContent = current.title;
  $("#fb-name").value = memory.get("feedback:name");
  $("#drawer").hidden = false;
  $("#feedback-form input[name=verdict]").focus();
}

function closeFeedback() {
  $("#drawer").hidden = true;
}

async function sendFeedback(e) {
  e.preventDefault();
  const verdict = $("#feedback-form input[name=verdict]:checked")?.value;
  const message = $("#fb-message").value.trim();
  const name = $("#fb-name").value.trim();
  const status = $("#fb-status");
  if (!verdict) return (status.textContent = "Choose “Love it” or “Needs changes” first.");
  if (verdict === "changes" && !message) return (status.textContent = "Tell us what you'd like changed.");

  const button = $("#feedback-form .send");
  button.disabled = true;
  status.textContent = "Sending…";
  try {
    if (!$("#fb-botcheck").checked) {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: FEEDBACK_KEY,
          subject: `${VERDICTS[verdict]}: ${current.title}`,
          from_name: name || "Client",
          Feedback: VERDICTS[verdict],
          Piece: current.title,
          Link: location.href,
          Name: name || "(not given)",
          Comments: message || "(no comments)",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "The message could not be sent.");
    }
    memory.set(`feedback:${current.path}`, verdict);
    if (name) memory.set("feedback:name", name);
    showSentBadges();
    $("#feedback-form").hidden = true;
    $("#feedback-done").hidden = false;
  } catch (err) {
    status.textContent = `${err.message} Please try again in a moment.`;
  } finally {
    button.disabled = false;
  }
}

// ---------------------------------------------------------------- Events
$("#list").addEventListener("click", (e) => { if (e.target.closest(".card")) cameFromHome = true; });
$("#back").addEventListener("click", goBack);
$("#feedback-open").addEventListener("click", openFeedback);
$("#feedback-form").addEventListener("submit", sendFeedback);
$("#feedback-form").addEventListener("input", () => { $("#fb-status").textContent = ""; });
document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeFeedback));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("#drawer").hidden) closeFeedback();
  else if (!$("#viewer").hidden) goBack();
});
document.querySelectorAll(".device [data-width]").forEach((b) => b.addEventListener("click", () => setWidth(b)));
window.addEventListener("hashchange", route);

renderHome();
route();
