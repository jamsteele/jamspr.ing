# 📚 The Library

A cozy illustrated web room of public-domain short stories.
Lives as a path on jamspr.ing: **`jamspr.ing/library`**

> *"They just stepped out — feel free to poke around."*

See [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) for the full vision, MVP scope, story catalog, and Phase 2 roadmap.

---

## Running locally

This is part of the jamspr.ing Express app. From the **jamspr.ing project root** (one level up from this folder):

```bash
npm install        # if you haven't already
npm start          # runs server.js on port 3000
```

Then open: <http://localhost:3000/library>

Or you can serve just this folder for fast frontend iteration:

```bash
cd public/library
npx serve .        # opens on a random port, no Express needed
```

---

## File structure

```
public/library/
├── index.html              ← the room (HTML)
├── style.css               ← visuals
├── script.js               ← story loading + modal logic
├── README.md               ← (this file)
├── PROJECT_PLAN.md         ← full project plan & roadmap
├── assets/                 ← (create when you have art)
│   ├── room.png            ← the illustrated scene (TODO)
│   └── objects/            ← optional hover-state overlays (TODO)
└── stories/
    ├── index.json          ← metadata for all 17 pieces
    ├── README.md           ← how to fetch + format story text
    └── *.md                ← one file per story (TODO: populate)
```

---

## What works right now (scaffold state)

✅ Express route at `/library` returns this page
✅ Page loads `stories/index.json` and renders one hotspot per story
✅ Hotspots are auto-positioned in a grid until the real room art is in place
✅ Clicking a hotspot opens a modal that *would* show the story text
✅ When a story's `.md` file doesn't exist yet, the modal shows a placeholder + Project Gutenberg link
✅ Modal closes on backdrop click, close button, and Escape key
✅ Mobile-responsive

## What's not done yet (next steps in priority order)

1. **Populate the 17 story Markdown files** — see `stories/README.md` for the workflow
2. **Generate or commission the illustrated room** — see PROJECT_PLAN.md → Art Direction
3. **Replace the placeholder background** in `style.css` (`.room` selector — comment in the file shows where) with the real image
4. **Position the hotspots over real objects** — add `position: { top, left, width, height }` to each story in `index.json`
5. **Add the easter egg** — see PROJECT_PLAN.md → MVP Easter Egg
6. **Add ambient animation** (steam, leaves, gentle wind) — CSS-only, see Phase 2 in PROJECT_PLAN.md

---

## Tone & curation reminders

(Pulled from PROJECT_PLAN.md — keep these in mind when adding stories or features.)

- Middle-school appropriate. Spooky, sad, philosophical = fine. Sex, slurs, graphic gore = no.
- Vancouver-coded touches stay subtle (rainy window, mountains, cedar — no Canucks jerseys).
- Curation is the moat. Don't dilute the shelf with mediocre stories.
- The visitor is a thoughtful adult; the kid-safe bar is just a floor.

---

## Deploy

This deploys with the rest of jamspr.ing. From the jamspr.ing project root:

```bash
git add .
git commit -m "library: <what you did>"
git push          # Railway auto-deploys
```

After deploy, visit <https://jamspr.ing/library>.
