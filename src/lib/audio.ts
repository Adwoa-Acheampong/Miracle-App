/**
 * Web Audio API synthesizer for Miracle: The Living House.
 * Synthesizes persistent water ambiance and short audio events.
 * Fully compliant with the 'muted until direct user gesture' policy.
 */

let audioCtx: AudioContext | null = null;
let waterNode: BiquadFilterNode | null = null;
let waterGain: GainNode | null = null;
let waterSource: AudioWorkletNode | ScriptProcessorNode | null = null;
let isMutedGlobal = true;

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

export function setMuteState(muted: boolean) {
  isMutedGlobal = muted;
  if (!muted) {
    initAudioContext();
    startWaterAmbience();
  } else {
    stopWaterAmbience();
  }
}

// Generate procedurally synthesized water ambience using white noise & lowpass filter
function startWaterAmbience() {
  if (isMutedGlobal || !audioCtx) return;

  try {
    if (waterSource) return; // Already running

    // Fallback noise generator using ScriptProcessor
    const bufferSize = 4 * 1024;
    const noiseNode = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    
    // Fill buffer with white noise with a slow ocean wave modulator
    let lastOut = 0.0;
    noiseNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      const time = audioCtx ? audioCtx.currentTime : 0;
      // Slow ocean wave modulation (0.1 Hz)
      const waveMod = Math.sin(time * 2 * Math.PI * 0.08) * 0.35 + 0.65;
      
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Simple low-pass filter formula for warmth
        lastOut = 0.95 * lastOut + 0.05 * white;
        output[i] = lastOut * waveMod * 0.022; // very quiet
      }
    };

    waterGain = audioCtx.createGain();
    waterGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    // Smooth fade-in of the water ambiance
    waterGain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 3.0);

    waterNode = audioCtx.createBiquadFilter();
    waterNode.type = "lowpass";
    waterNode.frequency.setValueAtTime(450, audioCtx.currentTime);

    noiseNode.connect(waterNode);
    waterNode.connect(waterGain);
    waterGain.connect(audioCtx.destination);

    waterSource = noiseNode;
  } catch (err) {
    console.warn("Could not start synthesized water ambience:", err);
  }
}

function stopWaterAmbience() {
  if (waterGain && audioCtx) {
    try {
      waterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      waterGain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 0.5);
      setTimeout(() => {
        if (waterSource) {
          waterSource.disconnect();
          waterSource = null;
        }
        if (waterNode) {
          waterNode.disconnect();
          waterNode = null;
        }
        if (waterGain) {
          waterGain.disconnect();
          waterGain = null;
        }
      }, 600);
    } catch (e) {
      waterSource = null;
    }
  }
}

// 1. SOUND FAMILY: ENTER/HOVER (Gentle sine swell)
export function playSoundEnter() {
  if (isMutedGlobal) return;
  initAudioContext();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(330, audioCtx.currentTime); // E4 note
  osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.15); // A4 note

  gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.25);
}

// 2. SOUND FAMILY: CONFIRM (Harmonious major chord)
export function playSoundConfirm() {
  if (isMutedGlobal) return;
  initAudioContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 (C Major)

  notes.forEach((freq, idx) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();

    osc.type = "triangle"; // softer timbre
    osc.frequency.setValueAtTime(freq, now + idx * 0.02); // slight arpeggiation/strum

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05 + idx * 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx!.destination);

    osc.start(now + idx * 0.02);
    osc.stop(now + 0.45);
  });
}

// 3. SOUND FAMILY: REWARD (Sparkling scale of wisdom)
export function playSoundReward() {
  if (isMutedGlobal) return;
  initAudioContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  // Rising pentatonic sparkling arpeggio
  const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]; // C5, D5, E5, G5, A5, C6

  scale.forEach((freq, index) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();

    // Use sine with high frequency for a crystalline bell chime
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + index * 0.08);

    gain.gain.setValueAtTime(0.0, now + index * 0.08);
    gain.gain.linearRampToValueAtTime(0.12, now + index * 0.08 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.35);

    // Simple delay resonance feedback effect simulated with high notes
    osc.connect(gain);
    gain.connect(audioCtx!.destination);

    osc.start(now + index * 0.08);
    osc.stop(now + index * 0.08 + 0.4);
  });
}

// 4. SOUND FAMILY: ERROR (Low, detuned dull tone)
export function playSoundError() {
  if (isMutedGlobal) return;
  initAudioContext();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.2);

  // Filter to make it dull/soft
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(150, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.25);
}
