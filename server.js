// Blog Review Portal — Express server
// Drafts, approvals and comments are stored in a GitHub repo (source of truth),
// so nothing is lost when Render restarts or redeploys.

import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH = "main",
  ADMIN_PASSWORD, CLIENT_PASSWORD, SESSION_SECRET = "dev-secret", PORT = 3000,
} = process.env;

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  console.warn("⚠  Missing GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO — see .env.example");
}

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------- GitHub helpers
const GH = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;
const ghHeaders = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function ghGet(filePath) {
  const r = await fetch(`${GH}/${filePath}?ref=${GITHUB_BRANCH}`, { headers: ghHeaders });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET ${filePath}: ${r.status}`);
  return r.json();
}
async function ghRead(filePath) {
  const f = await ghGet(filePath);
  return f ? { text: Buffer.from(f.content, "base64").toString("utf8"), sha: f.sha } : null;
}
async function ghWrite(filePath, text, message) {
  const existing = await ghGet(filePath);
  const r = await fetch(`${GH}/${filePath}`, {
    method: "PUT",
    headers: ghHeaders,
    body: JSON.stringify({
      message, branch: GITHUB_BRANCH,
      content: Buffer.from(text, "utf8").toString("base64"),
      ...(existing && { sha: existing.sha }),
    }),
  });
  if (!r.ok) throw new Error(`GitHub PUT ${filePath}: ${r.status} ${await r.text()}`);
}
async function ghDelete(filePath, message) {
  const existing = await ghGet(filePath);
  if (!existing) return;
  const r = await fetch(`${GH}/${filePath}`, {
    method: "DELETE", headers: ghHeaders,
    body: JSON.stringify({ message, sha: existing.sha, branch: GITHUB_BRANCH }),
  });
  if (!r.ok) throw new Error(`GitHub DELETE ${filePath}: ${r.status}`);
}
async function ghList(dir) {
  const items = await ghGet(dir);
  return Array.isArray(items) ? items : [];
}

// Post metadata lives in meta/<slug>.json
const readMeta = async (slug) => { const f = await ghRead(`meta/${slug}.json`); return f ? JSON.parse(f.text) : null; };
const writeMeta = (meta, msg) => ghWrite(`meta/${meta.slug}.json`, JSON.stringify(meta, null, 2), msg);

// ---------------------------------------------------------------- Auth (signed cookie)
const sign = (v) => crypto.createHmac("sha256", SESSION_SECRET).update(v).digest("hex");
function getRole(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)session=([^;]+)/);
  if (!m) return null;
  const [role, sig] = decodeURIComponent(m[1]).split(".");
  return sig && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(role))) ? role : null;
}
const requireRole = (...roles) => (req, res, next) => {
  const role = getRole(req);
  if (!role || !roles.includes(role)) return res.status(401).json({ error: "Not authorized" });
  req.role = role; next();
};
const safeEq = (a = "", b = "") => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

app.post("/api/login", (req, res) => {
  const { password = "" } = req.body;
  const role = ADMIN_PASSWORD && safeEq(password, ADMIN_PASSWORD) ? "admin"
             : CLIENT_PASSWORD && safeEq(password, CLIENT_PASSWORD) ? "client" : null;
  if (!role) return res.status(401).json({ error: "Wrong password" });
  const secure = process.env.NODE_ENV === "production" || process.env.RENDER ? "; Secure" : "";
  res.setHeader("Set-Cookie", `session=${encodeURIComponent(`${role}.${sign(role)}`)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}`);
  res.json({ role });
});
app.post("/api/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "session=; HttpOnly; Path=/; Max-Age=0");
  res.json({ ok: true });
});
app.get("/api/me", (req, res) => res.json({ role: getRole(req) }));

// ---------------------------------------------------------------- Posts API
const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: e.message }); });

// List all posts (newest first)
app.get("/api/posts", requireRole("admin", "client"), wrap(async (_req, res) => {
  const files = (await ghList("meta")).filter((f) => f.name.endsWith(".json"));
  const metas = await Promise.all(files.map((f) => readMeta(f.name.replace(/\.json$/, ""))));
  res.json(metas.filter(Boolean).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}));

// Raw HTML of a post (draft or published) for the preview iframe
app.get("/api/posts/:slug/html", requireRole("admin", "client"), wrap(async (req, res) => {
  const meta = await readMeta(req.params.slug);
  if (!meta) return res.status(404).send("Not found");
  const file = await ghRead(`${meta.status === "published" ? "published" : "drafts"}/${meta.slug}.html`);
  res.type("html").send(file ? file.text : "<p>File missing</p>");
}));

// Upload a new draft (or a new version of an existing one) — admin only
app.post("/api/posts", requireRole("admin"), upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Attach an .html file" });
  const html = req.file.buffer.toString("utf8");
  const titleFromHtml = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  const title = (req.body.title || titleFromHtml || req.file.originalname.replace(/\.html?$/i, "")).trim();
  const slug = slugify(req.body.slug || title);
  if (!slug) return res.status(400).json({ error: "Invalid title" });

  const now = new Date().toISOString();
  const prev = await readMeta(slug);
  const meta = {
    slug, title, status: "pending",
    version: prev ? prev.version + 1 : 1,
    createdAt: prev?.createdAt || now, updatedAt: now,
    notes: req.body.notes || "",
    comments: prev?.comments || [],
  };
  await ghWrite(`drafts/${slug}.html`, html, `Draft v${meta.version}: ${title}`);
  await writeMeta(meta, `Meta: ${title} (pending)`);
  res.json(meta);
}));

// Client approves → file moves drafts/ → published/ and goes live at /blog/<slug>
app.post("/api/posts/:slug/approve", requireRole("admin", "client"), wrap(async (req, res) => {
  const meta = await readMeta(req.params.slug);
  if (!meta) return res.status(404).json({ error: "Not found" });
  const draft = await ghRead(`drafts/${meta.slug}.html`);
  if (!draft) return res.status(400).json({ error: "Draft file missing" });
  await ghWrite(`published/${meta.slug}.html`, draft.text, `Publish: ${meta.title}`);
  await ghDelete(`drafts/${meta.slug}.html`, `Remove draft: ${meta.title}`);
  const now = new Date().toISOString();
  Object.assign(meta, { status: "published", publishedAt: now, updatedAt: now });
  meta.comments.push({ by: req.role, type: "approved", text: req.body.comment || "Approved", at: now });
  await writeMeta(meta, `Approved: ${meta.title}`);
  res.json(meta);
}));

// Client requests changes (with a comment)
app.post("/api/posts/:slug/changes", requireRole("admin", "client"), wrap(async (req, res) => {
  const meta = await readMeta(req.params.slug);
  if (!meta) return res.status(404).json({ error: "Not found" });
  const text = (req.body.comment || "").trim();
  if (!text) return res.status(400).json({ error: "Please write what should change" });
  const now = new Date().toISOString();
  meta.status = "changes"; meta.updatedAt = now;
  meta.comments.push({ by: req.role, type: "changes", text, at: now });
  await writeMeta(meta, `Changes requested: ${meta.title}`);
  res.json(meta);
}));

// Delete a post completely — admin only
app.delete("/api/posts/:slug", requireRole("admin"), wrap(async (req, res) => {
  const { slug } = req.params;
  await ghDelete(`drafts/${slug}.html`, `Delete draft ${slug}`);
  await ghDelete(`published/${slug}.html`, `Delete published ${slug}`);
  await ghDelete(`meta/${slug}.json`, `Delete meta ${slug}`);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- Public "live" blog
app.get("/blog", wrap(async (_req, res) => {
  const files = (await ghList("meta")).filter((f) => f.name.endsWith(".json"));
  const posts = (await Promise.all(files.map((f) => readMeta(f.name.replace(/\.json$/, "")))))
    .filter((m) => m?.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Blog</title>
<link rel="stylesheet" href="/styles.css"></head><body class="public">
<main class="public-wrap"><h1>Blog</h1>
${posts.length ? `<ul class="public-list">${posts.map((p) => `<li><a href="/blog/${p.slug}">${esc(p.title)}</a>
<span>${new Date(p.publishedAt).toLocaleDateString("en-US", { dateStyle: "long" })}</span></li>`).join("")}</ul>`
  : "<p>No posts published yet.</p>"}</main></body></html>`);
}));

app.get("/blog/:slug", wrap(async (req, res) => {
  const file = await ghRead(`published/${slugify(req.params.slug)}.html`);
  if (!file) return res.status(404).send("Post not found");
  res.type("html").send(file.text);
}));

app.listen(PORT, () => console.log(`Portal running → http://localhost:${PORT}`));
