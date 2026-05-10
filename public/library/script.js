/* =========================================================
   The Library — story loading and reader
   - Loads stories/index.json on page load
   - Renders one hotspot per story (placeholder grid until art is in)
   - On click: fetches stories/<id>.md and renders in the modal
   ========================================================= */

const ROOM = document.getElementById('room');
const READER = document.getElementById('reader');
const STORY_TITLE = document.getElementById('story-title');
const STORY_CONTENT = document.getElementById('story-content');
const STORY_NOTE = document.getElementById('story-note');

async function init() {
  try {
    const res = await fetch('stories/index.json');
    if (!res.ok) throw new Error(`index.json: ${res.status}`);
    const data = await res.json();

    const annotateMode = new URLSearchParams(window.location.search).has('annotate');
    if (annotateMode) {
      // Skip everything else; the annotation UI takes over the page
      setupAnnotateMode();
      return;
    }

    renderHotspots(data.stories || []);
    setupModalControls();
    setupPaintedLights();
    setupCherrySprigEasterEgg();
    setupScrollHints();
    setupDiscoveryPulse();
  } catch (err) {
    console.error('Failed to load story index:', err);
    showRoomError('Could not load the story index. See console for details.');
  }
}

/* ---------- Annotate mode ----------
   Visit /library?annotate. Click each painted light in the room. Positions
   are recorded as % of room dimensions. When done, hit "Copy" to get the
   PAINTED_LIGHT_POSITIONS array on your clipboard, paste into script.js. */

function setupAnnotateMode() {
  const room = document.getElementById('room');
  const wrapper = document.getElementById('room-wrapper');
  if (!room) return;

  const points = [];

  // Floating panel UI
  const panel = document.createElement('div');
  panel.id = 'annotate-panel';
  panel.innerHTML = `
    <div class="annotate-title">🎯 Light Annotation Mode</div>
    <div class="annotate-hint">Click each painted light. Scroll the room to find them all.</div>
    <div class="annotate-stats"><span id="annotate-count">0</span> lights marked</div>
    <div class="annotate-actions">
      <button id="annotate-undo">Undo last</button>
      <button id="annotate-clear">Clear all</button>
      <button id="annotate-copy">Copy positions</button>
    </div>
    <textarea id="annotate-output" readonly></textarea>
  `;
  document.body.appendChild(panel);

  // Crosshair on hover over the room
  room.style.cursor = 'crosshair';

  function refresh() {
    document.getElementById('annotate-count').textContent = points.length;
    document.getElementById('annotate-output').value = formatJS(points);
    // Redraw markers
    document.querySelectorAll('.annotate-marker').forEach((el) => el.remove());
    points.forEach((p, i) => {
      const marker = document.createElement('div');
      marker.className = 'annotate-marker';
      marker.style.left = `${p.x}%`;
      marker.style.top = `${p.y}%`;
      marker.textContent = i + 1;
      room.appendChild(marker);
    });
  }

  function formatJS(pts) {
    if (!pts.length) return 'const PAINTED_LIGHT_POSITIONS = [];';
    return 'const PAINTED_LIGHT_POSITIONS = [\n' +
      pts.sort((a, b) => a.y - b.y || a.x - b.x)
         .map((p) => `  { x: ${p.x.toFixed(2)}, y: ${p.y.toFixed(2)} },`)
         .join('\n') +
      '\n];';
  }

  room.addEventListener('click', (e) => {
    if (e.target !== room && !e.target.classList.contains('annotate-marker')) return;
    const rect = room.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    points.push({ x, y });
    refresh();
  });

  document.getElementById('annotate-undo').addEventListener('click', () => {
    points.pop();
    refresh();
  });
  document.getElementById('annotate-clear').addEventListener('click', () => {
    points.length = 0;
    refresh();
  });
  document.getElementById('annotate-copy').addEventListener('click', async (e) => {
    const ta = document.getElementById('annotate-output');
    ta.select();
    try {
      await navigator.clipboard.writeText(ta.value);
      e.target.textContent = 'Copied ✓';
      setTimeout(() => { e.target.textContent = 'Copy positions'; }, 1500);
    } catch {
      e.target.textContent = 'Select & copy ↓';
    }
  });

  refresh();
}

/* ---------- Painted-lights twinkle ----------
   Positions are % of room width/height, hand-tuned to sit over each painted
   light in assets/room.png. Two strings:
     1. Around the window frame on the left (top edge + left side + partial right side)
     2. Along the right-hand shelf
   If the painting is replaced/edited, re-tune these positions. */

