// Minimal Web Audio API sound system for UI feedback
// All sounds are procedurally generated — no external files needed

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Subtle chime — agent claims a task */
export function playClaimChime() {
  try {
    const ac = getCtx();
    const now = ac.currentTime;

    // Two-note ascending chime (C5 → E5)
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.4);
    });
  } catch { /* audio not available */ }
}

/** Soft pulse — Hivemind spawns sub-agents */
export function playSpawnPulse() {
  try {
    const ac = getCtx();
    const now = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.3);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch { /* audio not available */ }
}

/** Confirmation tone — successful drag-and-drop */
export function playDropConfirm() {
  try {
    const ac = getCtx();
    const now = ac.currentTime;

    // Quick three-note confirmation (G4 → B4 → D5)
    [392, 493.88, 587.33].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = now + i * 0.06;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch { /* audio not available */ }
}
