// ============================================================================
// Tempo & Staccato Sliders — TempleOS-style vertical drag controls
// ============================================================================
//
// Faithful recreation of psalmodyctrls.cpp.z DrawTempoCtrl().
// Two vertical sliders in a green box with yellow handles.
//
// Original constants:
//   TEMPO_SPACING = 15, TEMPO_RANGE = 80, TEMPO_BORDER = 2
//   Colors: LTGREEN bg, BLACK inner, WHITE tracks, YELLOW handles, GREEN labels
//
// Note: Terry spelled it "Stacatto" — we preserve the original spelling.

const TempoCtrl = (() => {
  // --- TempleOS Constants ---
  const SPACING = 15;
  const RANGE = 80;
  const BORDER = 2;
  const CTRL_W = SPACING * 3 + 2;
  const CTRL_H = SPACING * 2 + RANGE;

  // Scale for web (original was tiny — 47x110 pixels)
  const SCALE = 2.5;
  const SW = Math.round(CTRL_W * SCALE);
  const SH = Math.round(CTRL_H * SCALE + 40); // extra for value labels
  const S_SPACING = SPACING * SCALE;
  const S_RANGE = RANGE * SCALE;
  const S_BORDER = BORDER * SCALE;

  // TempleOS 16-color palette
  const COL = {
    LTGREEN:  '#55FF55',
    BLACK:    '#000000',
    WHITE:    '#FFFFFF',
    YELLOW:   '#FFFF55',
    GREEN:    '#00AA00',
  };

  let canvas = null;
  let ctx = null;

  // State: 0-RANGE mapped to actual values
  let tempoVal = Math.round(RANGE * 0.6);   // ~60% = moderate tempo
  let staccatoVal = Math.round(RANGE * 0.5); // ~50% = balanced

  let dragging = null; // 'tempo' | 'staccato' | null

  // Callbacks
  let onTempoChange = null;
  let onStaccatoChange = null;

  // --- Drawing (matches DrawTempoCtrl exactly) ---
  function draw() {
    if (!ctx) return;
    const w = SW, h = SH;
    ctx.clearRect(0, 0, w, h);

    // Green background
    ctx.fillStyle = COL.LTGREEN;
    ctx.fillRect(0, 0, w, S_SPACING * 2 + S_RANGE);

    // Black inner
    ctx.fillStyle = COL.BLACK;
    ctx.fillRect(S_BORDER, S_BORDER,
      w - 2 * S_BORDER, S_SPACING * 2 + S_RANGE - 2 * S_BORDER);

    // Track lines (white vertical lines for each slider)
    ctx.strokeStyle = COL.WHITE;
    ctx.lineWidth = 2;
    const trackX1 = S_SPACING;
    const trackX2 = 2 * S_SPACING + SCALE;
    const trackTop = S_SPACING;
    const trackBot = S_SPACING + S_RANGE - SCALE;

    ctx.beginPath();
    ctx.moveTo(trackX1, trackTop); ctx.lineTo(trackX1, trackBot);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(trackX2, trackTop); ctx.lineTo(trackX2, trackBot);
    ctx.stroke();

    // Slider handles (yellow rectangles)
    const handleW = 7 * SCALE;
    const handleH = 3 * SCALE;

    // Tempo handle
    const tempoY = S_SPACING + S_RANGE - SCALE - tempoVal * SCALE - handleH / 2;
    ctx.fillStyle = COL.YELLOW;
    ctx.fillRect(trackX1 - handleW / 2, tempoY, handleW, handleH);
    // Darker border for 3D effect (TempleOS had a 2-color handle)
    ctx.fillStyle = COL.GREEN;
    ctx.fillRect(trackX1 - handleW / 2 + SCALE, tempoY + SCALE, handleW - 2 * SCALE, handleH - 2 * SCALE);
    ctx.fillStyle = COL.YELLOW;
    ctx.fillRect(trackX1 - handleW / 2 + SCALE, tempoY + SCALE, handleW - 2 * SCALE, handleH - 2 * SCALE);

    // Staccato handle
    const staccatoY = S_SPACING + S_RANGE - SCALE - staccatoVal * SCALE - handleH / 2;
    ctx.fillStyle = COL.YELLOW;
    ctx.fillRect(trackX2 - handleW / 2, staccatoY, handleW, handleH);
    ctx.fillStyle = COL.GREEN;
    ctx.fillRect(trackX2 - handleW / 2 + SCALE, staccatoY + SCALE, handleW - 2 * SCALE, handleH - 2 * SCALE);
    ctx.fillStyle = COL.YELLOW;
    ctx.fillRect(trackX2 - handleW / 2 + SCALE, staccatoY + SCALE, handleW - 2 * SCALE, handleH - 2 * SCALE);

    // Vertical text labels (TempleOS GrVPrint)
    ctx.fillStyle = COL.GREEN;
    ctx.font = `${Math.round(10 * SCALE)}px "TempleOS", monospace`;
    drawVerticalText(ctx, 'Tempo', S_BORDER + 3, S_SPACING + 4);
    drawVerticalText(ctx, 'Stacatto', w - S_BORDER - Math.round(10 * SCALE) + 2, S_SPACING + 4);

    // Value labels below
    ctx.fillStyle = COL.LTGREEN;
    ctx.font = `${Math.round(8 * SCALE)}px "TempleOS", monospace`;
    ctx.textAlign = 'center';
    const displayTempo = Math.round(tempoVal * 10 / RANGE);
    const displayStaccato = Math.round(staccatoVal * 10 / RANGE);
    ctx.fillText(displayTempo.toString(), trackX1, S_SPACING * 2 + S_RANGE + Math.round(12 * SCALE));
    ctx.fillText(displayStaccato.toString(), trackX2, S_SPACING * 2 + S_RANGE + Math.round(12 * SCALE));
    ctx.textAlign = 'start';

    // BPM display below values
    ctx.fillStyle = COL.WHITE;
    ctx.font = `${Math.round(6 * SCALE)}px "TempleOS", monospace`;
    ctx.textAlign = 'center';
    const bpm = tempoToBPM();
    ctx.fillText(`${bpm} BPM`, w / 2, S_SPACING * 2 + S_RANGE + Math.round(22 * SCALE));
    ctx.textAlign = 'start';
  }

  function drawVerticalText(ctx, text, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // --- Value conversion ---
  function tempoToBPM() {
    // Map 0-RANGE to ~60-300 BPM
    return Math.round(60 + (tempoVal / RANGE) * 240);
  }

  function staccatoRatio() {
    // Map 0-RANGE to 0.3 (very staccato) - 1.0 (legato)
    return 0.3 + (staccatoVal / RANGE) * 0.7;
  }

  // --- Mouse interaction (matches LeftClickTempo) ---
  function getSliderFromX(mouseX) {
    const midX = SW / 2;
    return mouseX < midX ? 'tempo' : 'staccato';
  }

  function yToValue(mouseY) {
    const trackTop = S_SPACING;
    const trackBot = S_SPACING + S_RANGE;
    const clamped = Math.max(trackTop, Math.min(trackBot, mouseY));
    return Math.round((RANGE - 1) * (1 - (clamped - trackTop) / (trackBot - trackTop)));
  }

  function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    dragging = getSliderFromX(x);
    updateFromMouse(y);
  }

  function handleMouseMove(e) {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    updateFromMouse(y);
  }

  function handleMouseUp() {
    dragging = null;
  }

  function updateFromMouse(y) {
    const val = yToValue(y);
    if (dragging === 'tempo') {
      tempoVal = val;
      if (onTempoChange) onTempoChange(tempoToBPM());
    } else if (dragging === 'staccato') {
      staccatoVal = val;
      if (onStaccatoChange) onStaccatoChange(staccatoRatio());
    }
    draw();
  }

  // --- Init ---
  function init(canvasId, opts = {}) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.width = SW;
    canvas.height = SH;
    ctx = canvas.getContext('2d');

    if (opts.onTempoChange) onTempoChange = opts.onTempoChange;
    if (opts.onStaccatoChange) onStaccatoChange = opts.onStaccatoChange;

    // Set initial values
    if (opts.bpm) {
      tempoVal = Math.round(((opts.bpm - 60) / 240) * RANGE);
      tempoVal = Math.max(0, Math.min(RANGE - 1, tempoVal));
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Touch support
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.touches[0];
      handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    });
    document.addEventListener('touchmove', e => {
      if (!dragging) return;
      const touch = e.touches[0];
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    });
    document.addEventListener('touchend', handleMouseUp);

    draw();
  }

  function getBPM() { return tempoToBPM(); }
  function getStaccato() { return staccatoRatio(); }
  function setBPM(bpm) {
    tempoVal = Math.round(((bpm - 60) / 240) * RANGE);
    tempoVal = Math.max(0, Math.min(RANGE - 1, tempoVal));
    draw();
  }

  return { init, draw, getBPM, getStaccato, setBPM };
})();
