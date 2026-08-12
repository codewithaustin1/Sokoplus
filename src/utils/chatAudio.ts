// Utility for Chat Assistant Audio Cues (Send & Receive)
const CHAT_SOUNDS_KEY = "sokoplus_chat_sounds_enabled";

export function getChatSoundsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(CHAT_SOUNDS_KEY);
  return stored === null ? true : stored === "true";
}

export function setChatSoundsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_SOUNDS_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("chat-sounds-changed", { detail: enabled }));
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a crisp ascending chime when sending a message
 */
export function playSendMessageSound() {
  if (!getChatSoundsEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Crisp ascending frequency bend (600Hz -> 920Hz)
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {
    console.warn("Could not play send message audio cue:", e);
  }
}

/**
 * Play a warm dual-tone harmonic chime when receiving a message
 */
export function playReceiveMessageSound() {
  if (!getChatSoundsEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // First note (C5 - 523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second note (E5 - 659.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.07);
    gain2.gain.setValueAtTime(0.15, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.22);
  } catch (e) {
    console.warn("Could not play receive message audio cue:", e);
  }
}
