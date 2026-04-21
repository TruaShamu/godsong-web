// ============================================================================
// Staff Notation Display — Render notes on a musical staff (canvas-based)
// ============================================================================
//
// Faithful to TempleOS Psalmody's DrawIt() and DrawNote() functions.
// Uses canvas for pixel-level control matching the original aesthetic.
//
// From psalmody.cpp.z:
//   - Two staves of 5 lines each (treble at i*8 for 1-5, bass at 7-11)
//   - Note Y = (15 + (psm_note_map[note] - 7*(octave-2))) * 4
//   - PSM_NOTE_SPACING = 9
//   - Duration list: st, s, et, e, qt, e., q, q., h, h., w, w.
//   - Colors: GREEN notes, RED selected, BLACK staff, BROWN lyrics

const Staff = (() => {
  // --- TempleOS Constants (from psalmody.cpp.z) ---
  const NOTE_SPACING = 14;  // scaled up from 9 for readability on web
  const STAFF_LINE_GAP = 10; // space between staff lines (original was 8px)
  const STAFF_TOP = 30;     // top margin

  // TempleOS note mapping: semitone → staff line position
  // psm_note_map[12] = {6,6,5,4,4,3,3,2,1,1,0,0}
  // Maps: A=6, A#=6, B=5, C=4, C#=4, D=3, D#=3, E=2, F=1, F#=1, G=0, G#=0
  const PSM_NOTE_MAP = [6, 6, 5, 4, 4, 3, 3, 2, 1, 1, 0, 0];

  // Note names to semitone index (matching TempleOS psm_note_lst order: A,A#,B,C,C#,D,D#,E,F,F#,G,G#)
  const NOTE_TO_SEMITONE = {
    'A': 0, 'A#': 1, 'B': 2, 'C': 3, 'C#': 4, 'D': 5,
    'D#': 6, 'E': 7, 'F': 8, 'F#': 9, 'G': 10, 'G#': 11
  };

  // Duration names (TempleOS): st=sixteenth-triplet, s=sixteenth, et=eighth-triplet,
  // e=eighth, qt=quarter-triplet, e.=dotted-eighth, q=quarter, q.=dotted-quarter,
  // h=half, h.=dotted-half, w=whole, w.=dotted-whole
  const DURATION_WIDTHS = {
    'st': 0.167, 's': 0.25, 'et': 0.333, 'e': 0.5,
    'qt': 0.667, 'e.': 0.75, 'q': 1.0, 'q.': 1.5,
    'h': 2.0, 'h.': 3.0, 'w': 4.0, 'w.': 6.0
  };

  // TempleOS 16-color palette
  const COLORS = {
    BLACK: '#000000',
    GREEN: '#00AA00',
    LTGREEN: '#55FF55',
    RED: '#AA0000',
    BROWN: '#AA5500',
    WHITE: '#FFFFFF',
    YELLOW: '#FFFF55',
    BLUE: '#0000AA',
    LTBLUE: '#5555FF',
    CYAN: '#00AAAA'
  };

  let canvas = null;
  let ctx = null;
  let scrollX = 0;

  // --- Convert parsed note events to staff positions ---
  function noteToStaffY(noteName, octave) {
    // Build semitone from note name
    let semitone;
    if (noteName.length > 1 && noteName[1] === '#') {
      const base = noteName[0];
      semitone = NOTE_TO_SEMITONE[base + '#'];
      if (semitone === undefined) semitone = (NOTE_TO_SEMITONE[base] + 1) % 12;
    } else if (noteName.length > 1 && noteName[1] === 'b') {
      const base = noteName[0];
      semitone = NOTE_TO_SEMITONE[base] - 1;
      if (semitone < 0) semitone = 11;
    } else {
      semitone = NOTE_TO_SEMITONE[noteName];
    }

    if (semitone === undefined) return STAFF_TOP + 5 * STAFF_LINE_GAP; // fallback to middle

    // TempleOS formula: y = (15 + (psm_note_map[note] - 7*(octave-2))) * 4
    // We adapt for our scale
    const staffPos = PSM_NOTE_MAP[semitone] - 7 * (octave - 4); // center on octave 4
    // Map to pixel Y: middle of treble staff is line 3 (B4), staffPos=0 is high G
    const middleY = STAFF_TOP + 4 * STAFF_LINE_GAP; // 3rd line from top = B
    return middleY - staffPos * (STAFF_LINE_GAP / 2);
  }

  // --- Duration to note head shape ---
  function getDurationInfo(event) {
    // Map from our parsed events to duration category
    // Our parser gives fullDuration in seconds; we need to figure out note type
    // Using the duration string from the original notation would be ideal,
    // but we work with what parseSong gives us: { time, duration, fullDuration, freq, name, octave }
    // duration = sounding time, fullDuration = total time slot
    // We'll estimate: compare fullDuration to quarter note duration
    // (This is approximate — a proper implementation would carry the duration type through the parser)
    const fd = event.fullDuration;
    const qtr = event._quarterDuration || 0.4; // fallback

    const ratio = fd / qtr;
    if (ratio <= 0.3) return { type: 'sixteenth', filled: true, stem: true, flags: 2 };
    if (ratio <= 0.6) return { type: 'eighth', filled: true, stem: true, flags: 1 };
    if (ratio <= 1.2) return { type: 'quarter', filled: true, stem: true, flags: 0 };
    if (ratio <= 2.5) return { type: 'half', filled: false, stem: true, flags: 0 };
    return { type: 'whole', filled: false, stem: false, flags: 0 };
  }

  // --- Drawing ---
  function drawStaffLines(width) {
    ctx.strokeStyle = COLORS.GREEN;
    ctx.lineWidth = 1;

    // 5 treble staff lines
    for (let i = 0; i < 5; i++) {
      const y = STAFF_TOP + i * STAFF_LINE_GAP;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
  }

  function drawNote(x, y, durInfo, color, accidental) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    // Note head
    const rx = 5, ry = 3.5;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, -0.2, 0, Math.PI * 2);
    if (durInfo.filled) {
      ctx.fill();
    } else {
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Stem
    if (durInfo.stem) {
      ctx.lineWidth = 1.5;
      const stemUp = y > STAFF_TOP + 2 * STAFF_LINE_GAP;
      const stemLen = 30;
      ctx.beginPath();
      if (stemUp) {
        ctx.moveTo(x + rx, y);
        ctx.lineTo(x + rx, y - stemLen);
      } else {
        ctx.moveTo(x - rx, y);
        ctx.lineTo(x - rx, y + stemLen);
      }
      ctx.stroke();

      // Flags
      if (durInfo.flags > 0) {
        const flagDir = stemUp ? -1 : 1;
        const flagX = stemUp ? x + rx : x - rx;
        const flagY = stemUp ? y - stemLen : y + stemLen;
        for (let f = 0; f < durInfo.flags; f++) {
          ctx.beginPath();
          ctx.moveTo(flagX, flagY + f * 6 * flagDir);
          ctx.quadraticCurveTo(
            flagX + 10, flagY + (f * 6 + 8) * flagDir,
            flagX + 6, flagY + (f * 6 + 14) * flagDir
          );
          ctx.stroke();
        }
      }
    }

    // Accidental (sharp/flat)
    if (accidental === '#') {
      ctx.font = '12px monospace';
      ctx.fillText('♯', x - 14, y + 4);
    } else if (accidental === 'b') {
      ctx.font = '12px monospace';
      ctx.fillText('♭', x - 12, y + 4);
    }

    // Ledger lines if note is above or below staff
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.GREEN;
    const staffBottom = STAFF_TOP + 4 * STAFF_LINE_GAP;
    if (y < STAFF_TOP) {
      for (let ly = STAFF_TOP - STAFF_LINE_GAP; ly >= y - 2; ly -= STAFF_LINE_GAP) {
        ctx.beginPath();
        ctx.moveTo(x - 8, ly + 0.5);
        ctx.lineTo(x + 8, ly + 0.5);
        ctx.stroke();
      }
    }
    if (y > staffBottom) {
      for (let ly = staffBottom + STAFF_LINE_GAP; ly <= y + 2; ly += STAFF_LINE_GAP) {
        ctx.beginPath();
        ctx.moveTo(x - 8, ly + 0.5);
        ctx.lineTo(x + 8, ly + 0.5);
        ctx.stroke();
      }
    }
  }

  function drawLyric(x, y, text) {
    if (!text) return;
    ctx.fillStyle = COLORS.BROWN;
    ctx.font = '10px "TempleOS", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'start';
  }

  // --- Main render function ---
  function render(events, lyrics) {
    if (!canvas || !ctx) return;

    const staffHeight = 5 * STAFF_LINE_GAP + 60; // extra space for lyrics + ledger lines
    const lyricsY = STAFF_TOP + 5 * STAFF_LINE_GAP + 18;

    // Calculate needed width
    const noteEvents = events.filter(e => e.type === 'note');
    const totalWidth = Math.max(
      canvas.parentElement?.clientWidth || 600,
      noteEvents.length * NOTE_SPACING + 80
    );

    canvas.width = totalWidth;
    canvas.height = staffHeight + 20;

    // Clear
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw staff
    drawStaffLines(totalWidth);

    // Treble clef symbol (simplified)
    ctx.fillStyle = COLORS.LTGREEN;
    ctx.font = '38px serif';
    ctx.fillText('𝄞', 4, STAFF_TOP + 3.5 * STAFF_LINE_GAP);

    // Draw notes
    let x = 50; // start after clef
    const quarterDur = noteEvents.length > 0 ? (noteEvents[0].fullDuration || 0.4) : 0.4;

    noteEvents.forEach((ev, i) => {
      const y = noteToStaffY(ev.name, ev.octave);
      ev._quarterDuration = quarterDur;
      const durInfo = getDurationInfo(ev);
      const color = COLORS.GREEN;

      drawNote(x, y, durInfo, color, ev.accidental);

      // Lyrics if available
      if (lyrics && lyrics[i]) {
        drawLyric(x, lyricsY, lyrics[i]);
      }

      x += NOTE_SPACING;
    });

    // End bar
    if (noteEvents.length > 0) {
      ctx.strokeStyle = COLORS.GREEN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 5, STAFF_TOP);
      ctx.lineTo(x + 5, STAFF_TOP + 4 * STAFF_LINE_GAP);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + 10, STAFF_TOP);
      ctx.lineTo(x + 10, STAFF_TOP + 4 * STAFF_LINE_GAP);
      ctx.stroke();
    }
  }

  // --- Init ---
  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
  }

  return { init, render, noteToStaffY };
})();