// Hand-clicked via the annotate mode (visit /library?annotate to re-capture).
// Order: top of window → window frame perimeter → right shelf string.
const PAINTED_LIGHT_POSITIONS = [
  { x: 13.88, y: 3.33 },
  { x: 17.32, y: 4.43 },
  { x: 21.02, y: 4.93 },
  { x: 10.59, y: 5.30 },
  { x: 24.47, y: 5.54 },
  { x: 27.75, y: 6.03 },
  { x: 30.79, y: 6.03 },
  { x: 34.15, y: 6.65 },
  { x: 36.95, y: 7.27 },
  { x: 39.82, y: 7.76 },
  { x: 42.78, y: 8.00 },
  { x: 45.73, y: 8.25 },
  { x: 48.77, y: 8.87 },
  { x: 51.15, y: 9.61 },
  { x: 10.51, y: 10.84 },
  { x: 51.72, y: 12.93 },
  { x: 10.59, y: 16.13 },
  { x: 51.81, y: 17.61 },
  { x: 99.51, y: 17.86 },
  { x: 97.13, y: 18.60 },
  { x: 94.58, y: 18.72 },
  { x: 92.12, y: 19.46 },
  { x: 89.00, y: 20.07 },
  { x: 84.15, y: 20.32 },
  { x: 86.54, y: 20.32 },
  { x: 79.64, y: 20.81 },
  { x: 81.94, y: 20.81 },
  { x: 51.89, y: 21.55 },
  { x: 10.43, y: 21.92 },
  { x: 51.81, y: 25.74 },
  { x: 10.26, y: 27.34 },
  { x: 51.89, y: 29.80 },
  { x: 10.26, y: 32.88 },
  { x: 51.97, y: 34.36 },
  { x: 51.97, y: 38.55 },
  { x: 10.26, y: 54.19 },
];

function setupPaintedLights() {
  const container = document.getElementById('painted-lights');
  if (!container) return;
  PAINTED_LIGHT_POSITIONS.forEach((pos, i) => {
    const el = document.createElement('span');
    el.className = 'painted-light';
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
    // Each light twinkles on its own duration + delay so the string feels alive
    el.style.setProperty('--dur', `${(2.4 + Math.random() * 2.4).toFixed(2)}s`);
    el.style.setProperty('--delay', `${(Math.random() * 3).toFixed(2)}s`);
    el.style.setProperty('--idx', i);
    container.appendChild(el);
  });
}

/* ---------- Easter egg: cherry sprig ---------- */

let sprigClicks = 0;
let sprigTimer = null;

function setupCherrySprigEasterEgg() {
  const sprig = document.getElementById('cherry-sprig');
  const room = document.getElementById('room');
  const petalLayer = document.getElementById('petal-layer');
  if (!sprig) return;

  sprig.addEventListener('click', (e) => {
    e.stopPropagation();
    sprigClicks++;
    sprig.classList.remove('shake');
    void sprig.offsetWidth;
    sprig.classList.add('shake');

    if (sprigTimer) clearTimeout(sprigTimer);
    sprigTimer = setTimeout(() => { sprigClicks = 0; }, 1200);

    if (sprigClicks >= 3) {
      sprigClicks = 0;
      triggerEasterEgg(room, petalLayer);
    }
  });
}

function triggerEasterEgg(room, petalLayer) {
  // Bloom flash — the painting's own fairy lights "pulse"
  if (room) {
    room.classList.remove('bloom');
    void room.offsetWidth;
    room.classList.add('bloom');
    setTimeout(() => room.classList.remove('bloom'), 2300);
  }

  // Painted-lights wave — every twinkling light pulses bright in a cascade
  const lights = document.getElementById('painted-lights');
  if (lights) {
    lights.classList.remove('wave');
    void lights.offsetWidth;
    lights.classList.add('wave');
    setTimeout(() => lights.classList.remove('wave'), 2400);
  }

  // Drift petals
  if (petalLayer) {
    const PETAL_COUNT = 40;
    for (let i = 0; i < PETAL_COUNT; i++) {
      const petal = document.createElement('span');
      petal.className = 'petal';
      const startX = Math.random() * 100;
      const driftX = (Math.random() - 0.5) * 200;
      const rot = Math.random() * 360;
      const rotEnd = rot + (Math.random() * 720 - 360);
      const duration = 5 + Math.random() * 4;
      const delay = Math.random() * 1.5;
      petal.style.left = `${startX}%`;
      petal.style.setProperty('--drift-x', `${driftX}px`);
      petal.style.setProperty('--rot', `${rot}deg`);
      petal.style.setProperty('--rot-end', `${rotEnd}deg`);
      petal.style.setProperty('--duration', `${duration.toFixed(2)}s`);
      petal.style.setProperty('--delay', `${delay.toFixed(2)}s`);
      petalLayer.appendChild(petal);
      setTimeout(() => petal.remove(), (duration + delay + 0.5) * 1000);
    }
  }
}

/* ---------- Scroll hints ---------- */

