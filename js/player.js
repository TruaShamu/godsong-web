// ============================================================================
// Web Audio Playback — Square Wave (PC Speaker faithful!)
// ============================================================================

let audioCtx = null;
let isPlaying = false;
let scheduledNodes = [];
let animationFrame = null;
let currentEvents = [];
let playStartTime = 0;

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSong(events) {
  ensureAudioCtx();
  stopSong();

  isPlaying = true;
  currentEvents = events;
  playStartTime = audioCtx.currentTime + 0.05;
  scheduledNodes = [];

  // Master gain for the harsh square wave
  const master = audioCtx.createGain();
  master.gain.value = 0.15; // PC speaker wasn't loud
  master.connect(audioCtx.destination);

  let totalDuration = 0;

  events.forEach(ev => {
    if (ev.type !== 'note') {
      totalDuration = Math.max(totalDuration, ev.time + (ev.duration || 0));
      return;
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.value = ev.freq;

    // Sharp on/off like real PC speaker — no fade
    gain.gain.setValueAtTime(0, playStartTime + ev.time);
    gain.gain.setValueAtTime(1, playStartTime + ev.time + 0.001);
    gain.gain.setValueAtTime(1, playStartTime + ev.time + ev.duration - 0.001);
    gain.gain.setValueAtTime(0, playStartTime + ev.time + ev.duration);

    osc.connect(gain);
    gain.connect(master);

    osc.start(playStartTime + ev.time);
    osc.stop(playStartTime + ev.time + ev.duration + 0.01);

    scheduledNodes.push(osc);
    totalDuration = Math.max(totalDuration, ev.time + ev.fullDuration);
  });

  return totalDuration;
}

function stopSong() {
  isPlaying = false;
  scheduledNodes.forEach(n => { try { n.stop(); } catch(e) {} });
  scheduledNodes = [];
  if (animationFrame) cancelAnimationFrame(animationFrame);
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
