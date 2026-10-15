// Blog Review Portal — browser logic
const $ = (s) => document.querySelector(s);
const state = { role: null, posts: [], current: null, filter: "all" };
const STATUS = { pending: "To review", changes: "Changes requested", published: "Live" };

async function api(url, opts = {}) {
  const r = await fetch(url, { headers: opts.body instanceof FormData ? {} : { "Content-Type": "application/json" }, ...opts });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== "/api/login") { showLogin(); throw new Error("Please sign in again"); }
  if (!r.ok) throw new Error(data.error || "Something went wrong");
  return data;
}
const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 3000); };
const fmt = (iso) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
const esc = (s = "") => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- views
function showLogin() { $("#app-view").hidden = true; $("#login-view").hidden = false; $("#password").focus(); }
async function showApp() {
  $("#login-view").hidden = true; $("#app-view").hidden = false;
  const admin = state.role === "admin";
  $("#upload-open").hidden = !admin;
  $("#btn-delete").hidden = !admin;
  await loadPosts();
}

// ---------- posts
async function loadPosts(keepSlug) {
  try { state.posts = await api("/api/posts"); } catch (e) { toast(e.message); state.posts = []; }
  renderList();
  const slug = keepSlug || state.current?.slug;
  if (slug) { const p = state.posts.find((x) => x.slug === slug); if (p) openPost(p); }
}

function renderList() {
  const list = $("#post-list");
  const posts = state.posts.filter((p) => state.filter === "all" || p.status === state.filter);
  if (!posts.length) { list.innerHTML = `<li class="none">No posts here yet.</li>`; return; }
  list.innerHTML = posts.map((p) => `
    <li data-slug="${p.slug}" class="${state.current?.slug === p.slug ? "active" : ""}">
      <span class="t">${esc(p.title)}</span>
      <span class="m"><span class="badge ${p.status}">${STATUS[p.status]}</span> v${p.version} · ${fmt(p.updatedAt)}</span>
    </li>`).join("");
}

function openPost(p) {
  state.current = p;
  renderList();
  $("#empty").hidden = true; $("#detail").hidden = false;
  $("#d-title").textContent = p.title;
  $("#d-meta").textContent = `${STATUS[p.status]} · Version ${p.version} · Updated ${fmt(p.updatedAt)}`;
  $("#frame").src = `/api/posts/${p.slug}/html?v=${p.version}`;

  $("#d-notes").hidden = !p.notes;
  $("#d-notes").innerHTML = p.notes ? `<strong>Note:</strong> ${esc(p.notes)}` : "";

  $("#d-comments").innerHTML = p.comments.length
    ? p.comments.map((c) => `<li><div class="who">${c.by === "client" ? "Client" : "Admin"} · ${
        c.type === "approved" ? "✓ Approved" : "Requested changes"} · ${fmt(c.at)}</div>${esc(c.text)}</li>`).join("")
    : `<li class="none">No comments yet.</li>`;

  const live = p.status === "published";
  $("#actions").hidden = live && state.role !== "admin";
  $("#btn-approve").hidden = $("#btn-changes").hidden = live;
  $("#comment").hidden = live;
  $("#live-link").hidden = !live;
  if (live) $("#live-link").innerHTML = `This post is live: <a href="/blog/${p.slug}" target="_blank">/blog/${p.slug}</a>`;
  $("#comment").value = "";
}

async function act(kind) {
  const p = state.current; if (!p) return;
  const comment = $("#comment").value.trim();
  if (kind === "approve" && !confirm(`Publish "${p.title}" to the live blog?`)) return;
  if (kind === "changes" && !comment) { $("#comment").focus(); return toast("Write what you'd like changed first"); }
  const btn = kind === "approve" ? $("#btn-approve") : $("#btn-changes");
  btn.disabled = true;
  try {
    await api(`/api/posts/${p.slug}/${kind}`, { method: "POST", body: JSON.stringify({ comment }) });
    toast(kind === "approve" ? "Approved — the post is now live" : "Feedback sent");
    await loadPosts(p.slug);
  } catch (e) { toast(e.message); } finally { btn.disabled = false; }
}

// ---------- events
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault(); $("#login-error").textContent = "";
  try {
    const { role } = await api("/api/login", { method: "POST", body: JSON.stringify({ password: $("#password").value }) });
    state.role = role; $("#password").value = ""; showApp();
  } catch (err) { $("#login-error").textContent = err.message; }
});
$("#logout").addEventListener("click", async () => { await api("/api/logout", { method: "POST" }); state.current = null; showLogin(); });

$("#post-list").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-slug]"); if (!li) return;
  openPost(state.posts.find((p) => p.slug === li.dataset.slug));
});
document.querySelectorAll(".filters .chip").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".filters .chip").forEach((x) => x.classList.remove("active"));
  b.classList.add("active"); state.filter = b.dataset.filter; renderList();
}));
document.querySelectorAll(".device-toggle .chip").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".device-toggle .chip").forEach((x) => x.classList.remove("active"));
  b.classList.add("active"); $("#frame").style.width = b.dataset.width;
}));

$("#btn-approve").addEventListener("click", () => act("approve"));
$("#btn-changes").addEventListener("click", () => act("changes"));
$("#btn-delete").addEventListener("click", async () => {
  const p = state.current; if (!p || !confirm(`Delete "${p.title}" permanently?`)) return;
  try { await api(`/api/posts/${p.slug}`, { method: "DELETE" }); state.current = null;
    $("#detail").hidden = true; $("#empty").hidden = false; toast("Deleted"); loadPosts(); } catch (e) { toast(e.message); }
});

// Upload
const dlg = $("#upload-dialog");
$("#upload-open").addEventListener("click", () => { $("#upload-form").reset(); $("#upload-error").textContent = ""; dlg.showModal(); });
$("#upload-cancel").addEventListener("click", () => dlg.close());
$("#upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Uploading…";
  try {
    const meta = await api("/api/posts", { method: "POST", body: new FormData(e.target) });
    dlg.close(); toast(`Uploaded "${meta.title}" (v${meta.version})`); await loadPosts(meta.slug);
  } catch (err) { $("#upload-error").textContent = err.message; }
  finally { btn.disabled = false; btn.textContent = "Upload"; }
});

// Boot
api("/api/me").then(({ role }) => { state.role = role; role ? showApp() : showLogin(); }).catch(showLogin);
