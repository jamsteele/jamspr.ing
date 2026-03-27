// ============================================================
// Vancouver Bingo — Main App
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- State ----
let currentCard = null;
let isZoomed = false;

// cardStates: { [cardId]: { dealt: string[25], checked: Set<number> } }
// dealt[12] is always null (FREE square)
let cardStates = {};

// ---- Storage ----
// Uses key "vancouver_bingo_v2" to avoid collision with old format
const STORAGE_KEY = "vancouver_bingo_v2";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const [id, state] of Object.entries(data)) {
      cardStates[id] = {
        dealt: state.dealt || [],
        checked: new Set(state.checked || []),
        notes: state.notes || {},
      };
    }
  } catch {
    /* ignore corrupt data */
  }
}

function saveState() {
  const data = {};
  for (const [id, state] of Object.entries(cardStates)) {
    data[id] = {
      dealt: state.dealt,
      checked: [...state.checked],
      notes: state.notes || {},
    };
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---- Deal ----
function dealHand(card) {
  // Fisher-Yates shuffle of the full item pool
  const pool = [...card.itemPool];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Pick 24 items, insert null (FREE) at board position 12
  const hand = pool.slice(0, 24);
  hand.splice(12, 0, null);
  return hand; // length 25, hand[12] === null
}

function ensureDealt(card) {
  if (!cardStates[card.id]) {
    const hand = dealHand(card);
    cardStates[card.id] = {
      dealt: hand,
      checked: new Set([12]), // FREE is always pre-checked
      notes: {},
    };
    saveState();
  } else {
    // Ensure FREE is always checked (safety)
    cardStates[card.id].checked.add(12);
  }
}

// ---- Accessors ----
function getDealt() {
  return cardStates[currentCard.id].dealt;
}

function getCheckedSet() {
  return cardStates[currentCard.id]?.checked || new Set();
}

// ---- Witty toasts ----
const TOAST_MESSAGES = [
  "Look at you go!",
  "One step closer to local status",
  "Vancouver approves",
  "That's the spirit!",
  "You're basically a local now",
  "Check ✓",
  "Living your best Vancouver life",
  "The seagulls are proud",
  "Main character energy",
  "You did the thing!",
  "Achievement unlocked",
  "Tell everyone about it",
  "Instagram-worthy moment",
  "Your friends back home are jealous",
  "Peak Pacific Northwest",
];

const UNCHECK_MESSAGES = [
  "Changed your mind?",
  "We don't judge",
  "Plot twist",
  "Fair enough",
  "It happens",
];

const BINGO_MESSAGES = [
  "BINGO! You're on fire! 🔥",
  "BINGO! Vancouver salutes you!",
  "BINGO! A whole line — legend!",
  "BINGO! The mountains called, you answered!",
  "BINGO! You're unstoppable!",
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Toast ----
let toastTimeout;
function showToast(msg, duration = 2000) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), duration);
}

// ---- Confetti ----
function fireConfetti(intensity = 1) {
  const canvas = $("#confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = "block";

  const particles = [];
  const count = Math.floor(80 * intensity);
  const colors = ["#E85D75", "#FFD166", "#4ECDC4", "#1a1a1a", "#FF6B6B", "#95E1D3", "#F8B500"];

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * canvas.height * 0.3,
      w: 4 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    });
  }

  let frame;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.vy += 0.1;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.opacity -= 0.003;
      if (p.opacity <= 0 || p.y > canvas.height + 20) continue;
      alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive) {
      frame = requestAnimationFrame(animate);
    } else {
      canvas.style.display = "none";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  animate();
}

// ---- Bingo detection ----
function detectBingos() {
  const checked = getCheckedSet();
  const lines = [];

  // Rows
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) row.push(r * 5 + c);
    if (row.every((i) => checked.has(i))) lines.push(row);
  }
  // Columns
  for (let c = 0; c < 5; c++) {
    const col = [];
    for (let r = 0; r < 5; r++) col.push(r * 5 + c);
    if (col.every((i) => checked.has(i))) lines.push(col);
  }
  // Diagonals
  const d1 = [0, 6, 12, 18, 24];
  const d2 = [4, 8, 12, 16, 20];
  if (d1.every((i) => checked.has(i))) lines.push(d1);
  if (d2.every((i) => checked.has(i))) lines.push(d2);

  return lines;
}

// ---- Tier ----
function getCurrentTier() {
  const count = getCheckedSet().size;
  let tier = currentCard.tiers[0];
  for (const t of currentCard.tiers) {
    if (count >= t.min) tier = t;
  }
  return tier;
}

