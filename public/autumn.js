// ============================================
// Autumn layer — season toggle + overlay critters
// Lives on top of the untouched Cherry Blossom
// garden (garden.js). Flipping to autumn tints
// the canvas via CSS and reveals an SVG overlay
// with a hidden cat, jack-o-lantern, owl, crows,
// falling leaves, and a daily haiku.
// ============================================

const SEASON_KEY = 'jamspring.season';
const LANTERN_KEY = 'jamspring.lanternLit';

const LEAF_COLORS = ['#c74a2b', '#d87b2a', '#e5a93a', '#8a3a1c', '#b35a30'];
const LEAF_SPAWN_MS = 650;
const MAX_LEAVES = 14;

// Seeded daily haikus — same visitor sees the same one all day.
// Deliberately 5-7-5 syllable count, Vancouver-autumn-flavored.
const HAIKUS = [
  "cold rain on the seawall /\nmaples spill their copper coins /\nthe mountains lean in",
  "lanterns in a row /\nthe cat watches, unimpressed /\nby our fear of ghosts",
  "wet leaves on the stairs /\neach one a tiny red door /\nnobody opens",
  "steam from the kettle /\nthe long grey light settles down /\nover english bay",
  "crows know every roof /\nthey keep a map of the city /\nin their folded wings",
  "the owl says nothing /\nabout what you did last week /\nthe owl is my type",
  "pumpkin on a step /\nhollowed out, lit from inside /\nso are we, sometimes",
  "sweater weather starts /\nthe mountains put their coats on /\nfirst white dust on top",
  "dusk comes in early /\neverything is pink and gold /\nthen suddenly dark",
  "the trees know the trick: /\nlet go of what will not stay /\nthe wind does the rest",
];

function todayHaiku() {
  const d = new Date();
  const seed = d.getFullYear() * 1000 + (d.getMonth() + 1) * 50 + d.getDate();
  return HAIKUS[seed % HAIKUS.length];
}

function defaultSeason() {
  const month = new Date().getMonth(); // 0 = Jan
  // Autumn: September–November inclusive.
  return (month >= 8 && month <= 10) ? 'autumn' : 'spring';
}

function getSeason() {
  try {
    return localStorage.getItem(SEASON_KEY) || defaultSeason();
  } catch { return defaultSeason(); }
}

function setSeason(s) {
  try { localStorage.setItem(SEASON_KEY, s); } catch {}
  applySeason(s);
}

function applySeason(s) {
  document.body.classList.toggle('season-autumn', s === 'autumn');
  document.body.classList.toggle('season-spring', s === 'spring');
  document.querySelectorAll('.season-toggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.season === s);
    btn.setAttribute('aria-pressed', btn.dataset.season === s ? 'true' : 'false');
  });
  const hint = document.getElementById('gameHint');
  if (hint) {
    hint.textContent = s === 'autumn'
      ? 'tap the branches — the leaves will fall'
      : 'tap the bare branches to make them bloom';
  }
}

// ---- Hidden cat (eyes glow, tap → cat emerges, tap again → back to shadows) ----
function initCat() {
  const cat = document.getElementById('hiddenCat');
  if (!cat) return;
  cat.addEventListener('click', () => cat.classList.toggle('out'));
}

// ---- Jack-o-lantern (tap to light; state persists this session) ----
function initLantern() {
  const lantern = document.getElementById('jackOLantern');
  if (!lantern) return;
  try {
    if (sessionStorage.getItem(LANTERN_KEY) === '1') lantern.classList.add('lit');
  } catch {}
  lantern.addEventListener('click', () => {
    const lit = lantern.classList.toggle('lit');
    try { sessionStorage.setItem(LANTERN_KEY, lit ? '1' : '0'); } catch {}
  });
}

// ---- Haiku button (shows today's haiku, click again to hide) ----
function initHaiku() {
  const btn = document.getElementById('windHaikuBtn');
  const panel = document.getElementById('windHaiku');
  if (!btn || !panel) return;
  panel.textContent = todayHaiku();
  btn.addEventListener('click', () => panel.classList.toggle('show'));
}

// ---- Falling leaves (DOM-based, cheap, capped) ----
function spawnLeaf(container) {
  if (container.querySelectorAll('.autumn-leaf').length >= MAX_LEAVES) return;
  const leaf = document.createElement('div');
  leaf.className = 'autumn-leaf';
  leaf.style.left = (5 + Math.random() * 90) + '%';
  leaf.style.background = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];
  leaf.style.animationDuration = (6 + Math.random() * 5) + 's';
  leaf.style.setProperty('--drift', (Math.random() * 60 - 30) + 'px');
  leaf.style.opacity = (0.55 + Math.random() * 0.35).toFixed(2);
  leaf.addEventListener('animationend', () => leaf.remove());
  container.appendChild(leaf);
}

function startLeafFall() {
  const container = document.querySelector('.autumn-overlay');
  if (!container) return;
  setInterval(() => {
    if (document.body.classList.contains('season-autumn')) {
      spawnLeaf(container);
    }
  }, LEAF_SPAWN_MS);
}

// ---- Boot ----
function initSeasonToggle() {
  document.querySelectorAll('.season-toggle button').forEach(btn => {
    btn.addEventListener('click', () => setSeason(btn.dataset.season));
  });
}

function boot() {
  initSeasonToggle();
  initCat();
  initLantern();
  initHaiku();
  startLeafFall();
  applySeason(getSeason());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
