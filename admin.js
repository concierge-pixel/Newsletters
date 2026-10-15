// Studio — upload, replace and delete emails/blog posts from the browser.
// The server (server.js) saves each change in the GitHub repository with the token stored in Render,
// and Render republishes the site (1–2 min). The token never reaches the browser.

const FOLDERS = { emails: "email", blog: "blog", uploads: null }; // the folders build.js reads
const SAVE_TO = { email: "emails", blog: "blog" };                // where new uploads go
const LABELS = { email: "Email", blog: "Blog" };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const link = (path) => path.split("/").map(encodeURIComponent).join("/");
const published = new Map((window.CONTENT || []).map((c) => [c.path, c])); // what the client page shows now

let files = [];   // files in the repository: { path, name, sha }
let pending = []; // files dropped but not published yet
let replacing = null;

// ---------------------------------------------------------------- Server
async function api(route, { method = "GET", body } = {}) {
  const res = await fetch(`/api/${route}`, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  const error = new Error(res.status === 404 && route === "session"
    ? "The Studio needs the Render Web Service version of this site (see README)."
    : data.error || `Something went wrong (error ${res.status}).`);
  error.status = res.status;
  throw error;
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function saveFile(path, text, sha, message) {
  const saved = await api("files", { method: "PUT", body: { path, content: toBase64(text), sha, message } });
  const file = { ...saved, title: pageTitle(text) };
  files = [file, ...files.filter((f) => f.path !== path)].sort((a, b) => b.name.localeCompare(a.name));
  return file;
}

// ---------------------------------------------------------------- Screens
function showLogin(message = "") {
  $("#studio").hidden = true;
  $("#login").hidden = false;
  $("#login-status").textContent = message;
  $("#password").focus();
}

function showSetup() {
  $("#studio").hidden = true;
  $("#login").hidden = true;
  $("#setup").hidden = false;
}

function showStudio(open = false) {
  $("#logout-wrap").hidden = open;
  $("#login").hidden = true;
  $("#studio").hidden = false;
  loadFiles();
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("#login-status");
  status.textContent = "Checking…";
  try {
    await api("login", { method: "POST", body: { password: $("#password").value } });
    $("#password").value = "";
    status.textContent = "";
    showStudio();
  } catch (err) {
    status.textContent = err.message;
  }
});

$("#logout").addEventListener("click", async () => {
  await api("logout", { method: "POST" }).catch(() => {});
  showLogin();
});

// ---------------------------------------------------------------- Your files
const typeOf = (f) => FOLDERS[f.path.split("/")[0]] || published.get(f.path)?.type || "auto";
const pageTitle = (html) => new DOMParser().parseFromString(html, "text/html").title.trim();
const titleOf = (f) => f.title || published.get(f.path)?.title
  || f.name.replace(/\.html?$/i, "").replace(/^\d{4}-\d{2}-\d{2}-?/, "").replace(/[-_]+/g, " ");

async function loadFiles() {
  $("#files").innerHTML = '<li class="row skeleton"></li>'.repeat(3);
  try {
    files = (await api("files")).sort((a, b) => b.name.localeCompare(a.name));
    renderFiles();
  } catch (err) {
    if (err.status === 401) return showLogin(err.message);
    $("#files").innerHTML = `<li class="row empty-row">${esc(err.message)}</li>`;
  }
}

function renderFiles() {
  $("#files").innerHTML = files.length ? files.map((f, i) => {
    const type = typeOf(f);
    return `
      <li class="row" style="--i: ${Math.min(i, 12)}">
        <span class="tag ${type}">${LABELS[type] || "Auto"}</span>
        <div class="row-main"><strong>${esc(titleOf(f))}</strong><small>${esc(f.path)}</small></div>
        <div class="row-buttons">
          <a class="button" href="./#${link(f.path)}" target="_blank" rel="noopener">View</a>
          <button type="button" class="button" data-replace="${esc(f.path)}">Replace</button>
          <button type="button" class="button danger" data-delete="${esc(f.path)}">Delete</button>
        </div>
      </li>`;
  }).join("") : '<li class="row empty-row">No files yet. Drop your first HTML above.</li>';
}

$("#refresh").addEventListener("click", loadFiles);

$("#files").addEventListener("click", (e) => {
  const replace = e.target.closest("[data-replace]");
  const remove = e.target.closest("[data-delete]");
  if (replace) {
    replacing = files.find((f) => f.path === replace.dataset.replace);
    $("#replace-input").value = "";
    $("#replace-input").click();
  }
  if (remove) deleteFile(files.find((f) => f.path === remove.dataset.delete));
});

// Replace keeps the same file name, so the link your client has keeps working.
$("#replace-input").addEventListener("change", async () => {
  const file = $("#replace-input").files[0];
  if (!file || !replacing) return;
  const target = replacing;
  try {
    const text = await file.text();
    await saveFile(target.path, text, target.sha, `Replace: ${target.path}`);
    renderFiles();
    toast(`“${titleOf(target)}” replaced ✓ Your client will see the new version in about 1–2 minutes.`);
    watch(target.path, text);
  } catch (err) {
    toast(err.message, true);
  }
});

async function deleteFile(f) {
  if (!f || !confirm(`Delete “${titleOf(f)}”? Your client will no longer see it.`)) return;
  try {
    await api("files", { method: "DELETE", body: { path: f.path, sha: f.sha } });
    files = files.filter((x) => x !== f);
    renderFiles();
    toast("Deleted ✓ It disappears from the client page in about 1–2 minutes.");
    watch(f.path, null);
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------------------------------------------------------------- New uploads
// "My Newsletter (1).html" → "2026-10-16-my-newsletter-1.html" (the date sorts it and shows on the card)
function cleanName(name) {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\.html?$/, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
  return /^\d{4}-\d{2}-\d{2}/.test(base) ? `${base}.html` : `${new Date().toLocaleDateString("en-CA")}-${base}.html`;
}

const targetPath = (p) => `${SAVE_TO[p.type]}/${p.name}`;

async function addFiles(list) {
  for (const file of Array.from(list)) { // copy first: the browser empties the original list right after
    if (!/\.html?$/i.test(file.name)) { toast(`“${file.name}” is not an HTML file.`, true); continue; }
    const text = await file.text();
    const detected = detectType(text);
    const title = pageTitle(text) || file.name;
    pending.push({ text, detected, type: detected, title, name: cleanName(file.name) });
  }
  renderPending();
}

function renderPending() {
  $("#pending").hidden = !pending.length;
  $("#pending-list").innerHTML = pending.map((p, i) => {
    const replaces = files.some((f) => f.path === targetPath(p));
    return `
      <li class="row" data-index="${i}" style="--i: ${i}">
        <div class="row-main">
          <strong>${esc(p.title)}</strong>
          <small>Looks like ${p.detected === "email" ? "an <b>email</b>" : "a <b>blog post</b>"} · saved as ${esc(targetPath(p))}${replaces ? " · <b>replaces the current one</b>" : ""}</small>
        </div>
        <div class="seg" role="group" aria-label="Type">
          <button type="button" data-type="email" aria-pressed="${p.type === "email"}">Email</button>
          <button type="button" data-type="blog" aria-pressed="${p.type === "blog"}">Blog</button>
        </div>
        <button type="button" class="icon-button" data-remove aria-label="Remove ${esc(p.title)}">×</button>
      </li>`;
  }).join("");
  $("#publish").textContent = `Publish ${pending.length > 1 ? `${pending.length} files` : ""}`.trim();
}

$("#pending-list").addEventListener("click", (e) => {
  const row = e.target.closest("[data-index]");
  if (!row) return;
  const p = pending[row.dataset.index];
  if (e.target.closest("[data-type]")) p.type = e.target.closest("[data-type]").dataset.type;
  if (e.target.closest("[data-remove]")) pending.splice(row.dataset.index, 1);
  renderPending();
});

$("#cancel").addEventListener("click", () => { pending = []; renderPending(); });

// One file at a time: GitHub rejects two saves to the same branch at the same moment.
$("#publish").addEventListener("click", async () => {
  const buttons = [$("#publish"), $("#cancel")];
  buttons.forEach((b) => { b.disabled = true; });
  $("#publish").textContent = "Publishing…";
  let count = 0;
  for (const p of [...pending]) {
    const path = targetPath(p);
    try {
      const existing = files.find((f) => f.path === path);
      await saveFile(path, p.text, existing?.sha, `${existing ? "Replace" : "Upload"} ${p.type}: ${p.title}`);
      pending.splice(pending.indexOf(p), 1);
      count++;
      watch(path, p.text);
    } catch (err) {
      toast(err.message, true);
      if (err.status === 401) showLogin(err.message);
      break;
    }
  }
  buttons.forEach((b) => { b.disabled = false; });
  renderPending();
  renderFiles();
  if (count) toast(`${count > 1 ? `${count} files` : "File"} saved ✓ Your client will see ${count > 1 ? "them" : "it"} in about 1–2 minutes.`);
});

// Drag & drop or click to choose files.
const zone = $("#dropzone");
zone.addEventListener("click", () => $("#file-input").click());
zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#file-input").click(); } });
$("#file-input").addEventListener("change", () => { addFiles($("#file-input").files); $("#file-input").value = ""; });
["dragenter", "dragover"].forEach((type) => zone.addEventListener(type, (e) => { e.preventDefault(); zone.classList.add("over"); }));
["dragleave", "drop"].forEach((type) => zone.addEventListener(type, () => zone.classList.remove("over")));
zone.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
["dragover", "drop"].forEach((type) => window.addEventListener(type, (e) => e.preventDefault())); // don't open dropped files

// ---------------------------------------------------------------- Is it live yet?
// Checks the published site every 10 seconds until Render shows the change.
const watching = new Map();
let watchTimer = null;

function watch(path, text) {
  watching.set(path, { text, until: Date.now() + 6 * 60 * 1000 });
  updateLiveBanner();
  if (!watchTimer) watchTimer = setInterval(checkLive, 10000);
}

async function checkLive() {
  for (const [path, w] of watching) {
    try {
      const res = await fetch(`${link(path)}?check=${Date.now()}`, { cache: "no-store" });
      const body = res.ok ? (await res.text()).replace('<base target="_blank">', "") : null;
      if (w.text === null ? res.status === 404 : body === w.text) watching.delete(path);
    } catch { /* offline for a moment: try again next time */ }
    if (watching.has(path) && Date.now() > w.until) {
      watching.delete(path);
      toast("Render is taking longer than usual. Check the Render dashboard if the change doesn't show up soon.", true);
    }
  }
  updateLiveBanner(true);
  if (!watching.size) { clearInterval(watchTimer); watchTimer = null; }
}

function updateLiveBanner(checked = false) {
  const banner = $("#live");
  if (watching.size) {
    banner.className = "live-banner working";
    banner.innerHTML = '<span class="spinner" aria-hidden="true"></span> Publishing on Render… usually 1–2 minutes. You can keep working.';
    banner.hidden = false;
  } else if (checked) {
    banner.className = "live-banner done";
    banner.textContent = "✓ All changes are live on the client page.";
    setTimeout(() => { if (!watching.size) banner.hidden = true; }, 6000);
  }
}

// ---------------------------------------------------------------- Toast
function toast(message, isError = false) {
  const t = $("#toast");
  t.textContent = message;
  t.className = `toast${isError ? " error" : ""}`;
  t.hidden = false;
  clearTimeout(t.timer);
  t.timer = setTimeout(() => { t.hidden = true; }, isError ? 9000 : 6000);
}

api("session")
  .then(({ signedIn, configured, open }) => {
    if (!configured) showSetup();
    else if (signedIn) showStudio(open);
    else showLogin();
  })
  .catch((err) => showLogin(err.message));