// ---- Render: Home ----
function renderHome() {
  const grid = $("#card-grid");
  grid.innerHTML = "";
  for (const card of BINGO_CARDS) {
    const state = cardStates[card.id];
    const checkedCount = state ? state.checked.size : 0;
    const pct = Math.round((checkedCount / 25) * 100);
    const el = document.createElement("button");
    el.className = "card-preview";
    el.style.setProperty("--card-color", card.color);
    el.style.setProperty("--card-accent", card.accent);
    el.innerHTML = `
      <span class="card-icon">${card.icon}</span>
      <h3 class="card-name">${card.title}</h3>
      <p class="card-desc">${card.description}</p>
      ${card.blurb ? `<p class="card-blurb">${card.blurb}</p>` : ""}
      <div class="card-progress-wrap">
        <div class="card-progress" style="width: ${pct}%"></div>
      </div>
      <span class="card-pct">${checkedCount}/25</span>
    `;
    el.addEventListener("click", () => openBoard(card));
    grid.appendChild(el);
  }
}

// ---- Fit board grid to actual viewport ----
function fitGridToScreen() {
  const board = $("#bingo-board");
  const container = $("#board-scroll-container");
  if (!board || !container || isZoomed) return;

  // Reset any previous scaling
  board.style.transform = "";
  board.style.transformOrigin = "";
  board.style.width = "";
  container.style.height = "";

  // Force scroll to left edge
  window.scrollTo(0, window.scrollY || 0);
  document.body.scrollLeft = 0;
  document.documentElement.scrollLeft = 0;

  // Double-rAF: first frame commits layout, second measures post-layout
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const vw = Math.min(
        window.visualViewport ? window.visualViewport.width : Infinity,
        document.documentElement.clientWidth,
        window.innerWidth
      );

      const boardRect = board.getBoundingClientRect();
      const overflow = boardRect.right - vw;

      if (overflow > 1) {
        const targetWidth = boardRect.width - overflow - 4;
        const scale = targetWidth / boardRect.width;
        board.style.transformOrigin = "top left";
        board.style.transform = `scale(${scale})`;
        container.style.height = Math.ceil(boardRect.height * scale) + "px";
      }
    });
  });
}

// ---- Render: Board ----
function openBoard(card) {
  currentCard = card;
  document.body.style.setProperty("--card-color", card.color);
  document.body.style.setProperty("--card-accent", card.accent);

  ensureDealt(card);

  $("#board-title").textContent = card.title;
  $("#board-subtitle").textContent = card.subtitle;

  setCardParam(card.id);
  renderBoard();
  updateProgress();
  switchScreen("board-screen");
  fitGridToScreen();
}

function renderBoard() {
  const board = $("#bingo-board");
  board.innerHTML = "";
  const dealt = getDealt();
  const checked = getCheckedSet();

  const notes = (cardStates[currentCard.id] && cardStates[currentCard.id].notes) || {};

  dealt.forEach((item, i) => {
    const cell = document.createElement("button");
    const isFree = i === 12; // dealt[12] is null
    if (isFree) {
      cell.className = "bingo-cell free checked";
      cell.innerHTML = `<span class="cell-text">FREE</span>`;
    } else {
      cell.className = "bingo-cell" + (checked.has(i) ? " checked" : "");
      const noteDot = notes[i] ? `<span class="cell-note-dot"></span>` : "";
      cell.innerHTML = `<span class="cell-text">${item}</span>${noteDot}`;
      cell.addEventListener("click", () => {
        if (isZoomed) {
          toggleCell(i, cell);
        } else {
          showCellPopup(i, item, cell);
        }
      });
    }
    board.appendChild(cell);
  });
}

// ---- Cell Detail Popup ----
let popupCellIndex = null;
let popupCellEl = null;

function showCellPopup(index, text, cellEl) {
  popupCellIndex = index;
  popupCellEl = cellEl;
  const checked = getCheckedSet();
  const isChecked = checked.has(index);

  $("#cell-popup-text").textContent = text;

  const actionBtn = $("#cell-popup-action");
  const swapBtn = $("#cell-popup-swap");

  if (isChecked) {
    actionBtn.textContent = "Uncheck";
    actionBtn.classList.add("uncheck");
    swapBtn.style.display = "none";
  } else {
    actionBtn.textContent = "Mark Complete";
    actionBtn.classList.remove("uncheck");
    swapBtn.style.display = "";
  }

  // Populate note field
  const noteInput = $("#cell-popup-note");
  const notes = cardStates[currentCard.id].notes || {};
  noteInput.value = notes[index] || "";
  noteInput.placeholder = currentCard.id === "very-vancouver" ? "Who is this?" : "Add a note...";

  $("#cell-popup-overlay").classList.add("visible");
}

