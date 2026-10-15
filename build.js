// Render runs this file on every deploy (Build Command: npm run build, and also on npm install).
// It finds the .html files in "uploads/", "emails/" and "blog/" and writes content.js with the list,
// which the page (index.html) uses to show the cards. You don't need to touch it.

const fs = require("fs");
const path = require("path");
const detectType = require("./detect.js");

// null = detect automatically whether each file is an email or a blog post.
const FOLDERS = { uploads: null, emails: "email", blog: "blog" };

function findHtml(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((e) => {
    const file = path.join(folder, e.name);
    if (e.isDirectory()) return findHtml(file);
    return /\.html?$/i.test(e.name) ? [file] : [];
  });
}

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// "2026-10-15-october-newsletter.html" → "October newsletter"
function titleFromFilename(name) {
  const t = name.replace(/\.html?$/i, "").replace(/^\d{4}-\d{2}-\d{2}[-_ ]?/, "").replace(/[-_]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : name;
}

const content = [];
for (const [folder, forcedType] of Object.entries(FOLDERS)) {
  for (const file of findHtml(folder)) {
    const html = fs.readFileSync(file, "utf8");
    const name = path.basename(file);
    const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();
    const type = forcedType || detectType(html);
    // On Render: links inside each piece open in a new tab (the preview frame is sandboxed).
    if (process.env.RENDER && !/<base\b/i.test(html)) {
      fs.writeFileSync(file, html.replace(/<head[^>]*>/i, (head) => `${head}<base target="_blank">`));
    }
    content.push({
      type,
      path: file.split(path.sep).join("/"),
      title: title || titleFromFilename(name),
      date: name.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null,
    });
    console.log(`  ${type === "email" ? "Email" : "Blog "}  ${file}${forcedType ? "" : "  (detected automatically)"}`);
  }
}

// Files with a date in their name come first (newest on top), then the rest by name.
content.sort((a, b) =>
  (b.date || "").localeCompare(a.date || "") || a.path.localeCompare(b.path));

fs.writeFileSync(
  "content.js",
  "// Generated automatically by build.js — do not edit.\n" +
  `window.CONTENT = ${JSON.stringify(content, null, 2)};\n`,
);

const emails = content.filter((c) => c.type === "email").length;
console.log(`✓ content.js ready: ${emails} email(s) and ${content.length - emails} blog post(s)`);
