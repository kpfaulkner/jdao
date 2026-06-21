# SCHOOLNIGHTS

A web-based, DOOM-1993-style raycasting FPS. Three levels — a FNAF
schoolhouse, a Pac-Man maze, and a Wolfenstein/DOOM bunker — built from
three files with **no build step and no dependencies**. See
[`design.md`](design.md) for how it works.

## Run locally

Just open `index.html` in a browser. (Pointer lock and audio behave best
when served over `http`/`https` rather than `file://`, e.g.
`python -m http.server` then visit `http://localhost:8000`.)

## Deploy on Render

The repo includes a [`render.yaml`](render.yaml) blueprint, so deploying
is a static-site click-through:

1. Push this repo to GitHub/GitLab.
2. In the [Render dashboard](https://dashboard.render.com): **New → Blueprint**,
   and select this repo. Render reads `render.yaml` and creates a static
   site (publish directory `.`, no build command). Click **Apply**.
3. Your game goes live at `https://schoolnights.onrender.com` (or the
   name you choose). Render auto-redeploys on every push.

Prefer to skip the blueprint? Do it manually instead: **New → Static Site**,
pick the repo, leave **Build Command** blank, and set **Publish Directory**
to `.`.