function swapCell(index) {
  const state = cardStates[currentCard.id];
  const onBoard = new Set(state.dealt.filter((item) => item !== null));
  const available = currentCard.itemPool.filter((item) => !onBoard.has(item));

  if (available.length === 0) {
    showToast("No more squares to swap in!");
    closeCellPopup();
    return;
  }

  const newItem = available[Math.floor(Math.random() * available.length)];
  state.dealt[index] = newItem;
  saveState();
  renderBoard();
  closeCellPopup();
  fitGridToScreen();
  showToast("↻ New square!");
}

function closeCellPopup() {
  // Save note before closing
  if (popupCellIndex !== null && currentCard) {
    const noteInput = $("#cell-popup-note");
    const state = cardStates[currentCard.id];
    if (!state.notes) state.notes = {};
    const val = noteInput.value.trim();
    if (val) {
      state.notes[popupCellIndex] = val;
    } else {
      delete state.notes[popupCellIndex];
    }
    saveState();
    renderBoard();
  }
  $("#cell-popup-overlay").classList.remove("visible");
  popupCellIndex = null;
  popupCellEl = null;
}

// ---- Zoom Toggle ----
function toggleZoom() {
  isZoomed = !isZoomed;
  const board = $("#bingo-board");
  const container = $("#board-scroll-container");
  const zoomInIcon = $("#zoom-icon-in");
  const zoomOutIcon = $("#zoom-icon-out");
  const zoomLabel = $("#zoom-label");

  if (isZoomed) {
    board.style.transform = "";
    board.style.transformOrigin = "";
    board.style.width = "";
    container.style.height = "";
    board.classList.add("zoomed");
    container.classList.add("zoomed");
    zoomInIcon.style.display = "none";
    zoomOutIcon.style.display = "block";
    zoomLabel.textContent = "Zoom Out";
  } else {
    board.classList.remove("zoomed");
    container.classList.remove("zoomed");
    zoomInIcon.style.display = "block";
    zoomOutIcon.style.display = "none";
    zoomLabel.textContent = "Zoom In";
    fitGridToScreen();
  }
}

let previousBingoCount = 0;

function toggleCell(index, cell) {
  const state = cardStates[currentCard.id];
  const checked = state.checked;
  const wasChecked = checked.has(index);

  if (wasChecked) {
    checked.delete(index);
    cell.classList.remove("checked");
    showToast(randomFrom(UNCHECK_MESSAGES));
  } else {
    checked.add(index);
    cell.classList.add("checked");
    cell.classList.add("pop");
    setTimeout(() => cell.classList.remove("pop"), 400);

    const bingos = detectBingos();
    if (bingos.length > previousBingoCount) {
      showToast(randomFrom(BINGO_MESSAGES), 3000);
      fireConfetti(2);
      showBingoNudge();
    } else if (checked.size === 25) {
      showToast(currentCard.id === "very-vancouver" ? "🎉 FULL CARD! You know everyone. Somehow." : `🎉 FULL CARD! You are a ${currentCard.title} local!`, 4000);
      fireConfetti(3);
      showBingoNudge();
    } else {
      showToast(randomFrom(TOAST_MESSAGES));
      if (checked.size % 5 === 0) fireConfetti(0.5);
    }
    previousBingoCount = bingos.length;
  }

  saveState();
  updateProgress();
  updateBingoLines();
}

function updateProgress() {
  const checked = getCheckedSet();
  const count = checked.size;
  const pct = (count / 25) * 100;
  const tier = getCurrentTier();

  $("#progress-bar").style.width = pct + "%";
  $("#progress-text").textContent = `${count} / 25`;
  $("#progress-title").textContent = tier.label;

  updateBingoLines();
}

