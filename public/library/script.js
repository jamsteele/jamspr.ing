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
    renderHotspots(data.stories || []);
    setupModalControls();
  } catch (err) {
    console.error('Failed to load story index:', err);
    showRoomError('Could not load the story index. See console for details.');
  }
}

/* Render a hotspot for each story.
   - If a story has explicit `position` coords, use them (for the real room layout).
   - Otherwise, lay them out in an auto-grid for placeholder mode. */
function renderHotspots(stories) {
  const useGrid = stories.every((s) => !s.position);

  stories.forEach((story, idx) => {
    const btn = document.createElement('button');
    btn.className = 'hotspot';
    btn.dataset.storyId = story.id;
    btn.dataset.label = `${story.trinket || story.title} — ${story.title}`;
    btn.setAttribute('aria-label', `Open “${story.title}” by ${story.author}`);
    btn.textContent = story.trinketEmoji || '📖';

    if (story.position) {
      Object.assign(btn.style, {
        top: story.position.top,
        left: story.position.left,
        width: story.position.width || '60px',
        height: story.position.height || '60px',
      });
    } else {
      // Auto-grid: 5 columns, rows as needed
      const COLS = 5;
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      Object.assign(btn.style, {
        top: `${22 + row * 18}%`,
        left: `${10 + col * 18}%`,
        width: '64px',
        height: '64px',
      });
    }

    btn.addEventListener('click', () => openStory(story));
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
