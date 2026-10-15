// Decides whether an HTML file is an email or a blog post.
// Used by build.js (on Render) and by admin.html (in the browser), so both always agree.
// Emails are built with tables, a ~600px column and Outlook tricks; blog posts look like web pages.

(function (root) {
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

  if (typeof module === "object" && module.exports) module.exports = detectType;
  else root.detectType = detectType;
})(this);
