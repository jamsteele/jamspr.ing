// ============================================
// A tiny tarot — tap the card on the link page to draw a gentle fortune.
// Markup lives in index.html (#tarotDraw); styles in index.html's <style>,
// autumn colour tweaks in autumn.css. Never draws the same card twice in a row.
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

(() => {
  const card = document.getElementById('tarotDraw');
  if (!card) return;
  let last = -1;
  card.addEventListener('click', () => {
    let next = Math.floor(Math.random() * FORTUNES.length);
    if (next === last) next = (next + 1) % FORTUNES.length;
    last = next;
    const f = FORTUNES[next];
    document.getElementById('tarotSymbol').textContent = f.symbol;
    document.getElementById('tarotTitle').textContent = f.title;
    document.getElementById('tarotMessage').textContent = f.message;
    card.querySelector('.tarot-cta').textContent = 'draw another';
  });
})();
