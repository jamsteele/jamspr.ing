// ============================================
// Autumn layer — season toggle + overlay critters.
// Flips the canvas game (garden.js) between seasons via
// window.__setGardenSeason, and wires the autumn-only SVG
// overlay in index.html: hidden cat, owl, jack-o-lantern,
// and the "whisper to the wind" haiku card.
// Gotcha: the hint text under the game is owned by
// garden.js updateUI(), not this file.
// ============================================

const SEASON_KEY = 'jamspring.season';
const LANTERN_KEY = 'jamspring.lanternLit';

// Vancouver-autumn haikus, roughly 5-7-5. Each tap shows a different one.
const HAIKUS = [
  "cold rain on the seawall\nmaples spill their copper coins\nthe mountains lean in",
  "lanterns in a row\nthe cat watches, unimpressed\nby our fear of ghosts",
  "wet leaves on the stairs\neach one a tiny red door\nnobody opens",
  "steam from the kettle\nlong grey light settles over\nenglish bay by four",
  "crows know every roof\nthey keep a map of the town\nfolded in their wings",
  "the owl says nothing\nabout what you did last week\nthe owl understands",
  "pumpkin on a step\nhollowed out and lit inside\nso are we, sometimes",
  "sweater weather starts\nthe mountains pull their coats on\nfirst dust of white snow",
  "dusk comes in early\neverything is pink and gold\nthen suddenly dark",
  "the trees know the trick\nlet go of what will not stay\nthe wind does the rest",
  "the seabus hums home\na gull rides along the rail\nlike it paid the fare",
  "rain on the skylight\na book, a blanket, a cat\nnowhere else to be",
  "one red maple leaf\nstuck to my running shoe\na souvenir, then",
  "fog on the inlet\nthe north shore disappears\nthen gives itself back",
  "the moon in a puddle\ni step around it gently\nit's had a long day",
  "chestnuts on the path\nthe squirrels are counting them\nand so, quietly, am i",
  "last ferry at nine\nthe city lights its candles\none window at a time",
  "i fall out of step\nwith summer and into soup\nno regrets at all",
];

function defaultSeason() {
  const month = new Date().getMonth(); // 0 = Jan
  // Autumn: September–November inclusive.
  return (month >= 8 && month <= 10) ? 'autumn' : 'spring';
}

// A visitor's toggle choice lasts for this visit only (sessionStorage), so every
// new visit opens in the real-world season. Also clears the old permanent
// choice that earlier builds saved in localStorage.
function getSeason() {
  try {
    localStorage.removeItem(SEASON_KEY);
    return sessionStorage.getItem(SEASON_KEY) || defaultSeason();
  } catch { return defaultSeason(); }
}

function setSeason(s) {
  try { sessionStorage.setItem(SEASON_KEY, s); } catch {}
  applySeason(s, false);
}

// immediate = true on page load (no regrow animation).
function applySeason(s, immediate) {
  document.documentElement.classList.toggle('season-autumn', s === 'autumn');
  document.body.classList.toggle('season-autumn', s === 'autumn');
  document.body.classList.toggle('season-spring', s === 'spring');
  document.querySelectorAll('.season-toggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.season === s);
    btn.setAttribute('aria-pressed', btn.dataset.season === s ? 'true' : 'false');
  });
  const label = document.querySelector('.game-label');
  if (label) label.textContent = s === 'autumn' ? 'turn the leaves' : 'bloom the branches';
  // Divider, footer and browser-tab icon: 🌸 in spring, 🍁 in autumn.
  const emoji = s === 'autumn' ? '🍁' : '🌸';
  document.querySelectorAll('.season-emoji').forEach(el => { el.textContent = emoji; });
  const favicon = document.getElementById('favicon');
  if (favicon) {
    favicon.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>" + emoji + "</text></svg>";
  }
  // Hint copy is owned by garden.js's updateUI() — don't overwrite it here or
  // we flash stale text before the canvas regenerates for the new season.
  // Hand the season down to the canvas game so it swaps mechanics.
  if (typeof window.__setGardenSeason === 'function') {
    window.__setGardenSeason(s, immediate);
  }
}

// ---- Hidden cat (eyes glow, tap → cat emerges, tap again → back to shadows) ----
function initCat() {
  const cat = document.getElementById('hiddenCat');
  if (!cat) return;
  cat.addEventListener('click', () => cat.classList.toggle('out'));
}

