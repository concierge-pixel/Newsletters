// Render runs this file on every deploy (Build Command: npm run build, and also on npm install).
// It finds the .html files in "uploads/", "emails/" and "blog/" and writes content.js with the list,
// which the page (index.html) uses to show the cards. You don't need to touch it.

const fs = require("fs");
const path = require("path");

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

// Emails are built with tables, a ~600px column and Outlook tricks; blog posts look like web pages.
function detectType(html) {
  const has = (re) => re.test(html);
  let email = 0;
  let blog = 0;
  if (has(/role=["']presentation["']/i)) email += 3;
  if (has(/<!--\[if [^\]]*mso/i)) email += 3;
  if (has(/\bbgcolor=/i)) email += 1;
  if (has(/\bcellpadding=/i)) email += 1;
  if (has(/max-width:\s*(5[5-9]|6[0-9])0px|width=["'](5[5-9]|6[0-9])0["']/i)) email += 2;
  if (has(/unsubscribe|view (it )?in (your )?browser|manage (your )?preferences|\*\|[A-Z_]+\|\*/i)) email += 2;
  if ((html.match(/<table\b/gi) || []).length >= 3) email += 2;
  if (has(/<article\b/i)) blog += 3;
  if (has(/<main\b/i)) blog += 2;
  if (has(/<nav\b/i)) blog += 2;
  if (has(/<section\b/i)) blog += 1;
  if (has(/<(time|figure|blockquote)\b/i)) blog += 1;
  if (has(/display:\s*(flex|grid)/i)) blog += 1;
  if (has(/<script\b/i)) blog += 1;
  if (has(/<meta[^>]+name=["']description["']/i)) blog += 1;
  return email > blog ? "email" : "blog";
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
