const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Link-in-bio page at /insta
app.get('/insta', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Song previews ("what i'm listening to" card, public/song-previews.js) ----
// Deezer's API can't be called from the browser (no CORS) and its 30-second
// preview links expire ~15 min after they're fetched, so the page asks here at
// play time. Only these pinned track IDs are served, so this isn't an open
// proxy. They mirror the data-deezer attributes in public/index.html; IDs were
// checked by hand (original versions, right artists) because Deezer search can
// return a different band with the same name.
const PREVIEW_TRACK_IDS = new Set([
  '3742100882', // DREAMS COME TRUE — excape.
  '1095607382', // Oh No — Biig Piig
  '4094689641', // Make Me Feel — oskar med k
  '623876072',  // DMMH — TRAILS
  '122222962',  // Warm Magic — Jadu Heart
  '1217594102', // You've Done Enough — Gorgon City & DRAMA
  '3958705891', // Lullabies (Adventure Club Remix) — Yuna
  '101009324',  // Loud Places — Jamie xx
  '1033112652', // Fire for You — Cannons
  '378940811',  // Because You Move Me — Tinlicker & Helsloot
  '403915272',  // A Moment Apart — ODESZA
]);
const PREVIEW_CACHE_MS = 10 * 60 * 1000; // under Deezer's ~15 min link expiry
const previewCache = new Map(); // id -> { url, at }

// Deezer serves previews per country, and this server runs in the US (Railway),
// where some tracks have no preview. For those, fall back to Apple's public
// 30-second preview of the same recording (iTunes lookup: no key, links
// don't expire). Keyed by Deezer ID → Apple track ID (from the page's links).
const APPLE_FALLBACK = {
  '101009324': '1525506990', // Loud Places — Jamie xx (no US preview on Deezer)
};

async function deezerPreview(id) {
  try {
    const r = await fetch(`https://api.deezer.com/track/${id}`, { signal: AbortSignal.timeout(8000) });
    const track = await r.json();
    return track.preview || null;
  } catch (err) {
    return null;
  }
}
async function applePreview(id) {
  const appleId = APPLE_FALLBACK[id];
  if (!appleId) return null;
  try {
    const r = await fetch(`https://itunes.apple.com/lookup?id=${appleId}&country=ca`, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    return (data.results && data.results[0] && data.results[0].previewUrl) || null;
  } catch (err) {
    return null;
  }
}

app.get('/api/preview/:id', async (req, res) => {
  const id = req.params.id;
  if (!PREVIEW_TRACK_IDS.has(id)) return res.status(404).json({ error: 'unknown track' });
  res.set('Cache-Control', 'no-store');
  const cached = previewCache.get(id);
  if (cached && Date.now() - cached.at < PREVIEW_CACHE_MS && req.query.fresh !== '1') {
    return res.json({ preview: cached.url });
  }
  const url = (await deezerPreview(id)) || (await applePreview(id));
  if (!url) return res.status(404).json({ error: 'no preview' });
  previewCache.set(id, { url, at: Date.now() });
  res.json({ preview: url });
});

// Redirect root to /insta for now
app.get('/', (req, res) => {
  res.redirect(301, '/insta');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
