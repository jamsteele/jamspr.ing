// ============================================
// A tiny tarot — a 5-card spread on the link page. Tap one of the face-down
// cards and it flips to show a fortune underneath. "Draw again" or a sideways
// swipe across the cards shuffles and starts over.
//
// Markup lives in index.html (#tarotSpread, #tarotReading, #tarotReset);
// styles in index.html's <style>, autumn colour tweaks in autumn.css.
// Each hand of five is a fresh random pick — no repeats within the hand.
// Edit FORTUNES freely: short, warm, a little wry. No doom, only vibes.
// ============================================

const FORTUNES = [
  { symbol: '☀️', title: 'The Sun', message: 'Choose the bright, uncomplicated option today.' },
  { symbol: '🌙', title: 'The Moon', message: 'Not everything needs solving tonight. Let one mystery stay mysterious.' },
  { symbol: '🌿', title: 'The Empress', message: 'Make something cosy on purpose.' },
  { symbol: '🎡', title: 'Wheel of Fortune', message: 'A change in route is not a change in destination.' },
  { symbol: '🍂', title: 'Death', message: 'Not an ending, just a season change. Let the leaves go.' },
  { symbol: '🎒', title: 'The Fool', message: 'Say yes to the slightly-too-ambitious plan. Bring snacks.' },
  { symbol: '🕯️', title: 'The Hermit', message: 'Cancel one thing and stay in. It counts.' },
  { symbol: '💌', title: 'The Lovers', message: "Text the friend you've been meaning to text." },
  { symbol: '🚲', title: 'The Chariot', message: 'Momentum beats perfect. Keep pedalling.' },
  { symbol: '☕', title: 'Temperance', message: 'Half plan, half wander. Both count.' },
  { symbol: '🔮', title: 'The High Priestess', message: 'Trust the hunch you keep talking yourself out of.' },
  { symbol: '⚡', title: 'The Tower', message: "Something's about to get rearranged. Probably just your bookshelf." },
  { symbol: '🌍', title: 'The World', message: 'Book the trip. Or at least look at flights.' },
  { symbol: '🦁', title: 'Strength', message: 'You are tougher than the hill. Probably.' },
  { symbol: '📯', title: 'Judgement', message: 'Reply to the email. You know the one.' },
  { symbol: '⭐', title: 'The Star', message: 'Small hopes count. Give one a next step.' },
  { symbol: '🪄', title: 'The Magician', message: "You already have what you need. Start with what's in your hand." },
  { symbol: '👑', title: 'The Emperor', message: 'Make the plan. Then make it a calendar invite.' },
  { symbol: '📜', title: 'The Hierophant', message: "Ask someone who's done it before. Then buy them a coffee." },
  { symbol: '🙃', title: 'The Hanged Man', message: 'Stuck? Try looking at it upside down.' },
  { symbol: '⚖️', title: 'Justice', message: 'Be fair to yourself too. Especially before coffee.' },
  { symbol: '😈', title: 'The Devil', message: 'One more episode is fine. Three is a choice.' },
];

const SPREAD_SIZE = 5;
// Fan geometry: the i-th card gets angle FAN_ANGLES[i], lift FAN_LIFTS[i], and
// slides toward the centre when picked (translateX by -centreOffsetFromCard).
const FAN_ANGLES = [-14, -7, 0, 7, 14];
const FAN_LIFTS = [10, 2, 0, 2, 10]; // px
const SWIPE_THRESHOLD = 50; // px of sideways travel inside the spread → reset

