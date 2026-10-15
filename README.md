# Emails & Blog: preview gallery for your client

A simple page where your client can see your **emails (newsletters)** and **blog posts** built with HTML and CSS.
It is 100% static: HTML, CSS and plain JavaScript. No server, no database, no passwords.

## How it works

1. You upload an `.html` file to the **`emails/`** or **`blog/`** folder on GitHub.
2. Render sees the change and republishes the site automatically (takes 1–2 minutes).
3. Your client opens the Render link and sees everything as cards. One click opens it full screen, with a **Desktop** / **Mobile** switch.

## Uploading an email or blog post (from the browser)

1. On GitHub, open the `emails` folder (or `blog`).
2. Click **Add file → Upload files** and drag in your `.html` (plus its images, if any).
3. Click **Commit changes**. Done.

To remove one, open it on GitHub and choose the **…** menu → **Delete file**.

Tips:

- The card title comes from the `<title>` tag in the HTML. If there isn't one, the file name is used.
- If the file name starts with a date (`2026-10-15-october-newsletter.html`), the card shows that date and is sorted newest first.
- Images: use the full link (`https://…`) or upload them to the same folder and use just the name (`<img src="photo.jpg">`).
- Every email or post has its own link, for example
  `https://your-site.onrender.com/#emails/2026-10-15-sacramento-bliss-october.html`.
  You can send it straight to your client.

## Render setup (one time only)

In Render, create a **Static Site** (or open the existing one → **Settings → Build & Deploy**) with:

| Field                 | Value           |
| --------------------- | --------------- |
| Branch                | `main`          |
| Root Directory        | *(empty)*       |
| Build Command         | `npm run build` |
| Publish Directory     | `./`            |
| Environment Variables | *(none)*        |

`npm run build` just runs `build.js`, which builds the file list (`content.js`) for the page.
It installs nothing and needs no environment variables. It also works if the Build Command is left empty,
because Render runs `npm install`, which runs `build.js` too.

> **Watch out:** Publish Directory is a **folder**, not the branch. If you put `main` there, Render fails with
> *"Publish directory main does not exist!"*. The `main` branch goes in the **Branch** field.

## Customizing (optional)

- **"Send feedback" button**: in `app.js`, line 6, put your email between the quotes:
  `const FEEDBACK_EMAIL = "you@example.com";`
  Your client will see a button that opens their email app with the post title already filled in.
- **Colors**: at the top of `styles.css`.
- **Home page text**: in `index.html`.

## Privacy

Anyone with the link can see the content (there is no password).
The page asks Google and other search engines not to index it (`robots.txt` and `noindex`).
If the GitHub repository is public, the files can also be seen on GitHub.

## Files

```
index.html     home page and viewer (what your client sees)
styles.css     design
app.js         plain JavaScript: cards, filters and viewer
emails/        ← upload your email .html files here
blog/          ← upload your blog post .html files here
build.js       Render runs it: creates the content.js list (no need to touch it)
package.json   only defines "npm run build"
render.yaml    the same Render settings, in case you ever create the service as a Blueprint
robots.txt     asks search engines not to index the site
```
