// Small, guarded side-effects for Drive mode: a beep, a vibration, and a
// screen wake-lock. All no-op safely when the API is unavailable.

let audioCtx: AudioContext | null = null;

/** Prime the AudioContext during a user gesture (drive toggle) so beeps work. */
export function primeAudio() {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor && !audioCtx) audioCtx = new Ctor();
    audioCtx?.resume();
  } catch {
    /* audio unavailable */
  }
}

/** Short two-tone alert beep. */
export function beep() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.32);
  } catch {
    /* ignore */
  }
}

export function vibrate(pattern: number | number[] = [250, 80, 250]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock() {
  try {
    wakeLock = (await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } }).wakeLock?.request("screen")) ?? null;
  } catch {
    /* screen may still sleep */
  }
}

export function releaseWakeLock() {
  try {
    wakeLock?.release();
    wakeLock = null;
  } catch {
    /* ignore */
  }
}
