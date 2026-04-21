// ============================================================================
// Hymn Loader — loads TempleOS Psalmody hymns from data/hymns.json
// ============================================================================

let hymnsData = null;
let hymnsLoaded = false;

/**
 * Load hymns from JSON. Returns a promise that resolves to the hymn map.
 * Each hymn: { name, bpm, staccato, sections: [{ melody, harmony?, lyrics? }] }
 */
async function loadHymns() {
  if (hymnsData) return hymnsData;

  try {
    const resp = await fetch('data/hymns.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    hymnsData = await resp.json();
    hymnsLoaded = true;
    console.log(`Loaded ${Object.keys(hymnsData).length} hymns`);
    return hymnsData;
  } catch (err) {
    console.error('Failed to load hymns:', err);
    return null;
  }
}

/**
 * Get a sorted list of hymn entries: [{ id, name, bpm, staccato, sections, hasLyrics, hasHarmony }]
 */
function getHymnList() {
  if (!hymnsData) return [];

  return Object.entries(hymnsData)
    .map(([id, h]) => ({
      id,
      name: h.name,
      bpm: h.bpm,
      staccato: h.staccato,
      sections: h.sections,
      hasLyrics: h.sections.some(s => s.lyrics),
      hasHarmony: h.sections.some(s => s.harmony),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a specific hymn by id.
 */
function getHymn(id) {
  if (!hymnsData || !hymnsData[id]) return null;
  const h = hymnsData[id];
  return {
    id,
    name: h.name,
    bpm: h.bpm,
    staccato: h.staccato,
    sections: h.sections,
    hasLyrics: h.sections.some(s => s.lyrics),
    hasHarmony: h.sections.some(s => s.harmony),
  };
}

/**
 * Parse all sections of a hymn into a flat event list for playback.
 * Sections play in sequence with a brief gap between them.
 * Returns { events, totalDuration, sectionOffsets }
 */
function parseHymn(hymn) {
  const allEvents = [];
  const sectionOffsets = [];
  let timeOffset = 0;
  const gapBetweenSections = 0.4; // seconds

  for (let si = 0; si < hymn.sections.length; si++) {
    const section = hymn.sections[si];
    sectionOffsets.push(timeOffset);

    // Parse melody
    const melodyEvents = parseSong(section.melody, hymn.bpm);

    // Apply staccato factor to note durations
    const staccato = hymn.staccato;
    melodyEvents.forEach(ev => {
      ev.time += timeOffset;
      ev.voice = 'melody';
      if (ev.type === 'note' && staccato < 1.0) {
        ev.duration *= staccato;
      }
    });
    allEvents.push(...melodyEvents);

    // Parse harmony if present
    if (section.harmony) {
      const harmonyEvents = parseSong(section.harmony, hymn.bpm);
      harmonyEvents.forEach(ev => {
        ev.time += timeOffset;
        ev.voice = 'harmony';
        if (ev.type === 'note' && staccato < 1.0) {
          ev.duration *= staccato;
        }
      });
      allEvents.push(...harmonyEvents);
    }

    // Find end of this section
    const sectionEnd = Math.max(
      ...melodyEvents.map(e => e.time + (e.fullDuration || e.duration || 0)),
      0
    );
    timeOffset = sectionEnd + gapBetweenSections;
  }

  return {
    events: allEvents,
    totalDuration: timeOffset - gapBetweenSections,
    sectionOffsets,
  };
}
