// ============================================================================
// Song Composition — Edit, save, and export songs
// ============================================================================
//
// Builds on the organ (keyboard input), staff (visual display), and
// record mode (note capture). Adds editing, localStorage persistence,
// and export to TempleOS Play() format.

const Composer = (() => {
  const STORAGE_KEY = 'godsong-compositions';

  // --- Song Management ---
  function getSavedSongs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  }

  function saveSong(name, notes) {
    const songs = getSavedSongs();
    const existing = songs.findIndex(s => s.name === name);
    const entry = {
      name,
      notes: notes.map(n => ({
        name: n.name, octave: n.octave,
        accidental: n.accidental, fullDuration: n.fullDuration,
      })),
      created: existing >= 0 ? songs[existing].created : new Date().toISOString(),
      modified: new Date().toISOString(),
    };
    if (existing >= 0) songs[existing] = entry;
    else songs.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    return entry;
  }

  function deleteSong(name) {
    const songs = getSavedSongs().filter(s => s.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  }

  function loadSong(name) {
    const song = getSavedSongs().find(s => s.name === name);
    if (!song) return null;
    // Rebuild full note objects with freq and type
    return song.notes.map((n, i) => {
      const accidental = n.accidental;
      const freq = noteToFreq(n.name, n.octave, accidental);
      return {
        ...n, freq, type: 'note',
        duration: n.fullDuration,
        time: i * 0.3, // placeholder
      };
    });
  }

  // --- Export to TempleOS Play() string ---
  function toPlayString(notes) {
    if (!notes || notes.length === 0) return '';
    const DURATION_TO_CHAR = { 0.25: 's', 0.5: 'e', 1.0: 'q', 2.0: 'h', 4.0: 'w' };
    let str = '';
    let lastDur = null;
    let lastOctave = null;

    notes.forEach(n => {
      const durChar = DURATION_TO_CHAR[n.fullDuration] || 'q';
      if (durChar !== lastDur) { str += durChar; lastDur = durChar; }
      if (n.octave !== lastOctave) { str += n.octave; lastOctave = n.octave; }
      str += n.name;
      if (n.accidental === '#') str += '#';
    });
    return str;
  }

  // --- Import from Play() string ---
  function fromPlayString(playStr, bpm = 150) {
    const events = parseSong(playStr, bpm);
    return events.filter(e => e.type === 'note');
  }

  // --- UI: Song list in the organ tab ---
  function renderSongList() {
    const container = document.getElementById('composerSongList');
    if (!container) return;

    const songs = getSavedSongs();
    if (songs.length === 0) {
      container.innerHTML = '<span style="color:#555; font-size:12px;">No saved songs yet</span>';
      return;
    }

    container.innerHTML = songs.map(s => `
      <div class="composer-song-item" data-name="${s.name}">
        <span class="composer-song-name">${s.name}</span>
        <span class="composer-song-notes">${s.notes.length} notes</span>
        <button class="composer-song-load" data-name="${s.name}">Load</button>
        <button class="composer-song-del" data-name="${s.name}">✕</button>
      </div>
    `).join('');

    // Wire buttons
    container.querySelectorAll('.composer-song-load').forEach(btn => {
      btn.onclick = () => {
        const notes = loadSong(btn.dataset.name);
        if (notes && typeof Organ !== 'undefined') {
          // Replace organ's recorded notes
          // We need Organ to expose a way to set recorded notes
          window._composerLoadNotes = notes;
          window._composerLoadName = btn.dataset.name;
          document.getElementById('composerName').value = btn.dataset.name;
          updateStatus(`Loaded "${btn.dataset.name}"`);
        }
      };
    });

    container.querySelectorAll('.composer-song-del').forEach(btn => {
      btn.onclick = () => {
        deleteSong(btn.dataset.name);
        renderSongList();
      };
    });
  }

  function updateStatus(msg) {
    const el = document.getElementById('statusLeft');
    if (el) el.textContent = msg;
  }

  // --- Init: wire up save/export/copy buttons ---
  function init() {
    const saveBtn = document.getElementById('btnComposerSave');
    const exportBtn = document.getElementById('btnComposerExport');
    const copyBtn = document.getElementById('btnComposerCopy');

    if (saveBtn) {
      saveBtn.onclick = () => {
        const name = document.getElementById('composerName')?.value?.trim();
        if (!name) {
          updateStatus('Enter a song name to save');
          return;
        }
        const notes = (typeof Organ !== 'undefined') ? Organ.getRecordedNotes() : [];
        if (notes.length === 0) {
          updateStatus('Record some notes first!');
          return;
        }
        saveSong(name, notes);
        renderSongList();
        updateStatus(`Saved "${name}" (${notes.length} notes)`);
      };
    }

    if (exportBtn) {
      exportBtn.onclick = () => {
        const notes = (typeof Organ !== 'undefined') ? Organ.getRecordedNotes() : [];
        const playStr = toPlayString(notes);
        if (!playStr) { updateStatus('Nothing to export'); return; }
        const name = document.getElementById('composerName')?.value?.trim() || 'untitled';

        // Generate HolyC source
        const holyc = `//5 no nothing\nPlay("${playStr}");\n`;

        // Download as file
        const blob = new Blob([holyc], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${name}.CPP`;
        a.click();
        URL.revokeObjectURL(a.href);
        updateStatus(`Exported ${name}.CPP (Play() format)`);
      };
    }

    if (copyBtn) {
      copyBtn.onclick = () => {
        const notes = (typeof Organ !== 'undefined') ? Organ.getRecordedNotes() : [];
        const playStr = toPlayString(notes);
        if (!playStr) { updateStatus('Nothing to copy'); return; }
        navigator.clipboard.writeText(`Play("${playStr}");`).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => copyBtn.textContent = '📋 Copy', 1500);
        });
      };
    }

    renderSongList();
  }

  return { init, renderSongList, saveSong, loadSong, deleteSong, toPlayString, fromPlayString };
})();
