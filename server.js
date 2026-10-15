// Small web server for Render (Web Service). No database and no extra packages.
// - Serves the site: the client page (index.html) and your Studio (admin.html).
// - Studio API: list, upload, replace and delete HTML files. The GitHub token stays here on the
//   server (Render → Environment → GITHUB_TOKEN) and never reaches the browser.
// - The Studio is open to anyone with the link, unless you set STUDIO_PASSWORD in Render.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const TOKEN = (process.env.GITHUB_TOKEN || "").trim();
const PASSWORD = process.env.STUDIO_PASSWORD || "";
const OPEN = !PASSWORD; // no password set = open Studio
const REPO = process.env.GITHUB_REPO || "concierge-pixel/Newsletters";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_API = process.env.GITHUB_API_URL || "https://api.github.com";
const ROOT = __dirname;

const FOLDERS = ["emails", "blog", "uploads"];
const PUBLIC_FILES = ["index.html", "admin.html", "styles.css", "app.js", "admin.js", "detect.js", "content.js", "robots.txt"];
const TYPES = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".md": "text/plain; charset=utf-8",
};

// ---------------------------------------------------------------- Studio login (signed cookie)
const secret = crypto.createHash("sha256").update(`${TOKEN}:${PASSWORD}`).digest(); // new password = everyone signs in again
const SESSION = crypto.createHmac("sha256", secret).update("studio-session").digest("hex");
const sameText = (a, b) => crypto.timingSafeEqual(
  crypto.createHash("sha256").update(String(a)).digest(), crypto.createHash("sha256").update(String(b)).digest());

function isSignedIn(req) {
  if (OPEN) return true;
  const cookie = (req.headers.cookie || "").match(/(?:^|;\s*)studio=([a-f0-9]{64})/);
  return Boolean(cookie && sameText(cookie[1], SESSION));
}

// Simple limits per address: 10 wrong passwords per 15 minutes, 60 saves/deletes per hour.
const counters = new Map();
function overLimit(key, max) {
  const c = counters.get(key);
  return Boolean(c && c.until > Date.now() && c.count >= max);
}
function count(key, windowMs) {
  const c = counters.get(key);
  if (!c || c.until < Date.now()) counters.set(key, { count: 1, until: Date.now() + windowMs });
  else c.count++;
}