// ---- Owl (tap → hop + two wing flaps + a floating "hoo… hoo") ----
// Silent on purpose, matching the bird's floating music notes in garden.js.
function initOwl() {
  const owl = document.getElementById('owl');
  if (!owl) return;
  owl.addEventListener('click', () => {
    // Restart the CSS animations even on rapid repeat taps.
    owl.classList.remove('hooting');
    void owl.offsetWidth;
    owl.classList.add('hooting');
    ['hoo', 'hoo'].forEach((word, i) => {
      const hoot = document.createElement('span');
      hoot.className = 'hoot';
      hoot.textContent = word;
      hoot.style.left = i === 0 ? '-14px' : '26px';
      hoot.style.animationDelay = (i * 0.4) + 's';
      hoot.addEventListener('animationend', () => hoot.remove());
      owl.appendChild(hoot);
    });
  });
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

// ---- Haiku scroll (tap to unroll a new haiku, tap again to roll it up) ----
function initHaiku() {
  const scroll = document.getElementById('haikuScroll');
  const text = document.getElementById('haikuText');
  if (!scroll || !text) return;
  let lastIdx = -1;
  function toggle() {
    const opening = !scroll.classList.contains('open');
    if (opening) {
      let idx;
      do { idx = Math.floor(Math.random() * HAIKUS.length); } while (idx === lastIdx);
      lastIdx = idx;
      text.textContent = HAIKUS[idx];
    }
    scroll.classList.toggle('open', opening);
    scroll.setAttribute('aria-expanded', String(opening));
    scroll.setAttribute('aria-label', opening ? 'roll up the haiku' : 'unroll a haiku');
  }
  scroll.addEventListener('click', toggle);
  scroll.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
}

// ---- Share capture ----
// The overlay is DOM layered over the canvas, so a canvas recording alone would
// show the tree but no moon, owl or pumpkins. garden.js calls this before
// recording and paints the returned layers onto every frame. Each piece is
// cloned to a standalone SVG image; CSS-driven state (cat hidden, lantern
// unlit) is applied by removing those parts, since images ignore page CSS.
// Returns layers in canvas pixel coordinates, back to front.
window.__autumnShareLayers = async function (canvas) {
  const ns = 'http://www.w3.org/2000/svg';
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: (r.left - rect.left) * sx, y: (r.top - rect.top) * sy, w: r.width * sx, h: r.height * sy };
  };
  const sharedDefs = document.querySelector('.svg-defs defs');

  async function svgLayer(el, prepare) {
    const b = box(el);
    if (!b.w || !b.h) return null;
    const clone = el.cloneNode(true);
    clone.setAttribute('xmlns', ns);
    clone.setAttribute('width', String(Math.round(b.w)));
    clone.setAttribute('height', String(Math.round(b.h)));
    clone.removeAttribute('class');
    if (prepare) prepare(clone);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    await img.decode();
    return { img, ...b, flip: getComputedStyle(el).transform.startsWith('matrix(-1') };
  }
  // Pumpkins reference shared <symbol>s; inline them so the image stands alone.
  function inlinePumpkin(clone) {
    const use = clone.querySelector('use');
    const symbol = document.querySelector(use.getAttribute('href'));
    clone.appendChild(sharedDefs.cloneNode(true));
    symbol.childNodes.forEach((n) => clone.appendChild(n.cloneNode(true)));
    use.remove();
  }
  const cat = document.getElementById('hiddenCat');
  const lantern = document.getElementById('jackOLantern');

  const stars = [...document.querySelectorAll('.autumn-overlay .star')].map((el) => {
    const b = box(el);
    return { dot: true, x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.max(b.w, b.h) / 2 + 0.5, color: 'rgba(255, 248, 224, 0.9)' };
  });
  const pieces = await Promise.all([
    svgLayer(document.querySelector('.autumn-overlay .moon')),
    svgLayer(document.querySelector('#owl svg')),
    ...[...document.querySelectorAll('.ground-pumpkin')].map((el) => svgLayer(el, inlinePumpkin)),
    svgLayer(cat.querySelector('svg'), (c) => {
      if (!cat.classList.contains('out')) c.querySelector('.cat-body').remove();
    }),
    svgLayer(lantern.querySelector('svg'), (c) => {
      if (!lantern.classList.contains('lit')) c.querySelector('.lantern-glow').remove();
    }),
  ]);
  return [...stars, ...pieces.filter(Boolean)];
};

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
  initOwl();
  initHaiku();
}

// Apply the starting season right away (this script is deferred, so the DOM
// is parsed). garden.js isn't loaded yet; it reads __initialSeason when it
// builds the first tree, so the first frame is already the right season.
window.__initialSeason = getSeason();
applySeason(window.__initialSeason, true);
// DOMContentLoaded fires after every deferred script, including garden.js.
document.addEventListener('DOMContentLoaded', boot);