function updateBingoLines() {
  const bingos = detectBingos();
  const el = $("#bingo-lines");
  if (bingos.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<span>${bingos.length} BINGO${bingos.length > 1 ? "S" : ""}!</span>`;
}

// ---- New Card ----
function promptNewCard() {
  $("#confirm-overlay").classList.add("visible");
}

function closeConfirm() {
  $("#confirm-overlay").classList.remove("visible");
}

function executeNewCard() {
  closeConfirm();
  // Reset zoom first
  if (isZoomed) toggleZoom();
  // Deal a fresh hand and clear progress
  const hand = dealHand(currentCard);
  cardStates[currentCard.id] = {
    dealt: hand,
    checked: new Set([12]),
  };
  previousBingoCount = 0;
  saveState();
  renderBoard();
  updateProgress();
  fitGridToScreen();
  showToast("New card dealt! Good luck 🎲", 2500);
}

// ---- Screen switching ----
function switchScreen(id) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $(`#${id}`).classList.add("active");
}

// ---- Share image ----
let shareMode = "progress";

function generateShareImage() {
  const canvas = $("#share-canvas");
  const ctx = canvas.getContext("2d");
  const w = 1080;
  const h = 1350;
  canvas.width = w;
  canvas.height = h;

  const isClean = shareMode === "clean";
  const dealt = getDealt();
  const checked = isClean ? new Set([12]) : getCheckedSet();
  const tier = isClean ? currentCard.tiers[0] : getCurrentTier();
  const bingos = isClean ? [] : detectBingos();
  const color = currentCard.color;

  const displayFont = "'Space Grotesk', sans-serif";
  const cleanFont = "'DM Sans', sans-serif";
  const bg = "#FAF8F5";

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Header — bold color band
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, 160);

  ctx.fillStyle = "#fff";
  ctx.font = `700 56px ${displayFont}`;
  ctx.textAlign = "center";
  ctx.letterSpacing = "-1px";
  ctx.fillText(currentCard.title.toUpperCase(), w / 2, 72);

  ctx.font = `700 36px ${displayFont}`;
  ctx.fillText("BINGO", w / 2, 120);

  // Subheader
  if (isClean) {
    ctx.fillStyle = "#777";
    ctx.font = `400 26px ${cleanFont}`;
    ctx.fillText(currentCard.description, w / 2, 200);
  } else {
    ctx.fillStyle = "#777";
    ctx.font = `500 26px ${cleanFont}`;
    ctx.fillText(`${tier.label} — ${checked.size}/25`, w / 2, 200);

    if (bingos.length > 0) {
      ctx.fillStyle = color;
      ctx.font = `700 26px ${displayFont}`;
      ctx.fillText(`${bingos.length} BINGO${bingos.length > 1 ? "S" : ""}!`, w / 2, 235);
    }
  }

  // Grid
  const gridX = 40;
  const hasExtra = !isClean && bingos.length > 0;
  const gridY = hasExtra ? 260 : 230;
  const gridW = w - 80;
  const gridH = h - (hasExtra ? 400 : 370);
  const cellW = gridW / 5;
  const cellH = gridH / 5;

  // Grid outer border
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 4;
  roundRect(ctx, gridX, gridY, gridW, gridH, 6);
  ctx.stroke();

  dealt.forEach((item, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = gridX + col * cellW;
    const y = gridY + row * cellH;
    const isFree = i === 12;
    const isChecked = checked.has(i);

    if (isFree) {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(x, y, cellW, cellH);
      ctx.fillStyle = "#fff";
      ctx.font = `700 34px ${displayFont}`;
      ctx.textAlign = "center";
      ctx.fillText("FREE", x + cellW / 2, y + cellH / 2 + 12);
    } else if (isChecked) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellW, cellH);

      ctx.beginPath();
      ctx.arc(x + cellW / 2, y + cellH / 2, Math.min(cellW, cellH) * 0.36, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = `500 24px ${cleanFont}`;
      ctx.textAlign = "center";
      wrapText(ctx, item, x + cellW / 2, y + cellH / 2 + 6, cellW - 20, 28);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, cellW, cellH);

      ctx.fillStyle = "#1a1a1a";
      ctx.font = `500 24px ${cleanFont}`;
      ctx.textAlign = "center";
      wrapText(ctx, item, x + cellW / 2, y + cellH / 2 + 6, cellW - 20, 28);
    }

    // Cell borders
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cellW, cellH);
  });

  // Footer
  ctx.fillStyle = "#777";
  ctx.font = `500 26px ${cleanFont}`;
  ctx.textAlign = "center";
  ctx.fillText("jamspr.ing/vancouverbingo", w / 2, h - 35);

  $("#share-overlay").classList.add("visible");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line = test;
    }
  }
  lines.push(line.trim());

  const startY = y - ((lines.length - 1) * lineH) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, startY + i * lineH);
  }
}

// ---- Bingo share nudge ----
let nudgeTimer = null;
function showBingoNudge() {
  const nudge = $("#bingo-nudge");
  clearTimeout(nudgeTimer);
  setTimeout(() => {
    nudge.classList.add("visible");
    nudgeTimer = setTimeout(() => nudge.classList.remove("visible"), 6000);
  }, 3000);
}

// ---- Event listeners ----
$("#back-btn").addEventListener("click", () => {
  if (isZoomed) toggleZoom();
  setCardParam(null);
  renderHome();
  switchScreen("home-screen");
});

