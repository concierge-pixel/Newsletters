# Blog Review Portal

Your client reviews blog drafts (HTML/CSS) and approves them. Approved posts go live at `/blog/<slug>`.

## How it works
- **You (admin password):** upload `.html` drafts, add a note, delete posts.
- **Client (client password):** preview on desktop/mobile, comment, **Request changes** or **Approve & publish**.
- Files are stored in a separate GitHub repo (your "content repo"):
  - `drafts/<slug>.html` → waiting for review
  - `published/<slug>.html` → live
  - `meta/<slug>.json` → status, version, comments
- Render's disk is wiped on every restart, so GitHub is the storage. Every action is a commit, which gives you full history.
- Re-uploading a draft with the same title creates version 2, 3, and so on.

## 1. Two GitHub repos
1. `blog-review-portal` (this code), pushed from VS Code.
2. `megabliss-blog-content` (empty, can be **private**). Add a README so it has a `main` branch.

## 2. GitHub token
GitHub → Settings → Developer settings → Fine-grained tokens → Generate:
- Repository access: only `megabliss-blog-content`
- Permissions → Contents: **Read and write**

## 3. Run locally in VS Code
```bash
npm install
cp .env.example .env     # fill in your values
npm run dev              # http://localhost:3000
```

## 4. Push to GitHub
```bash
git init && git add . && git commit -m "Blog review portal"
git branch -M main
git remote add origin https://github.com/<you>/blog-review-portal.git
git push -u origin main
```

## 5. Deploy on Render
Render → New → **Blueprint** → choose the repo (it reads `render.yaml`), or New → Web Service:
- Build: `npm install` · Start: `npm start`
- Environment: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `ADMIN_PASSWORD`, `CLIENT_PASSWORD`, `SESSION_SECRET`

Send your client the Render URL and the client password.

## Notes
- The free Render plan sleeps after 15 minutes without traffic, so the first load can take about 30 seconds.
- Drafts load in a sandboxed iframe, so scripts inside a draft don't run. Use full image URLs (https://…) in drafts.
- Want approved posts to appear on megablissre.com as well? Add code to the `/approve` route in `server.js` that sends the HTML to your website's platform (for example, the WordPress REST API or a webhook).
