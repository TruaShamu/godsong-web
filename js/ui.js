// ============================================================================
// UI Wiring
// ============================================================================

const btnGenerate = document.getElementById('btnGenerate');
const btnPlay = document.getElementById('btnPlay');
const btnStop = document.getElementById('btnStop');
const btnCopy = document.getElementById('btnCopy');
const songText = document.getElementById('songText');
const statusLeft = document.getElementById('statusLeft');
const statusRight = document.getElementById('statusRight');
const noteLog = document.getElementById('noteLog');
const tempoSlider = document.getElementById('tempo');
const tempoVal = document.getElementById('tempoVal');

let currentSongStr = '';
let currentParsed = [];

// ============================================================================
// Song display with note highlighting
// ============================================================================

function displaySong(songStr, events) {
  songText.textContent = songStr;
  songText.style.color = '';

  // Log breakdown
  noteLog.innerHTML = '';
  const noteEvents = events.filter(e => e.type === 'note');
  const info = document.createElement('span');
  info.className = 'log-info';
  info.textContent = `${noteEvents.length} notes | `;
  noteLog.appendChild(info);

  noteEvents.forEach((ev, i) => {
    const s = document.createElement('span');
    s.className = 'log-note';
    s.textContent = `${ev.name}${ev.accidental||''}${ev.octave}`;
    if (i < noteEvents.length - 1) s.textContent += ' ';
    noteLog.appendChild(s);
  });
}

function highlightCurrentNote(events) {
  if (!isPlaying || !audioCtx) return;
  const elapsed = audioCtx.currentTime - playStartTime;
  const active = events.find(e => e.type === 'note' && elapsed >= e.time && elapsed < e.time + e.fullDuration);
  if (active) {
    statusLeft.textContent = `♪ ${active.name}${active.accidental||''}${active.octave} — ${Math.round(active.freq)}Hz`;
    statusLeft.className = 'active';
  }
  if (isPlaying) requestAnimationFrame(() => highlightCurrentNote(events));
}

// ============================================================================
// Event Handlers
// ============================================================================

tempoSlider.addEventListener('input', () => {
  tempoVal.textContent = tempoSlider.value + ' BPM';
});

btnGenerate.addEventListener('click', () => {
  const complexity = parseInt(document.getElementById('complexity').value);
  const len = parseInt(document.getElementById('meter').value);
  const baseOctave = parseInt(document.getElementById('baseOctave').value);
  const bpm = parseInt(tempoSlider.value);

  currentSongStr = godsong(len, complexity, baseOctave);
  currentParsed = parseSong(currentSongStr, bpm);

  displaySong(currentSongStr, currentParsed);
  statusLeft.textContent = 'Song generated — press Play';
  statusLeft.className = '';
});

btnPlay.addEventListener('click', () => {
  if (!currentSongStr) {
    btnGenerate.click();
  }
  // Re-parse with current tempo
  const bpm = parseInt(tempoSlider.value);
  currentParsed = parseSong(currentSongStr, bpm);

  const totalDuration = playSong(currentParsed);
  btnPlay.style.display = 'none';
  btnStop.style.display = '';
  highlightCurrentNote(currentParsed);
  startVisualization(totalDuration);

  // Auto-stop
  setTimeout(() => {
    if (isPlaying) {
      stopSong();
      btnPlay.style.display = '';
      btnStop.style.display = 'none';
      statusLeft.textContent = 'Ready';
    }
  }, (totalDuration + 0.5) * 1000);
});

btnStop.addEventListener('click', () => {
  stopSong();
  btnPlay.style.display = '';
  btnStop.style.display = 'none';
  statusLeft.textContent = 'Ready';
});

btnCopy.addEventListener('click', () => {
  if (currentSongStr) {
    navigator.clipboard.writeText(currentSongStr).then(() => {
      btnCopy.textContent = 'Copied!';
      setTimeout(() => btnCopy.textContent = 'Copy Song', 1500);
    });
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'F7') { e.preventDefault(); btnGenerate.click(); }
  if (e.key === ' ' && !e.target.matches('input,select')) {
    e.preventDefault();
    isPlaying ? btnStop.click() : btnPlay.click();
  }
});

// Generate one on load for instant gratification
window.addEventListener('load', () => btnGenerate.click());