(() => {
  const spread = document.getElementById('tarotSpread');
  const reading = document.getElementById('tarotReading');
  const resetWrap = document.getElementById('tarotResetWrap');
  const reset = document.getElementById('tarotReset');
  const prompt = document.getElementById('tarotPrompt');
  const symbol = document.getElementById('tarotSymbol');
  const title = document.getElementById('tarotTitle');
  const message = document.getElementById('tarotMessage');
  if (!spread || !reading || !reset) return;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function dealHand() {
    // 5 distinct fortunes, in random order.
    const pool = FORTUNES.slice();
    const hand = [];
    for (let i = 0; i < SPREAD_SIZE && pool.length; i++) {
      hand.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return hand;
  }

  function build() {
    spread.classList.remove('is-picked');
    reading.classList.remove('is-visible');
    resetWrap.classList.remove('is-visible');
    prompt.classList.remove('hidden');
    spread.replaceChildren();
    const hand = dealHand();
    hand.forEach((fortune, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tarot-fan';
      btn.style.setProperty('--fan-angle', `${FAN_ANGLES[i]}deg`);
      btn.style.setProperty('--fan-lift', `${-FAN_LIFTS[i]}px`);
      btn.setAttribute('aria-label', `Face-down tarot card ${i + 1} of ${SPREAD_SIZE}`);
      btn.innerHTML = `
        <span class="tarot-flip">
          <span class="tarot-side tarot-back"><span class="tarot-back-art">✦</span></span>
          <span class="tarot-side tarot-front">
            <span class="tarot-face-art">${fortune.symbol}</span>
            <span class="tarot-face-name">${fortune.title}</span>
          </span>
        </span>`;
      btn.addEventListener('click', () => pick(btn, fortune));
      spread.appendChild(btn);
    });
  }

  function sparkleBurst(btn) {
    if (calm) return;
    const burst = document.createElement('span');
    burst.className = 'tarot-sparkles';
    burst.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.className = 'sparkle';
      s.textContent = '✦';
      s.style.setProperty('--angle', `${Math.random() * 360}deg`);
      s.style.setProperty('--dist', `${40 + Math.random() * 40}px`);
      s.style.setProperty('--delay', `${Math.random() * 180}ms`);
      s.addEventListener('animationend', () => s.remove());
      burst.appendChild(s);
    }
    btn.appendChild(burst);
    setTimeout(() => burst.remove(), 1600);
  }

  function pick(btn, fortune) {
    if (spread.classList.contains('is-picked')) return;
    // Slide the picked card to the centre of the spread.
    const spreadRect = spread.getBoundingClientRect();
    const cardRect = btn.getBoundingClientRect();
    const centreX = spreadRect.left + spreadRect.width / 2;
    const cardCentreX = cardRect.left + cardRect.width / 2;
    btn.style.setProperty('--pick-dx', `${(centreX - cardCentreX).toFixed(1)}px`);
    btn.classList.add('is-picked');
    btn.setAttribute('aria-label', `${fortune.title}. ${fortune.message}`);
    spread.classList.add('is-picked');
    prompt.classList.add('hidden');
    sparkleBurst(btn);
    // Reveal the reading halfway through the flip, so the text appears when
    // the card is already face up (or straight away if reduced motion is on).
    const delay = calm ? 0 : 400;
    // Set the text up front so max-height can transition from the real height.
    symbol.textContent = fortune.symbol;
    title.textContent = fortune.title;
    message.textContent = fortune.message;
    setTimeout(() => {
      reading.classList.add('is-visible');
      resetWrap.classList.add('is-visible');
    }, delay);
  }

  // Reset: fade the chosen card and reading out, then deal a fresh hand that
  // fades in. (Transitions are set on .tarot-spread, .tarot-reading and
  // .tarot-reset-wrap in index.html.)
  function reshuffle() {
    const fading = calm ? 0 : 350; // matches the .is-fading transition
    spread.classList.add('is-fading');
    reading.classList.remove('is-visible');
    resetWrap.classList.remove('is-visible');
    setTimeout(() => {
      build();                   // deal fresh, prompt back on
      spread.classList.add('is-fading'); // keep hidden through the swap
      requestAnimationFrame(() => requestAnimationFrame(() => spread.classList.remove('is-fading')));
    }, fading);
  }
  reset.addEventListener('click', reshuffle);

  // Sideways swipe across the spread also resets (only after a card is picked,
  // so the pick tap itself doesn't trigger it).
  let touchStartX = null, touchStartY = null, swiped = false;
  spread.addEventListener('pointerdown', (e) => {
    if (!spread.classList.contains('is-picked')) return;
    touchStartX = e.clientX; touchStartY = e.clientY; swiped = false;
  });
  spread.addEventListener('pointermove', (e) => {
    if (touchStartX === null || swiped) return;
    const dx = e.clientX - touchStartX, dy = e.clientY - touchStartY;
    // Mostly sideways travel past the threshold.
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      reshuffle();
    }
  });
  const endSwipe = () => { touchStartX = null; touchStartY = null; };
  spread.addEventListener('pointerup', endSwipe);
  spread.addEventListener('pointercancel', endSwipe);
  spread.addEventListener('pointerleave', endSwipe);

  build();
})();
