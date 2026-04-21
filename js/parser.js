// ============================================================================
// TempleOS Song Notation Parser → Note Events
// ============================================================================

// Note frequencies (A4 = 440Hz)
const NOTE_NAMES = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

function noteToFreq(name, octave, accidental) {
  let semitone = NOTE_NAMES[name];
  if (accidental === '#') semitone++;
  if (accidental === 'b') semitone--;
  // A4=440, C4 is semitone 0 in octave 4
  const midi = semitone + (octave + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function parseSong(songStr, bpm) {
  const events = [];
  const quarterDuration = 60 / bpm; // seconds per quarter note
  let i = 0;
  let currentDuration = quarterDuration; // default quarter
  let currentOctave = 4;
  let tripletMode = false;
  let time = 0;

  while (i < songStr.length) {
    const c = songStr[i];

    if (c === 'M') {
      // Meter — skip M#/#
      i++;
      while (i < songStr.length && (songStr[i].match(/[0-9\/]/))) i++;
      continue;
    }

    if (c === 'R') {
      // Rest — advance time by current duration
      events.push({ type: 'rest', time, duration: currentDuration });
      time += currentDuration;
      i++;
      continue;
    }

    // Duration specifiers
    if (c === 'w') { currentDuration = quarterDuration * 4; i++; continue; }
    if (c === 'h') { currentDuration = quarterDuration * 2; i++; continue; }
    if (c === 'q') { currentDuration = quarterDuration; i++; continue; }
    if (c === 'e') { currentDuration = quarterDuration / 2; i++; continue; }
    if (c === 's') { currentDuration = quarterDuration / 4; i++; continue; }

    // Duration modifiers
    if (c === 't') { tripletMode = true; i++; continue; }
    if (c === '.') { currentDuration *= 1.5; i++; continue; }

    // Octave
    if (c >= '0' && c <= '9') { currentOctave = parseInt(c); i++; continue; }

    // Accidentals
    if (c === '#' || (c === 'b' && i + 1 < songStr.length && songStr[i+1] >= 'A' && songStr[i+1] <= 'G')) {
      // handled as part of note — skip for now, handled below
      i++;
      continue;
    }

    // Tie
    if (c === '(') { i++; continue; }

    // Notes A-G
    if (c >= 'A' && c <= 'G') {
      let accidental = null;
      // Look ahead for accidental
      if (i + 1 < songStr.length && (songStr[i+1] === '#' || songStr[i+1] === 'b')) {
        accidental = songStr[i+1];
      }

      let dur = currentDuration;
      if (tripletMode) { dur = currentDuration * (2/3); }

      const freq = noteToFreq(c, currentOctave, accidental);
      events.push({
        type: 'note',
        name: c,
        octave: currentOctave,
        freq,
        time,
        duration: dur * 0.85, // slight staccato like PC speaker
        fullDuration: dur,
        accidental
      });
      time += dur;

      if (accidental) i++; // skip the accidental char
      i++;
      continue;
    }

    i++; // skip unknown
  }

  return events;
}
