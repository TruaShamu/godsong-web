// ============================================================================
// Psalmody UI — hymn browser, search, detail view, playback
// ============================================================================

let selectedHymnId = null;
let selectedHymn = null;
let hymnPlayTimeout = null;

// ============================================================================
// Hymn List
// ============================================================================

function renderHymnList(filter) {
  const list = getHymnList();
  const container = document.getElementById('hymnList');
  container.innerHTML = '';

  const query = (filter || '').toLowerCase();
  const filtered = query
    ? list.filter(h => h.name.toLowerCase().includes(query))
    : list;

  filtered.forEach(h => {
    const item = document.createElement('div');
    item.className = 'hymn-item' + (h.id === selectedHymnId ? ' selected' : '');
    item.dataset.id = h.id;

    // Icons: ♫ for harmony, ¶ for lyrics
    const icons = [];
    if (h.hasHarmony) icons.push('♫');
    if (h.hasLyrics) icons.push('¶');
    const iconStr = icons.length ? ` <span class="hymn-icons">${icons.join('')}</span>` : '';

    item.innerHTML = h.name + iconStr;

    item.addEventListener('click', () => selectHymn(h.id));
    container.appendChild(item);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color:#444;padding:8px;text-align:center;">No hymns found</div>';
  }
}

// ============================================================================
// Hymn Detail
// ============================================================================

function selectHymn(id) {
  selectedHymnId = id;
  selectedHymn = getHymn(id);
  if (!selectedHymn) return;

  // Update list selection
  document.querySelectorAll('.hymn-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === id);
  });

  renderHymnDetail();
}

function renderHymnDetail() {
  const panel = document.getElementById('hymnDetail');
  const h = selectedHymn;
  if (!h) {
    panel.innerHTML = '<div class="hymn-detail-empty">Select a hymn from the list</div>';
    return;
  }

  // Collect all lyrics
  const allLyrics = h.sections
    .filter(s => s.lyrics)
    .map(s => s.lyrics)
    .join('\n');

  let html = '';
  html += `<div class="hymn-name">✝ ${h.name}</div>`;
  html += '<div class="hymn-meta">';
  html += `<span>♩ ${h.bpm} BPM</span>`;
  html += `<span>§ ${h.sections.length} section${h.sections.length > 1 ? 's' : ''}</span>`;
  if (h.hasHarmony) html += '<span>♫ harmony</span>';
  html += '</div>';

  // Controls
  html += '<div class="hymn-controls">';
  html += '<button id="btnHymnPlay">▶ Play</button>';
  html += '<button id="btnHymnStop" style="display:none;">■ Stop</button>';
  html += '</div>';

  // Section buttons
  if (h.sections.length > 1) {
    html += '<div class="hymn-sections">';
    h.sections.forEach((s, i) => {
      html += `<button class="section-btn" data-section="${i}">${i + 1}</button>`;
    });
    html += '</div>';
  }

  // Lyrics
  if (allLyrics) {
    html += `<div class="hymn-lyrics">${escapeHtml(allLyrics)}</div>`;
  }

  // Notation (collapsed)
  const notation = h.sections.map(s => s.melody).join(' | ');
  html += `<div class="hymn-notation">${escapeHtml(notation)}</div>`;

  panel.innerHTML = html;

  // Wire up play/stop
  document.getElementById('btnHymnPlay').addEventListener('click', () => playCurrentHymn());
  document.getElementById('btnHymnStop').addEventListener('click', () => stopCurrentHymn());

  // Render staff notation
  renderStaffForHymn(h);

  // Update tempo slider to match hymn BPM
  if (typeof TempoCtrl !== 'undefined') TempoCtrl.setBPM(h.bpm);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderStaffForHymn(hymn) {
  const container = document.getElementById('hymnStaffContainer');
  if (!container) return;

  // Parse all melody sections into note events
  const allEvents = [];
  const allLyrics = [];

  hymn.sections.forEach(section => {
    const events = parseSong(section.melody, hymn.bpm);
    const noteEvents = events.filter(e => e.type === 'note');
    allEvents.push(...noteEvents);

    // Split lyrics into words and map to notes
    if (section.lyrics) {
      const words = section.lyrics.split(/\s+/).filter(w => w);
      words.forEach((w, i) => allLyrics.push(w));
      // Pad if fewer words than notes
      while (allLyrics.length < allEvents.length) allLyrics.push('');
    }
  });

  if (allEvents.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  Staff.init('staffCanvas');
  Staff.render(allEvents, allLyrics.length > 0 ? allLyrics : null);
}

// ============================================================================
// Hymn Playback
// ============================================================================

function playCurrentHymn() {
  if (!selectedHymn) return;

  const { events, totalDuration, sectionOffsets } = parseHymn(selectedHymn);
  const dur = playSong(events);

  // Update buttons
  const btnPlay = document.getElementById('btnHymnPlay');
  const btnStop = document.getElementById('btnHymnStop');
  if (btnPlay) btnPlay.style.display = 'none';
  if (btnStop) btnStop.style.display = '';

  // Start visualizer and note highlight
  startVisualization(dur);
  highlightHymnSection(sectionOffsets);

  // Auto-stop
  if (hymnPlayTimeout) clearTimeout(hymnPlayTimeout);
  hymnPlayTimeout = setTimeout(() => {
    if (isPlaying) stopCurrentHymn();
  }, (dur + 0.5) * 1000);
}

function stopCurrentHymn() {
  stopSong();
  if (hymnPlayTimeout) clearTimeout(hymnPlayTimeout);

  const btnPlay = document.getElementById('btnHymnPlay');
  const btnStop = document.getElementById('btnHymnStop');
  if (btnPlay) btnPlay.style.display = '';
  if (btnStop) btnStop.style.display = 'none';

  // Clear section highlights
  document.querySelectorAll('.section-btn').forEach(b => b.classList.remove('playing'));
  document.getElementById('statusLeft').textContent = 'Ready';
}

function highlightHymnSection(sectionOffsets) {
  if (!isPlaying || !audioCtx) return;

  const elapsed = audioCtx.currentTime - playStartTime;

  // Find current section
  let currentSection = 0;
  for (let i = sectionOffsets.length - 1; i >= 0; i--) {
    if (elapsed >= sectionOffsets[i]) { currentSection = i; break; }
  }

  // Highlight section button
  document.querySelectorAll('.section-btn').forEach((btn, i) => {
    btn.classList.toggle('playing', i === currentSection);
  });

  // Show current note in status
  const active = currentEvents.find(e =>
    e.type === 'note' && e.voice !== 'harmony' &&
    elapsed >= e.time && elapsed < e.time + e.fullDuration
  );
  if (active) {
    const statusLeft = document.getElementById('statusLeft');
    statusLeft.textContent = `♪ ${active.name}${active.accidental||''}${active.octave} — ${Math.round(active.freq)}Hz [§${currentSection + 1}]`;
    statusLeft.className = 'active';
  }

  if (isPlaying) requestAnimationFrame(() => highlightHymnSection(sectionOffsets));
}

// ============================================================================
// Tab System
// ============================================================================

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      // Update tab buttons
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update tab content
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById('tab-' + target).classList.add('active');

      // Stop any playback when switching tabs
      if (isPlaying) {
        stopSong();
        // Reset both tab's play buttons
        const genPlay = document.getElementById('btnPlay');
        const genStop = document.getElementById('btnStop');
        if (genPlay) genPlay.style.display = '';
        if (genStop) genStop.style.display = 'none';
        stopCurrentHymn();
      }

      // Activate/deactivate organ
      if (typeof Organ !== 'undefined') {
        if (target === 'organ') Organ.activate();
        else Organ.deactivate();
      }
    });
  });
}

