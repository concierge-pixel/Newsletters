# Emails & Blog: preview gallery for your client

A simple page where your client can see your **emails (newsletters)** and **blog posts** built with HTML and CSS.
HTML, CSS and plain JavaScript, plus a tiny server for your Studio. No database.

## How it works

1. You open **your Studio page** (`https://your-site.onrender.com/admin.html`) and drop the `.html` files you create
   (for example with Perplexity). It tells you right away whether each one is an **email** or a **blog post**.
2. You click **Publish**. The file is saved in this GitHub repository and Render republishes the site (1–2 minutes).
3. Your client opens the Render link and sees everything as cards. One click opens it full screen, with a **Desktop** / **Mobile** switch.
4. She clicks **Leave feedback**, picks **Love it** or **Needs changes**, writes a comment, and it arrives in your email inbox.

No database: GitHub stores the files and a tiny server on Render (`server.js`, no extra packages) publishes them.

## Studio: upload, replace and delete (admin.html)

Open `https://your-site.onrender.com/admin.html`, or click **Upload files (Studio)** at the bottom of the client page.
It is open to anyone with the link (no password). The GitHub token never reaches the browser: it stays on the server.

**Every day:**

- **Upload:** drag your HTML files onto the drop area (or click it). Check the Email / Blog switch and click **Publish**.
  New files get today's date in their name, so the newest show first.
- **Replace:** three ways, and the link your client has keeps working:
  - click **↻ Replace** on a file and choose the new version;
  - drag the new version straight onto that file in **Your files**;
  - or just upload it: if it has the same title as an existing piece, the Studio offers to replace it
    (you can also pick which one to replace, or keep it as a new file).
- **Delete:** click **Delete**. It disappears from the client page.
- A green banner tells you when the change is live on the client page.

**Without the Studio:** you can also upload on GitHub directly, into the `uploads/` folder
(**Add file → Upload files**). The type is detected automatically; `emails/` and `blog/` force the type.

Tips:

- The card title comes from the `<title>` tag in the HTML. If there isn't one, the file name is used.
- If the file name starts with a date (`2026-10-15-october-newsletter.html`), the card shows that date and is sorted newest first.
- Images: use full links (`https://…`), like Perplexity and Canva/Kit exports do. The Studio uploads HTML files only.
- Every email or post has its own link, for example
  `https://your-site.onrender.com/#emails/2026-10-15-sacramento-bliss-october.html`.
  You can send it straight to your client.

## Render setup (one time only)

In Render create a **Web Service** (New → Web Service) from this repository with:

| Field              | Value                                   |
| ------------------ | --------------------------------------- |
| Language           | Node                                    |
| Branch             | `main`                                  |
| Root Directory     | *(empty)*                               |
| Build Command      | `npm install`                           |
| Start Command      | `npm start`                             |
| Instance Type      | **Free**                                |
| Health Check Path  | `/healthz` (under Advanced, optional)   |

**Environment Variables:**

- `GITHUB_TOKEN` (required for the Studio): signed in to GitHub as `concierge-pixel`, open
  https://github.com/settings/tokens/new?scopes=repo&description=Newsletters%20Studio, choose an expiration,
  leave **repo** checked and click **Generate token**.
  (A fine-grained token also works, but it needs **Only select repositories → concierge-pixel/Newsletters** and
  **Contents: Read and write**; the default "Public repositories" option is read-only and the Studio can't save.)

The free plan sleeps after 15 minutes without visits; the first visit after that takes about 30 seconds.

## Turning on client feedback (free, no database)

Comments are sent with [Web3Forms](https://web3forms.com), a free form service (250 messages a month).

1. Go to https://web3forms.com, type the email where you want to receive comments and click **Create Access Key**.
2. Copy the key they email you (it looks like `a1b2c3d4-…`). It is safe to make it public.
3. On GitHub, open `app.js`, click the pencil ✏️, paste the key between the quotes on line 7:
   `const FEEDBACK_KEY = "a1b2c3d4-…";` and click **Commit changes**.

Your client will see a **Leave feedback** button on every email and blog post. Each comment arrives in your inbox
with the piece's title, her verdict (Love it / Needs changes), her comment and a direct link.
Her browser also remembers what she already reviewed and shows it on the cards.

## Customizing (optional)

- **Colors**: at the top of `styles.css` (currently the MegaBliss purple, lavender and cream).
- **Home page text**: in `index.html`.
- **Animations**: they turn off automatically for people who set "reduce motion" on their device.

## Privacy

Anyone with the link can see the content and use the Studio (no passwords). The Studio can only add, replace or delete
`.html` files in `emails/`, `blog/` and `uploads/` (at most 60 changes per hour per visitor), and every change is saved
in GitHub's history, so anything can be restored. The GitHub token stays on the server, never in the browser or the code.
The page asks Google and other search engines not to index it (`robots.txt` and `noindex`).
If the GitHub repository is public, the files can also be seen on GitHub.

## Files

```
index.html     home page, viewer and feedback panel (what your client sees)
admin.html     your Studio: upload, replace and delete files (not linked from the client page)
admin.js       Studio logic (talks to server.js)
server.js      tiny web server: serves the site and saves Studio changes to GitHub with GITHUB_TOKEN
styles.css     design, colors and animations
app.js         plain JavaScript: cards, filters, viewer and feedback
detect.js      decides if an HTML is an email or a blog post (used by the Studio and by build.js)
emails/        emails (the Studio saves them here)
blog/          blog posts (the Studio saves them here)
uploads/       files uploaded directly on GitHub; the type is detected automatically
build.js       Render runs it: detects the type and creates the content.js list (no need to touch it)
package.json   "npm start" runs server.js; "npm install" also runs build.js
render.yaml    the same Render settings, in case you ever create the service as a Blueprint
robots.txt     asks search engines not to index the site
```
