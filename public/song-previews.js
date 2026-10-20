// ============================================
// "On repeat" record player — 30-second Deezer previews.
// Tap the record (#vinyl) and it spins up a random song from the crate
// (.vinyl-crate rows in index.html, each with a data-deezer ID); tap again to
// stop. "now playing" shows the title plus that song's Spotify / Apple links.
// "see the crate" opens the full list; tapping a row plays that song.
// Preview URLs come from our server (/api/preview/:id in server.js) because
// Deezer blocks browser calls and its links expire ~15 min after fetching.
// Gotcha: iOS only lets audio start inside the tap itself, so URLs are fetched
// ahead of time (when the card scrolls near) and play() runs straight from the
// tap. If a link has expired anyway, we fetch a fresh one and retry once.
// ============================================
(() => {
  const turntable = document.getElementById('turntable');
  const vinyl = document.getElementById('vinyl');
  const npBox = document.querySelector('.now-playing');
  const npTitle = document.getElementById('npTitle');
  const npLinks = document.getElementById('npLinks');
  const crateToggle = document.getElementById('crateToggle');
  const crateEl = document.getElementById('vinylCrate');
  if (!turntable || !vinyl || !crateEl) return;

  const crate = [...crateEl.querySelectorAll('.playlist-track[data-deezer]')].map((row) => ({
    row,
    id: row.dataset.deezer,
    title: row.querySelector('.track-title').textContent,
    links: row.querySelector('.track-links'),
  }));
  if (!crate.length) return;

  const URL_FRESH_MS = 9 * 60 * 1000; // re-fetch before the server's 10 min cache lapses
  const IDLE_LABEL = 'Play a random song from my rotation';
  const urls = new Map(); // deezer id -> { url, at }
  const audio = new Audio();
  audio.preload = 'none';
  let current = null;   // the song playing (or loading)
  let lastPick = null;  // never pick the same song twice in a row
  let retried = false;  // one expired-link retry per play

  async function fetchUrl(id, fresh) {
    const res = await fetch(`/api/preview/${id}${fresh ? '?fresh=1' : ''}`);
    if (!res.ok) throw new Error('no preview');
    const { preview } = await res.json();
    urls.set(id, { url: preview, at: Date.now() });
    return preview;
  }
  function cachedUrl(id) {
    const c = urls.get(id);
    return c && Date.now() - c.at < URL_FRESH_MS ? c.url : null;
  }
  function randomSong() {
    const pool = crate.length > 1 ? crate.filter((s) => s !== lastPick) : crate;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function show(song) {
    npTitle.textContent = song.title;
    npLinks.replaceChildren(...[...song.links.children].map((a) => a.cloneNode(true)));
    npBox.classList.add('has-song');
  }
  function stop() {
    audio.pause();
    turntable.classList.remove('spinning');
    if (current) current.row.classList.remove('is-playing');
    vinyl.setAttribute('aria-label', IDLE_LABEL);
    current = null;
  }

  // Starts `song`. Kept free of awaits before audio.play() when the URL is
  // cached, so iOS still counts it as part of the tap.
  async function play(song) {
    if (current) current.row.classList.remove('is-playing');
    current = song;
    lastPick = song;
    retried = false;
    show(song);
    song.row.classList.add('is-playing');
    turntable.classList.add('spinning');
    vinyl.setAttribute('aria-label', `Stop ${song.title}`);
    try {
      const url = cachedUrl(song.id) || await fetchUrl(song.id);
      if (current !== song) return; // another tap won while we were loading
      audio.src = url;
      await audio.play();
    } catch (err) {
      // e.g. iOS refusing to start outside the tap. The URL is cached now,
      // so tapping again plays immediately.
      if (current === song) stop();
    }
  }

  vinyl.addEventListener('click', () => {
    if (current) stop();
    else play(randomSong());
  });

  crate.forEach((song) => {
    song.row.setAttribute('role', 'button');
    song.row.tabIndex = 0;
    song.row.setAttribute('aria-label', `Play ${song.title}`);
    const choose = () => (current === song ? stop() : play(song));
    song.row.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; // Spotify / Apple links open normally
      choose();
    });
    song.row.addEventListener('keydown', (e) => {
      if (e.target !== song.row || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      choose();
    });
  });

  crateToggle.addEventListener('click', () => {
    const open = crateEl.classList.toggle('open');
    crateToggle.setAttribute('aria-expanded', String(open));
    crateToggle.textContent = open ? 'hide the crate' : 'see the crate';
  });

  // An expired or broken link: fetch a fresh one and retry once.
  audio.addEventListener('error', async () => {
    if (!current || retried) { stop(); return; }
    retried = true;
    const song = current;
    try {
      audio.src = await fetchUrl(song.id, true);
      if (current === song) await audio.play();
    } catch { if (current === song) stop(); }
  });
  audio.addEventListener('ended', stop);

  // Warm the URL cache once the card is near the screen.
  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    crate.forEach((s) => fetchUrl(s.id).catch(() => {}));
  }, { rootMargin: '300px' }).observe(turntable);
})();
