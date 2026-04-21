// ============================================================================
// Keyboard Organ — Play notes live with your keyboard (faithful to Psalmody!)
// ============================================================================
//
// TempleOS Psalmody used the keyboard as an organ. Letter keys A-G play notes.
// This recreates that experience with Web Audio square waves.
//
// Key mapping (matches psm_note_lst from psalmody.cpp.z):
//   A B C D E F G — natural notes
//   Shift+key     — sharp (e.g., Shift+A = A#)
//   1-6           — octave select
//   Z/X           — octave down/up
//
// The visual keyboard diagram mirrors Terry's hand-drawn keyboard graphic
// that appeared in the Psalmody UI.

const Organ = (() => {
  // --- State ---
  let currentOctave = 4;
  let activeNotes = new Map();   // key → { osc, gain }
  let organActive = false;       // only process keys when organ tab is visible

  // Recording state
  let recording = false;
  let recordedNotes = [];        // Array of { name, octave, accidental, duration }

  // Duration map for recording: key → quarter note multiplier
  const DURATION_MAP = {
    's': 0.25,   // sixteenth
    'e': 0.5,    // eighth
    'q': 1.0,    // quarter
    'h': 2.0,    // half
    'w': 4.0,    // whole
  };

  // TempleOS note list: A, A#, B, C, C#, D, D#, E, F, F#, G, G#
  // We map keyboard letters to natural notes
  const KEY_TO_NOTE = {
    'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D',
    'e': 'E', 'f': 'F', 'g': 'G'
  };

  // White keys in chromatic order for the visual keyboard
  const CHROMATIC = [
    { note: 'C',  white: true },
    { note: 'C#', white: false },
    { note: 'D',  white: true },
    { note: 'D#', white: false },
    { note: 'E',  white: true },
    { note: 'F',  white: true },
    { note: 'F#', white: false },
    { note: 'G',  white: true },
    { note: 'G#', white: false },
    { note: 'A',  white: true },
    { note: 'A#', white: false },
    { note: 'B',  white: true },
  ];

  // Key labels for the visual keyboard
  const NOTE_TO_KEY = {
    'C': 'C', 'C#': '⇧C', 'D': 'D', 'D#': '⇧D', 'E': 'E',
    'F': 'F', 'F#': '⇧F', 'G': 'G', 'G#': '⇧G', 'A': 'A',
    'A#': '⇧A', 'B': 'B'
  };

  // --- Audio ---
  function playNote(noteName, octave) {
    ensureAudioCtx();
    const key = noteName + octave;
    if (activeNotes.has(key)) return; // already playing

    const accidental = noteName.length > 1 ? '#' : null;
    const baseName = noteName[0];
    const freq = noteToFreq(baseName, octave, accidental);

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = 0.10; // gentle, like a real PC speaker

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();

    activeNotes.set(key, { osc, gain });
    highlightKey(noteName, true);
    updateStatus(`♪ ${noteName}${octave} (${freq.toFixed(1)} Hz)`);

    // Record the note if in recording mode
    if (recording) {
      const durSelect = document.getElementById('recordDuration');
      const durKey = durSelect ? durSelect.value : 'q';
      const accidental = noteName.length > 1 ? '#' : null;
      const baseName = noteName[0];
      recordedNotes.push({
        name: baseName,
        octave: octave,
        accidental: accidental,
        duration: DURATION_MAP[durKey],
        fullDuration: DURATION_MAP[durKey],
        freq: freq,
        type: 'note',
        time: recordedNotes.length * 0.3, // placeholder for staff rendering
      });
      updateRecordStatus();
      renderRecordedStaff();
    }
  }

  function stopNote(noteName, octave) {
    const key = noteName + octave;
    const node = activeNotes.get(key);
    if (!node) return;

    // Quick fade to avoid click
    node.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.015);
    setTimeout(() => {
      try { node.osc.stop(); } catch(e) {}
    }, 50);

    activeNotes.delete(key);
    highlightKey(noteName, false);
    if (activeNotes.size === 0) updateStatus('Ready');
  }

  function stopAllNotes() {
    for (const [key, node] of activeNotes) {
      node.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
      setTimeout(() => { try { node.osc.stop(); } catch(e) {} }, 30);
    }
    activeNotes.clear();
    document.querySelectorAll('.organ-key.pressed').forEach(el => el.classList.remove('pressed'));
    updateStatus('Ready');
  }

  // --- Keyboard Handling ---
  // Track which physical keys are held to handle keydown repeats
  const heldKeys = new Set();

  function handleKeyDown(e) {
    if (!organActive) return;
    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const k = e.key.toLowerCase();

    // Octave select: number keys
    if (k >= '1' && k <= '6' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      currentOctave = parseInt(k);
      updateOctaveDisplay();
      return;
    }

    // Octave shift: Z down, X up
    if (k === 'z') {
      e.preventDefault();
      currentOctave = Math.max(1, currentOctave - 1);
      updateOctaveDisplay();
      return;
    }
    if (k === 'x') {
      e.preventDefault();
      currentOctave = Math.min(7, currentOctave + 1);
      updateOctaveDisplay();
      return;
    }

    // Note keys
    if (KEY_TO_NOTE[k]) {
      e.preventDefault();
      const physKey = k + (e.shiftKey ? '#' : '');
      if (heldKeys.has(physKey)) return; // ignore key repeat
      heldKeys.add(physKey);

      let noteName = KEY_TO_NOTE[k];
      if (e.shiftKey) noteName += '#';
      playNote(noteName, currentOctave);
    }
  }

  function handleKeyUp(e) {
    if (!organActive) return;
    const k = e.key.toLowerCase();
    if (KEY_TO_NOTE[k]) {
      // Release both natural and sharp for this key
      heldKeys.delete(k);
      heldKeys.delete(k + '#');
      const noteName = KEY_TO_NOTE[k];
      stopNote(noteName, currentOctave);
      stopNote(noteName + '#', currentOctave);
    }
  }

  // --- Visual Keyboard ---
  function renderKeyboard() {
    const container = document.getElementById('organKeyboard');
    if (!container) return;
    container.innerHTML = '';

    // White keys
    const whiteKeys = CHROMATIC.filter(n => n.white);
    const blackKeys = CHROMATIC.filter(n => !n.white);

    // Build keyboard like TempleOS — simple rectangles
    const kbdDiv = document.createElement('div');
    kbdDiv.className = 'organ-keys-container';

    // White keys first (background layer)
    whiteKeys.forEach((n, i) => {
      const key = document.createElement('div');
      key.className = 'organ-key organ-white';
      key.dataset.note = n.note;
      key.innerHTML = `<span class="key-label">${NOTE_TO_KEY[n.note]}</span>`;

      // Mouse interaction
      key.addEventListener('mousedown', (e) => {
        e.preventDefault();
        playNote(n.note, currentOctave);
      });
      key.addEventListener('mouseup', () => stopNote(n.note, currentOctave));
      key.addEventListener('mouseleave', () => stopNote(n.note, currentOctave));

      kbdDiv.appendChild(key);
    });

    // Black keys overlay
    // Position black keys between their white key neighbors
    // C#=after C(0), D#=after D(1), F#=after F(3), G#=after G(4), A#=after A(5)
    const blackPositions = [0, 1, 3, 4, 5]; // white key indices after which black keys appear
    blackKeys.forEach((n, i) => {
      const key = document.createElement('div');
      key.className = 'organ-key organ-black';
      key.dataset.note = n.note;
      key.innerHTML = `<span class="key-label">${NOTE_TO_KEY[n.note]}</span>`;

      // Position relative to white keys
      const whiteKeyWidth = 100 / 7; // 7 white keys
      const pos = (blackPositions[i] + 0.65) * whiteKeyWidth;
      key.style.left = pos + '%';

      key.addEventListener('mousedown', (e) => {
        e.preventDefault();
        playNote(n.note, currentOctave);
      });
      key.addEventListener('mouseup', () => stopNote(n.note, currentOctave));
      key.addEventListener('mouseleave', () => stopNote(n.note, currentOctave));

      kbdDiv.appendChild(key);
    });

    container.appendChild(kbdDiv);
  }

  function highlightKey(noteName, on) {
    const el = document.querySelector(`.organ-key[data-note="${noteName}"]`);
    if (el) {
      if (on) el.classList.add('pressed');
      else el.classList.remove('pressed');
    }
  }

  function updateOctaveDisplay() {
    const el = document.getElementById('organOctave');
    if (el) el.textContent = currentOctave;
    // Update all octave buttons
    document.querySelectorAll('.octave-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.octave) === currentOctave);
    });
  }

  function updateStatus(msg) {
    const el = document.getElementById('statusLeft');
    if (el) el.textContent = msg;
  }

  // --- Octave Selector ---
  function renderOctaveSelector() {
    const container = document.getElementById('organOctaveSelector');
    if (!container) return;
    container.innerHTML = '';

    for (let o = 1; o <= 6; o++) {
      const btn = document.createElement('button');
      btn.className = 'octave-btn' + (o === currentOctave ? ' active' : '');
      btn.dataset.octave = o;
      btn.textContent = o;
      btn.addEventListener('click', () => {
        currentOctave = o;
        updateOctaveDisplay();
      });
      container.appendChild(btn);
    }
  }

  // --- Init / Cleanup ---
  function activate() {
    organActive = true;
    renderKeyboard();
    renderOctaveSelector();
    updateOctaveDisplay();
    initRecordButtons();
    renderRecordedStaff();
    if (typeof Composer !== 'undefined') Composer.init();
  }

  function deactivate() {
    organActive = false;
    stopAllNotes();
    if (recording) toggleRecord(); // stop recording on tab switch
  }

  // --- Recording Controls ---
  function toggleRecord() {
    recording = !recording;
    const btn = document.getElementById('btnRecord');
    if (btn) btn.classList.toggle('active', recording);
    const status = document.getElementById('recordStatus');
    if (status) status.textContent = recording ? '● RECORDING...' : (recordedNotes.length > 0 ? `${recordedNotes.length} notes` : 'Ready');
    if (status) status.style.color = recording ? '#f55' : '#888';
  }

  function playRecorded() {
    if (recordedNotes.length === 0) return;
    const bpm = (typeof TempoCtrl !== 'undefined') ? TempoCtrl.getBPM() : 150;
    const qtrDur = 60 / bpm;

    // Build proper timed events
    let time = 0;
    const events = recordedNotes.map(n => {
      const ev = {
        ...n,
        time: time,
        duration: n.fullDuration * qtrDur * 0.9,
        fullDuration: n.fullDuration * qtrDur,
      };
      time += n.fullDuration * qtrDur;
      return ev;
    });

    playSong(events);
  }

  function clearRecorded() {
    recordedNotes = [];
    updateRecordStatus();
    renderRecordedStaff();
  }

  function updateRecordStatus() {
    const status = document.getElementById('recordStatus');
    if (status && !recording) status.textContent = `${recordedNotes.length} notes`;
    const playBtn = document.getElementById('btnRecordPlay');
    const clearBtn = document.getElementById('btnRecordClear');
    if (playBtn) playBtn.disabled = recordedNotes.length === 0;
    if (clearBtn) clearBtn.disabled = recordedNotes.length === 0;
  }

  function renderRecordedStaff() {
    if (typeof Staff === 'undefined') return;
    const canvas = document.getElementById('organStaffCanvas');
    if (!canvas) return;
    Staff.init('organStaffCanvas');
    if (recordedNotes.length > 0) {
      Staff.render(recordedNotes, null);
    } else {
      // Clear canvas
      const ctx = canvas.getContext('2d');
      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = 90;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function exportToPlayString() {
    // Convert recorded notes to TempleOS Play() notation
    if (recordedNotes.length === 0) return '';
    const DURATION_TO_CHAR = { 0.25: 's', 0.5: 'e', 1.0: 'q', 2.0: 'h', 4.0: 'w' };
    let str = '';
    let lastDur = null;
    let lastOctave = null;

    recordedNotes.forEach(n => {
      const durChar = DURATION_TO_CHAR[n.fullDuration] || 'q';
      if (durChar !== lastDur) { str += durChar; lastDur = durChar; }
      if (n.octave !== lastOctave) { str += n.octave; lastOctave = n.octave; }
      str += n.name;
      if (n.accidental === '#') str += '#'; // note: TempleOS uses # after note in some contexts
    });
    return str;
  }

  function initRecordButtons() {
    const recBtn = document.getElementById('btnRecord');
    const playBtn = document.getElementById('btnRecordPlay');
    const clearBtn = document.getElementById('btnRecordClear');

    if (recBtn) {
      recBtn.onclick = toggleRecord;
    }
    if (playBtn) {
      playBtn.onclick = playRecorded;
    }
    if (clearBtn) {
      clearBtn.onclick = clearRecorded;
    }
    updateRecordStatus();
  }

  // Global key listeners (always registered, but guarded by organActive)
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  return { activate, deactivate, stopAllNotes, exportToPlayString, getRecordedNotes: () => recordedNotes };
})();