// ============================================================================
// Keyboard Navigation
// ============================================================================

function initPsalmodyKeys() {
  document.addEventListener('keydown', e => {
    // Only handle when psalmody tab is active
    const psalmodyActive = document.getElementById('tab-psalmody').classList.contains('active');

    // Tab switching
    if (e.key === 'F1') { e.preventDefault(); document.querySelector('[data-tab="generator"]').click(); }
    if (e.key === 'F2') { e.preventDefault(); document.querySelector('[data-tab="psalmody"]').click(); }
    if (e.key === 'F3') { e.preventDefault(); document.querySelector('[data-tab="organ"]').click(); }

    if (!psalmodyActive) return;
    if (e.target.matches('input')) return; // don't hijack search

    // Arrow keys navigate hymn list
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...document.querySelectorAll('.hymn-item')];
      if (items.length === 0) return;

      const currentIdx = items.findIndex(el => el.dataset.id === selectedHymnId);
      let nextIdx;
      if (e.key === 'ArrowDown') {
        nextIdx = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
      } else {
        nextIdx = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
      }
      items[nextIdx].click();
      items[nextIdx].scrollIntoView({ block: 'nearest' });
    }

    // Enter plays selected hymn
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedHymn) {
        isPlaying ? stopCurrentHymn() : playCurrentHymn();
      }
    }

    // Space also toggles playback
    if (e.key === ' ') {
      e.preventDefault();
      if (selectedHymn) {
        isPlaying ? stopCurrentHymn() : playCurrentHymn();
      }
    }

    // Number keys jump to section (future use)
    if (e.key >= '1' && e.key <= '9') {
      // Could jump to specific section — leaving for later
    }
  });
}

// ============================================================================
// Init
// ============================================================================

function initPsalmody() {
  initTabs();

  // Init TempleOS-style tempo/staccato sliders
  TempoCtrl.init('tempoCtrlCanvas', {
    bpm: 150,
    onTempoChange: (bpm) => {
      // If a hymn is selected, update its playback BPM for next play
    },
    onStaccatoChange: (ratio) => {
      // Will affect note duration in future playback
    }
  });

  loadHymns().then(data => {
    if (!data) {
      document.getElementById('hymnList').innerHTML =
        '<div style="color:var(--red);padding:8px;">Failed to load hymns</div>';
      return;
    }
    renderHymnList();

    // Search
    document.getElementById('hymnSearch').addEventListener('input', e => {
      renderHymnList(e.target.value);
    });
  });

  initPsalmodyKeys();
}

// Run on load
initPsalmody();
