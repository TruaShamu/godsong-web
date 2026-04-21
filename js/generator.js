// ============================================================================
// GodSong Generator — ported from 8dcc's C port of Terry's GodSong
// ============================================================================

const DUR_4 = 0, DUR_8_8 = 1, DUR_3_3_3 = 2, DUR_16_16_16_16 = 3,
      DUR_8DOT_16 = 4, DUR_8_16_16 = 5, DUR_16_16_8 = 6;

const godSimpleSongs  = [DUR_4, DUR_4, DUR_4, DUR_4, DUR_8_8];
const godNormalSongs  = [DUR_4, DUR_4, DUR_8_8, DUR_3_3_3, DUR_16_16_16_16];
const godComplexSongs = [DUR_4, DUR_4, DUR_8_8, DUR_8_8, DUR_8DOT_16,
                         DUR_3_3_3, DUR_8_16_16, DUR_16_16_8, DUR_16_16_16_16];

function godbits(nbits) {
  let mask = 0;
  for (let i = 0; i < nbits; i++) { mask <<= 1; mask |= 1; }
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] & mask;
}

function getDuration(complexity, random) {
  const tables = [godSimpleSongs, godNormalSongs, godComplexSongs];
  const t = tables[complexity];
  return t[random % t.length];
}

function godsong(len, complexity, baseOctave) {
  let buf = '';
  let octave = baseOctave;
  let octaveOld = octave + 1;

  buf += String(octaveOld);

  if (len === 6) buf += 'M6/8';

  let lastDuration = -1;

  for (let i = 0; i < len; i++) {
    const duration = getDuration(complexity, godbits(8));
    let effectiveDuration = duration;

    switch (duration) {
      case DUR_8_8: {
        if (lastDuration !== DUR_8_8) buf += 'e';
        buf += insertNote(godbits(4));
        buf += insertNote(godbits(4));
        break;
      }
      case DUR_8DOT_16: {
        buf += 'e.';
        buf += insertNote(godbits(4));
        buf += 's';
        buf += insertNote(godbits(4));
        effectiveDuration = DUR_16_16_16_16;
        break;
      }
      case DUR_3_3_3: {
        if (lastDuration !== DUR_3_3_3) buf += 'et';
        buf += insertNote(godbits(4));
        buf += insertNote(godbits(4));
        buf += insertNote(godbits(4));
        break;
      }
      case DUR_8_16_16: {
        if (lastDuration !== DUR_8_8) buf += 'e';
        buf += insertNote(godbits(4));
        buf += 's';
        buf += insertNote(godbits(4));
        buf += insertNote(godbits(4));
        effectiveDuration = DUR_16_16_16_16;
        break;
      }
      case DUR_16_16_8: {
        if (lastDuration !== DUR_16_16_16_16) buf += 's';
        buf += insertNote(godbits(4));
        buf += insertNote(godbits(4));
        buf += 'e';
        buf += insertNote(godbits(4));
        effectiveDuration = DUR_8_8;
        break;
      }
      case DUR_16_16_16_16: {
        if (lastDuration !== DUR_16_16_16_16) buf += 's';
        const r1 = godbits(4), r2 = godbits(4);
        buf += insertNote(r1);
        buf += insertNote(r2);
        buf += insertNote(r1);
        buf += insertNote(r2);
        break;
      }
      default: { // DUR_4
        if (lastDuration !== DUR_4) buf += 'q';
        buf += insertNote(godbits(4));
        break;
      }
    }
    lastDuration = effectiveDuration;
  }

  function insertNote(random) {
    let s = '';
    if (random === 0) { return 'R'; }
    random = Math.floor(random / 2);
    if (random < 3) {
      if (octaveOld !== octave) { octaveOld = octave; s += String(octaveOld); }
    } else {
      if (octaveOld !== octave + 1) { octaveOld = octave + 1; s += String(octaveOld); }
    }
    s += (random === 0) ? 'G' : String.fromCharCode(random - 1 + 'A'.charCodeAt(0));
    return s;
  }

  return buf;
}