function setupScrollHints() {
  const wrapper = document.getElementById('room-wrapper');
  if (!wrapper) return;

  const updateHints = () => {
    const max = wrapper.scrollWidth - wrapper.clientWidth;
    if (max <= 2) {
      // Room fits, no scroll affordance needed
      wrapper.classList.remove('has-scroll-left', 'has-scroll-right');
      return;
    }
    wrapper.classList.toggle('has-scroll-left', wrapper.scrollLeft > 8);
    wrapper.classList.toggle('has-scroll-right', wrapper.scrollLeft < max - 8);
  };

  updateHints();
  wrapper.addEventListener('scroll', updateHints, { passive: true });
  window.addEventListener('resize', updateHints, { passive: true });
}

/* ---------- One-time discovery pulse ---------- */
/* On first load, the hotspot dots briefly pulse so users learn objects are clickable.
   Fades out after a few seconds. */

function setupDiscoveryPulse() {
  const room = document.getElementById('room');
  if (!room) return;
  room.classList.add('hotspots-discovery-pulse');
  setTimeout(() => room.classList.remove('hotspots-discovery-pulse'), 5000);
}

/* Render a hotspot for each story.
   Positions come from index.json as % of room width/height — they overlay
   real objects in the painting. Falls back to a grid only if no positions
   are defined (debug/placeholder mode). */
function renderHotspots(stories) {
  stories.forEach((story, idx) => {
    const btn = document.createElement('button');
    btn.className = 'hotspot';
    btn.dataset.storyId = story.id;
    btn.dataset.label = `${story.title} — ${story.trinket || ''}`.replace(/ — $/, '');
    btn.setAttribute('aria-label', `Open “${story.title}” by ${story.author}`);

    const pos = story.position;
    if (pos) {
      Object.assign(btn.style, {
        top: pos.top,
        left: pos.left,
        width: pos.width || '5%',
        height: pos.height || '7%',
      });
    } else {
      // Fallback grid (only when no positions defined)
      const COLS = 5;
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      Object.assign(btn.style, {
        top: `${22 + row * 18}%`,
        left: `${10 + col * 18}%`,
        width: '5%',
        height: '7%',
      });
    }

    btn.addEventListener('click', () => openStory(story));
    // Add a touched class on tap (mobile) so the dot stays briefly visible
    btn.addEventListener('touchstart', () => {
      btn.classList.add('touched');
      setTimeout(() => btn.classList.remove('touched'), 1200);
    }, { passive: true });
    ROOM.appendChild(btn);
  });
}

async function openStory(story) {
  // Header
  STORY_TITLE.textContent = story.title;
  document.querySelector('.story-author').textContent = story.author;
  document.querySelector('.story-country').textContent = story.country;
  document.querySelector('.story-flag').textContent = story.countryFlag || '';
  document.querySelector('.story-mins').textContent = story.minutes
    ? `${story.minutes} min read`
    : '';

  // Content note (e.g., "A Squamish legend, told to Pauline Johnson by Chief Joe Capilano, 1911.")
  if (story.contentNote) {
    STORY_NOTE.textContent = story.contentNote;
    STORY_NOTE.hidden = false;
  } else {
    STORY_NOTE.hidden = true;
  }

  // Content
  STORY_CONTENT.innerHTML = '<p><em>Loading…</em></p>';
  openReader();

  try {
    const res = await fetch(`stories/${story.id}.md`);
    if (!res.ok) throw new Error('not-found');
    const md = await res.text();
    STORY_CONTENT.innerHTML = window.marked
      ? window.marked.parse(md)
      : `<pre>${escapeHtml(md)}</pre>`;
    STORY_CONTENT.scrollTop = 0;
  } catch (err) {
    const sourceLink = story.source
      ? `<p>You can find the original at <a href="${story.source}" target="_blank" rel="noopener">${story.source}</a>.</p>`
      : '';
    STORY_CONTENT.innerHTML = `
      <p><em>This story hasn't been added to the library yet.</em></p>
      ${sourceLink}
      <p style="font-size:0.85em;color:var(--ink-soft);">
        To add it: drop a Markdown file at <code>stories/${story.id}.md</code>.
        See <code>stories/README.md</code> for instructions.
      </p>
    `;
  }
}

function openReader() {
  READER.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeReader() {
  READER.hidden = true;
  document.body.style.overflow = '';
}

function setupModalControls() {
  document.querySelectorAll('[data-close]').forEach((el) =>
    el.addEventListener('click', closeReader)
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !READER.hidden) closeReader();
  });
}

function showRoomError(msg) {
  const placeholder = document.querySelector('.room-placeholder');
  if (placeholder) {
    placeholder.innerHTML = `<p style="color:#ff8;">${msg}</p>`;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

init();
