# Emails & Blog: preview gallery for your client

A simple page where your client can see your **emails (newsletters)** and **blog posts** built with HTML and CSS.
It is 100% static: HTML, CSS and plain JavaScript. No server, no database, no passwords.

## How it works

1. You upload an `.html` file (for example one made with Perplexity) to the **`uploads/`** folder on GitHub.
2. Render sees the change and republishes the site automatically (takes 1–2 minutes).
   It detects by itself whether each file is an **email** or a **blog post**.
3. Your client opens the Render link and sees everything as cards. One click opens it full screen, with a **Desktop** / **Mobile** switch.
4. If you turned on feedback (see below), she clicks **Leave feedback**, picks **Love it** or **Needs changes**,
   writes a comment, and it arrives in your email inbox.

## Uploading an email or blog post (from the browser)

1. On GitHub, open the `uploads` folder.
2. Click **Add file → Upload files** and drag in your `.html` (plus its images, if any).
3. Click **Commit changes**. Done.

If the site guesses the type wrong, upload that file to `emails/` or `blog/` instead: those folders force the type.
To remove a file, open it on GitHub and choose the **…** menu → **Delete file**.

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

Anyone with the link can see the content (there is no password).
The page asks Google and other search engines not to index it (`robots.txt` and `noindex`).
If the GitHub repository is public, the files can also be seen on GitHub.

## Files

```
index.html     home page, viewer and feedback panel (what your client sees)
styles.css     design, colors and animations
app.js         plain JavaScript: cards, filters, viewer and feedback
uploads/       ← upload your .html files here (email or blog is detected automatically)
emails/        files here are always shown as emails
blog/          files here are always shown as blog posts
build.js       Render runs it: detects the type and creates the content.js list (no need to touch it)
package.json   only defines "npm run build"
render.yaml    the same Render settings, in case you ever create the service as a Blueprint
robots.txt     asks search engines not to index the site
```