// ---------------------------------------------------------------- GitHub
async function github(apiPath, { method = "GET", body } = {}) {
  const res = await fetch(`${GITHUB_API}/repos/${REPO}${apiPath}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "megabliss-studio" },
    body: body && JSON.stringify(body),
  });
  if (res.ok) return res.status === 204 ? null : res.json();
  if (res.status === 404 && method === "GET") return null;
  const data = await res.json().catch(() => ({}));
  const error = new Error(explain(res.status, data.message));
  error.status = res.status === 409 || res.status === 422 ? 409 : 502;
  throw error;
}

function explain(status, message = "") {
  if (status === 401) return "GitHub didn't accept GITHUB_TOKEN (it may be wrong or expired). Update it in Render → Environment.";
  if (status === 403 && /rate limit/i.test(message)) return "GitHub is busy right now. Try again in a few minutes.";
  if (status === 403) return "GITHUB_TOKEN can't save files. Create it with Contents set to “Read and write”.";
  if (status === 404) return `GitHub can't find ${REPO}. Make sure GITHUB_TOKEN has access to that repository.`;
  if (status === 409 || status === 422) return "That file changed on GitHub in the meantime. Click Refresh and try again.";
  return `GitHub error ${status}${message ? `: ${message}` : ""}.`;
}

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");
const validPath = (p) => typeof p === "string" && new RegExp(`^(${FOLDERS.join("|")})/[A-Za-z0-9._-]+\\.html?$`).test(p);

// ---------------------------------------------------------------- Studio API
async function handleApi(req, res, route) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

  if (route === "session" && req.method === "GET") {
    return send(res, 200, { signedIn: isSignedIn(req), configured: Boolean(TOKEN), open: OPEN });
  }
  if (route === "login" && req.method === "POST") {
    if (OPEN) return send(res, 200, { ok: true });
    if (overLimit(`login:${ip}`, 10)) return send(res, 429, { error: "Too many tries. Wait 15 minutes and try again." });
    const { password = "" } = await readJson(req);
    if (!sameText(password, PASSWORD)) {
      count(`login:${ip}`, 15 * 60 * 1000);
      return send(res, 401, { error: "Wrong password." });
    }
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `studio=${SESSION}; HttpOnly; Path=/; SameSite=Strict; Max-Age=31536000${secure}`);
    return send(res, 200, { ok: true });
  }
  if (route === "logout" && req.method === "POST") {
    res.setHeader("Set-Cookie", "studio=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0");
    return send(res, 200, { ok: true });
  }

  if (route !== "files") return send(res, 404, { error: "Not found." });
  if (!isSignedIn(req)) return send(res, 401, { error: "Please enter the Studio password again." });
  if (!TOKEN) return send(res, 503, { error: "Render is missing GITHUB_TOKEN (Environment). See the README." });

  if (req.method === "GET") {
    const lists = await Promise.all(FOLDERS.map((dir) => github(`/contents/${dir}?ref=${BRANCH}`)));
    const files = lists.flatMap((list) => (Array.isArray(list) ? list : []))
      .filter((f) => f.type === "file" && /\.html?$/i.test(f.name))
      .map((f) => ({ path: f.path, name: f.name, sha: f.sha }));
    return send(res, 200, files);
  }

  if (overLimit(`write:${ip}`, 60)) return send(res, 429, { error: "Too many changes in a short time. Wait a bit and try again." });
  count(`write:${ip}`, 60 * 60 * 1000);
  const { path: filePath, content, sha, message } = await readJson(req);
  if (!validPath(filePath)) return send(res, 400, { error: "Only .html files in emails/, blog/ or uploads/ can be changed." });

  if (req.method === "PUT") {
    if (typeof content !== "string" || !content) return send(res, 400, { error: "The file is empty." });
    const saved = await github(`/contents/${encodePath(filePath)}`, {
      method: "PUT",
      body: { message: String(message || `Update ${filePath}`).slice(0, 200), branch: BRANCH, content, ...(sha && { sha }) },
    });
    return send(res, 200, { path: saved.content.path, name: saved.content.name, sha: saved.content.sha });
  }
  if (req.method === "DELETE") {
    await github(`/contents/${encodePath(filePath)}`, { method: "DELETE", body: { message: `Delete: ${filePath}`, sha, branch: BRANCH } });
    return send(res, 200, { ok: true });
  }
  return send(res, 405, { error: "Not allowed." });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const LIMIT = 8 * 1024 * 1024; // a 5 MB HTML file, once encoded
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= LIMIT) chunks.push(chunk);
    });
    req.on("end", () => {
      if (size > LIMIT) return reject(Object.assign(new Error("The file is too big (max 5 MB)."), { status: 413 }));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(Object.assign(new Error("Invalid request."), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------- Static files
function serveFile(req, res, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath).replace(/^\/+/, "") || "index.html"; } catch { rel = ""; }
  const file = path.normalize(path.join(ROOT, rel));
  const top = rel.split("/")[0];
  const allowed = file.startsWith(ROOT + path.sep) && (PUBLIC_FILES.includes(rel) || (FOLDERS.includes(top) && rel.includes("/")));
  if (!allowed || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}

// ---------------------------------------------------------------- Server
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/healthz") return send(res, 200, { ok: true });
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname.slice(5));
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Not allowed." });
    return serveFile(req, res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, err.status || 500, { error: err.message || "Something went wrong." });
  }
}).listen(PORT, () => {
  console.log(`Site running on port ${PORT}`);
  if (!TOKEN) console.warn("⚠ Studio can't save files: set GITHUB_TOKEN in Render → Environment.");
  console.log(OPEN ? "Studio: open (no STUDIO_PASSWORD set)" : "Studio: protected with STUDIO_PASSWORD");
});
