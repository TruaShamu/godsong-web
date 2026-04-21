// ============================================================================
// Web Audio Playback — PC Speaker Faithful (Intel 8254 PIT style)
// ============================================================================
//
// TempleOS sound is a raw square wave from the PC speaker via the 8254 PIT.
// Key characteristics we emulate:
//   1. Non-bandlimited square wave (harsh, all harmonics, aliasing artifacts)
//   2. Instant on/off — no attack/decay envelope, clicks between notes
//   3. Single voice — PC speaker can only play one freq at a time
//
// "Authentic mode" plays single-voice like the real hardware.
// "Enhanced mode" (default) allows polyphonic playback for hymn harmony.

let audioCtx = null;
let isPlaying = false;
let scheduledNodes = [];
let animationFrame = null;
let currentEvents = [];
let playStartTime = 0;
let authenticMode = false; // true = single-voice like real PC speaker

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Build a non-bandlimited square wave using PeriodicWave
// Real PC speaker has ALL harmonics including aliased ones — this is what
// makes it sound harsh and buzzy vs Web Audio's clean bandlimited 'square'
function createRawSquareWave() {
  // Square wave Fourier series: sin(f) + sin(3f)/3 + sin(5f)/5 + ...
  // More harmonics = harsher, more aliasing artifacts = more authentic
  const N = 128; // enough harmonics to get that crunchy sound
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  real[0] = 0;
  imag[0] = 0;
  for (let n = 1; n < N; n++) {
    real[n] = 0;
    if (n % 2 === 1) {
      // Odd harmonics only, amplitude = 1/n
      imag[n] = 1.0 / n;
    } else {
      imag[n] = 0;
    }
  }
  // disableNormalization: true — don't scale down, keep it raw and loud
  return audioCtx.createPeriodicWave(real, imag, { disableNormalization: true });
}

function playSong(events) {
  ensureAudioCtx();
  stopSong();

  isPlaying = true;
  currentEvents = events;
  playStartTime = audioCtx.currentTime + 0.05;
  scheduledNodes = [];

  const rawSquare = createRawSquareWave();

  // Master gain — raw square is loud, tame it
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.12;
  masterGain.connect(audioCtx.destination);

  // Separate buses for melody/harmony
  const melodyGain = audioCtx.createGain();
  melodyGain.gain.value = 1.0;
  melodyGain.connect(masterGain);

  const harmonyGain = audioCtx.createGain();
  harmonyGain.gain.value = 0.55; // harmony sits behind melody
  harmonyGain.connect(masterGain);

  let totalDuration = 0;

  if (authenticMode) {
    // AUTHENTIC MODE: single voice, like real PC speaker
    // Merge all notes, sort by time, play one at a time
    // Later note cuts off earlier note (just like Snd() replacing prev freq)
    const allNotes = events.filter(ev => ev.type === 'note')
      .sort((a, b) => a.time - b.time);

    allNotes.forEach((ev, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.setPeriodicWave(rawSquare);
      osc.frequency.value = ev.freq;

      // INSTANT on/off — no ramp. The click IS the sound.
      const noteStart = playStartTime + ev.time;
      // If next note starts before this one ends, cut off early
      let noteEnd = playStartTime + ev.time + ev.duration;
      if (idx + 1 < allNotes.length) {
        const nextStart = playStartTime + allNotes[idx + 1].time;
        if (nextStart < noteEnd) noteEnd = nextStart;
      }

      gain.gain.setValueAtTime(0, 0);
      gain.gain.setValueAtTime(1, noteStart);
      gain.gain.setValueAtTime(1, noteEnd);
      gain.gain.setValueAtTime(0, noteEnd);

      osc.connect(gain);
      gain.connect(melodyGain);
      osc.start(noteStart);
      osc.stop(noteEnd + 0.01);
      scheduledNodes.push(osc);

      totalDuration = Math.max(totalDuration, ev.time + ev.fullDuration);
    });
  } else {
    // ENHANCED MODE: polyphonic, but still raw square wave + instant on/off
    events.forEach(ev => {
      if (ev.type !== 'note') {
        totalDuration = Math.max(totalDuration, ev.time + (ev.duration || 0));
        return;
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.setPeriodicWave(rawSquare);
      osc.frequency.value = ev.freq;

      const noteStart = playStartTime + ev.time;
      const noteEnd = playStartTime + ev.time + ev.duration;

      // INSTANT on/off — Snd(freq) then Snd(0), no envelope
      // The abrupt transition creates the characteristic click/pop
      gain.gain.setValueAtTime(0, 0);
      gain.gain.setValueAtTime(1, noteStart);
      gain.gain.setValueAtTime(1, noteEnd);
      gain.gain.setValueAtTime(0, noteEnd);

      osc.connect(gain);
      const bus = (ev.voice === 'harmony') ? harmonyGain : melodyGain;
      gain.connect(bus);

      osc.start(noteStart);
      osc.stop(noteEnd + 0.01);

      scheduledNodes.push(osc);
      totalDuration = Math.max(totalDuration, ev.time + ev.fullDuration);
    });
  }

  return totalDuration;
}

function stopSong() {
  isPlaying = false;
  scheduledNodes.forEach(n => { try { n.stop(); } catch(e) {} });
  scheduledNodes = [];
  if (animationFrame) cancelAnimationFrame(animationFrame);
}

function setAuthenticMode(on) {
  authenticMode = on;
}

function getAuthenticMode() {
  return authenticMode;
}

// ============================================================================
// Visualization — Piano Roll Style
// ============================================================================

function startVisualization(totalDuration) {
  const canvas = document.getElementById('pianoRoll');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const noteEvents = currentEvents.filter(e => e.type === 'note');
  if (noteEvents.length === 0) return;

  const minFreq = Math.min(...noteEvents.map(e => e.freq));
  const maxFreq = Math.max(...noteEvents.map(e => e.freq));
  const freqRange = maxFreq - minFreq || 100;

  function draw() {
    if (!isPlaying) return;

    const elapsed = audioCtx.currentTime - playStartTime;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw notes
    noteEvents.forEach(ev => {
      const x = (ev.time / totalDuration) * canvas.width;
      const w = (ev.fullDuration / totalDuration) * canvas.width;
      const yNorm = 1 - (ev.freq - minFreq) / (freqRange * 1.2);
      const y = yNorm * (canvas.height - 16) + 4;

      const isActive = elapsed >= ev.time && elapsed < ev.time + ev.fullDuration;
      const isPast = elapsed >= ev.time + ev.fullDuration;

      if (isActive) {
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
      } else if (isPast) {
        ctx.fillStyle = '#004444';
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#00aaaa';
        ctx.shadowBlur = 0;
      }

      ctx.fillRect(x, y, Math.max(w - 1, 2), 6);
      ctx.shadowBlur = 0;
    });

    // Playhead
    const px = (elapsed / totalDuration) * canvas.width;
    ctx.strokeStyle = '#ff5555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.stroke();

    animationFrame = requestAnimationFrame(draw);
  }

  animationFrame = requestAnimationFrame(draw);
}