$("#share-btn").addEventListener("click", () => {
  shareMode = "progress";
  updateShareTabs();
  generateShareImage();
});

$("#bingo-nudge-share").addEventListener("click", () => {
  $("#bingo-nudge").classList.remove("visible");
  shareMode = "progress";
  updateShareTabs();
  generateShareImage();
});

$("#bingo-nudge-dismiss").addEventListener("click", () => {
  $("#bingo-nudge").classList.remove("visible");
});

$("#share-close").addEventListener("click", () => {
  $("#share-overlay").classList.remove("visible");
});

$$(".share-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    shareMode = tab.dataset.mode;
    updateShareTabs();
    generateShareImage();
  });
});

function updateShareTabs() {
  $$(".share-tab").forEach((t) => t.classList.remove("active"));
  $(`.share-tab[data-mode="${shareMode}"]`).classList.add("active");
}

$("#share-download").addEventListener("click", async () => {
  const canvas = $("#share-canvas");
  const suffix = shareMode === "clean" ? "clean" : "progress";
  const filename = `vancouver-bingo-${currentCard.id}-${suffix}.png`;

  // Convert canvas to blob
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], filename, { type: "image/png" });

  // Use native share sheet on mobile (iOS/Android) — includes Save Image + app sharing
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${currentCard.title} Bingo`,
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        // Share failed — fall back to download
        downloadFile(canvas, filename);
      }
      // AbortError = user tapped cancel, do nothing
    }
  } else {
    // Desktop fallback: direct download
    downloadFile(canvas, filename);
  }
});

function downloadFile(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ---- Zoom button ----
$("#zoom-btn").addEventListener("click", toggleZoom);

// ---- Cell popup events ----
$("#cell-popup-close").addEventListener("click", closeCellPopup);
$("#cell-popup-overlay").addEventListener("click", (e) => {
  if (e.target === $("#cell-popup-overlay")) closeCellPopup();
});
$("#cell-popup-action").addEventListener("click", () => {
  if (popupCellIndex !== null && popupCellEl) {
    toggleCell(popupCellIndex, popupCellEl);
    closeCellPopup();
  }
});

$("#cell-popup-swap").addEventListener("click", () => {
  if (popupCellIndex !== null) {
    swapCell(popupCellIndex);
  }
});

// ---- New Card button ----
$("#new-card-btn").addEventListener("click", promptNewCard);
$("#confirm-cancel").addEventListener("click", closeConfirm);
$("#confirm-ok").addEventListener("click", executeNewCard);
$("#confirm-overlay").addEventListener("click", (e) => {
  if (e.target === $("#confirm-overlay")) closeConfirm();
});

// ---- Pinch-to-zoom on board ----
let pinchStartDist = 0;
let pinchEndDist = 0;

function getPinchDist(touches) {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );
}

const boardContainer = $("#board-scroll-container");

boardContainer.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    pinchStartDist = getPinchDist(e.touches);
    pinchEndDist = pinchStartDist;
  }
}, { passive: true });

boardContainer.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    pinchEndDist = getPinchDist(e.touches);
  }
}, { passive: true });

boardContainer.addEventListener("touchend", () => {
  if (pinchStartDist > 0) {
    const ratio = pinchEndDist / pinchStartDist;
    if (ratio > 1.2 && !isZoomed) {
      toggleZoom(); // pinch out → zoom in
    } else if (ratio < 0.8 && isZoomed) {
      toggleZoom(); // pinch in → zoom out
    }
    pinchStartDist = 0;
    pinchEndDist = 0;
  }
}, { passive: true });

// ---- Resize handlers ----
// Skip fitGridToScreen when user has pinched to zoom (scale > 1) —
// we don't want to fight native pinch-to-zoom
function userHasZoomed() {
  return window.visualViewport && window.visualViewport.scale > 1;
}

window.addEventListener("resize", () => {
  if (currentCard && !isZoomed && !userHasZoomed()) fitGridToScreen();
});
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    if (currentCard && !isZoomed && !userHasZoomed()) fitGridToScreen();
  });
}

// ---- URL deep-linking ----
function getCardParam() {
  return new URLSearchParams(window.location.search).get("card");
}

function setCardParam(cardId) {
  const url = new URL(window.location);
  if (cardId) {
    url.searchParams.set("card", cardId);
  } else {
    url.searchParams.delete("card");
  }
  history.replaceState(null, "", url);
}

// ---- Init ----
loadState();
renderHome();

// Auto-open board from ?card= param
const startCard = getCardParam();
if (startCard) {
  const match = BINGO_CARDS.find((c) => c.id === startCard);
  if (match) openBoard(match);
}
