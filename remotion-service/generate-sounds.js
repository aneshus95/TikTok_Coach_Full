#!/usr/bin/env node
/**
 * generate-sounds.js
 *
 * Generates synthetic sound effects as WAV files (saved as .mp3 extension for compatibility)
 * using pure Node.js Buffer operations. No external dependencies required.
 *
 * If ffmpeg is available, it will use ffmpeg for higher-quality generation.
 * Otherwise, it falls back to pure WAV generation.
 *
 * Usage: node generate-sounds.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SOUNDS_DIR = path.join(__dirname, 'public', 'sounds');
const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

// ============================================================
// WAV GENERATION HELPERS (pure Node.js, zero dependencies)
// ============================================================

/**
 * Creates a WAV file buffer from raw PCM float samples (-1.0 to 1.0)
 */
function createWav(samples) {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const dataSize = numSamples * (BITS_PER_SAMPLE / 8);
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);           // Sub-chunk size
  buffer.writeUInt16LE(1, 20);            // PCM format
  buffer.writeUInt16LE(NUM_CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write PCM samples
  for (let i = 0; i < numSamples; i++) {
    let sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = Math.round(sample * 32767);
    buffer.writeInt16LE(intSample, headerSize + i * 2);
  }

  return buffer;
}

/**
 * Generate sine wave samples
 */
function sine(freq, duration, amplitude = 0.7) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] = amplitude * Math.sin(2 * Math.PI * freq * t);
  }
  return samples;
}

/**
 * Generate frequency-swept sine wave
 */
function sweep(startFreq, endFreq, duration, amplitude = 0.7) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const freq = startFreq + (endFreq - startFreq) * (t / duration);
    samples[i] = amplitude * Math.sin(2 * Math.PI * freq * t);
  }
  return samples;
}

/**
 * Generate white noise
 */
function whiteNoise(duration, amplitude = 0.5) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = amplitude * (Math.random() * 2 - 1);
  }
  return samples;
}

/**
 * Generate pink noise (approximation using Paul Kellet's method)
 */
function pinkNoise(duration, amplitude = 0.5) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < numSamples; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    samples[i] = amplitude * pink;
  }
  return samples;
}

/**
 * Generate brown noise (random walk)
 */
function brownNoise(duration, amplitude = 0.5) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  let last = 0;
  for (let i = 0; i < numSamples; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    samples[i] = amplitude * last * 3.5;
  }
  return samples;
}

/**
 * Apply exponential decay envelope
 */
function applyDecay(samples, decayRate = 5) {
  const result = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    result[i] = samples[i] * Math.exp(-decayRate * t);
  }
  return result;
}

/**
 * Apply fade in/out
 */
function applyFade(samples, fadeInDuration = 0.02, fadeOutDuration = 0.1) {
  const result = new Float64Array(samples);
  const fadeInSamples = Math.floor(SAMPLE_RATE * fadeInDuration);
  const fadeOutSamples = Math.floor(SAMPLE_RATE * fadeOutDuration);

  for (let i = 0; i < fadeInSamples && i < result.length; i++) {
    result[i] *= i / fadeInSamples;
  }
  for (let i = 0; i < fadeOutSamples && i < result.length; i++) {
    const idx = result.length - 1 - i;
    result[idx] *= i / fadeOutSamples;
  }
  return result;
}

/**
 * Apply tremolo (amplitude modulation)
 */
function applyTremolo(samples, rate = 5, depth = 0.5) {
  const result = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const mod = 1 - depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * rate * t));
    result[i] = samples[i] * mod;
  }
  return result;
}

/**
 * Apply vibrato (frequency modulation) - approximated
 */
function applyVibrato(samples, rate = 5, depth = 0.3) {
  const result = new Float64Array(samples.length);
  const maxDelay = Math.floor(depth * SAMPLE_RATE * 0.005);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const delay = Math.floor(maxDelay * (0.5 + 0.5 * Math.sin(2 * Math.PI * rate * t)));
    const srcIdx = i - delay;
    result[i] = srcIdx >= 0 ? samples[srcIdx] : 0;
  }
  return result;
}

/**
 * Simple lowpass filter (one-pole)
 */
function lowpass(samples, cutoff) {
  const result = new Float64Array(samples.length);
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  result[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    result[i] = result[i - 1] + alpha * (samples[i] - result[i - 1]);
  }
  return result;
}

/**
 * Simple highpass filter (one-pole)
 */
function highpass(samples, cutoff) {
  const result = new Float64Array(samples.length);
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SAMPLE_RATE;
  const alpha = rc / (rc + dt);
  result[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    result[i] = alpha * (result[i - 1] + samples[i] - samples[i - 1]);
  }
  return result;
}

/**
 * Bandpass filter (highpass + lowpass)
 */
function bandpass(samples, low, high) {
  return lowpass(highpass(samples, low), high);
}

/**
 * Mix multiple sample arrays together
 */
function mix(...arrays) {
  const maxLen = Math.max(...arrays.map(a => a.length));
  const result = new Float64Array(maxLen);
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) {
      result[i] += arr[i];
    }
  }
  // Normalize to prevent clipping
  let max = 0;
  for (let i = 0; i < result.length; i++) {
    max = Math.max(max, Math.abs(result[i]));
  }
  if (max > 1) {
    for (let i = 0; i < result.length; i++) {
      result[i] /= max;
    }
  }
  return result;
}

/**
 * Concatenate sample arrays
 */
function concat(...arrays) {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Float64Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Scale amplitude
 */
function scale(samples, factor) {
  const result = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = samples[i] * factor;
  }
  return result;
}

/**
 * Repeated envelope bursts for rhythmic sounds
 */
function repeatedBursts(freq, burstDuration, gapDuration, count, amplitude = 0.7) {
  const arrays = [];
  for (let c = 0; c < count; c++) {
    const burst = applyDecay(sine(freq, burstDuration, amplitude), 15);
    const gap = new Float64Array(Math.floor(SAMPLE_RATE * gapDuration));
    arrays.push(burst, gap);
  }
  return concat(...arrays);
}

/**
 * Decaying sine with specific parameters
 */
function decayingSine(freq, duration, decayRate = 10, amplitude = 0.7) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] = amplitude * Math.sin(2 * Math.PI * freq * t) * Math.exp(-decayRate * t);
  }
  return samples;
}

/**
 * FM synthesis: carrier modulated by modulator
 */
function fmSynth(carrierFreq, modFreq, modDepth, duration, amplitude = 0.7) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const modulator = modDepth * Math.sin(2 * Math.PI * modFreq * t);
    samples[i] = amplitude * Math.sin(2 * Math.PI * (carrierFreq + modulator) * t);
  }
  return samples;
}

/**
 * Heartbeat pattern: two quick thuds per beat
 */
function heartbeat(duration) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  const beatPeriod = 0.8; // seconds per beat
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const beatPhase = t % beatPeriod;
    // Two thuds: one at 0, one at 0.15s
    let env = 0;
    if (beatPhase < 0.08) {
      env = Math.exp(-30 * beatPhase);
    } else if (beatPhase > 0.12 && beatPhase < 0.2) {
      env = 0.7 * Math.exp(-30 * (beatPhase - 0.12));
    }
    samples[i] = 0.8 * Math.sin(2 * Math.PI * 60 * t) * env;
  }
  return samples;
}

// ============================================================
// SOUND DEFINITIONS (Pure Node.js generators)
// ============================================================

const soundGenerators = {
  // ==================== BODY ====================
  'body/fart.mp3': () => {
    let s = sine(80, 0.6, 0.7);
    s = applyVibrato(s, 8, 1);
    s = applyTremolo(s, 12, 0.8);
    return applyFade(s, 0.05, 0.3);
  },
  'body/burp.mp3': () => {
    let s = sine(120, 0.5, 0.7);
    s = applyVibrato(s, 15, 1);
    s = applyTremolo(s, 6, 0.9);
    return applyFade(s, 0.02, 0.3);
  },
  'body/sneeze.mp3': () => {
    let s = whiteNoise(0.4, 0.5);
    s = highpass(s, 800);
    s = lowpass(s, 6000);
    return applyFade(s, 0.02, 0.25);
  },
  'body/cough.mp3': () => {
    let s = pinkNoise(0.6, 0.6);
    s = applyTremolo(s, 20, 0.9);
    s = highpass(s, 200);
    s = lowpass(s, 4000);
    return applyFade(s, 0.01, 0.3);
  },
  'body/hiccup.mp3': () => {
    let s = sine(450, 0.1, 0.7);
    return applyFade(s, 0.005, 0.05);
  },
  'body/kiss.mp3': () => {
    let s = sine(1200, 0.15, 0.6);
    s = lowpass(s, 3000);
    return applyFade(s, 0.01, 0.1);
  },
  'body/heartbeat.mp3': () => {
    let s = heartbeat(2.4);
    s = lowpass(s, 200);
    return applyFade(s, 0.05, 0.3);
  },
  'body/slap.mp3': () => {
    let s = whiteNoise(0.2, 0.8);
    s = highpass(s, 500);
    s = lowpass(s, 8000);
    return applyFade(s, 0.001, 0.15);
  },
  'body/yawn.mp3': () => {
    let s = sweep(200, 350, 0.6, 0.5);
    let s2 = sweep(350, 180, 0.9, 0.5);
    let combined = concat(s, s2);
    combined = applyVibrato(combined, 3, 0.3);
    return applyFade(combined, 0.3, 0.4);
  },

  // ==================== IMPACTS ====================
  'impacts/explosion.mp3': () => {
    let s = brownNoise(2, 0.9);
    s = lowpass(s, 400);
    s = applyTremolo(s, 4, 0.7);
    s = scale(s, 2);
    return applyFade(s, 0.01, 1.5);
  },
  'impacts/crash.mp3': () => {
    let s = whiteNoise(1.5, 0.8);
    s = bandpass(s, 1000, 5000);
    s = applyTremolo(s, 15, 0.5);
    return applyFade(s, 0.005, 1.2);
  },
  'impacts/punch.mp3': () => {
    let s = decayingSine(80, 0.5, 15, 0.9);
    s = lowpass(s, 500);
    return applyFade(s, 0.001, 0.2);
  },
  'impacts/slam.mp3': () => {
    let s = decayingSine(100, 0.6, 12, 0.9);
    s = lowpass(s, 600);
    return applyFade(s, 0.001, 0.3);
  },
  'impacts/glass-break.mp3': () => {
    let s = whiteNoise(1, 0.7);
    s = highpass(s, 3000);
    s = applyTremolo(s, 30, 0.8);
    return applyFade(s, 0.002, 0.8);
  },
  'impacts/thud.mp3': () => {
    let s = decayingSine(50, 0.4, 20, 0.9);
    s = lowpass(s, 300);
    return scale(s, 1.5);
  },
  'impacts/smash.mp3': () => {
    let s = pinkNoise(1.2, 0.9);
    s = bandpass(s, 500, 4500);
    s = applyTremolo(s, 20, 0.6);
    return applyFade(s, 0.003, 0.9);
  },
  'impacts/hit-metal.mp3': () => {
    const s1 = decayingSine(800, 1, 5, 0.5);
    const s2 = decayingSine(1200, 1, 7, 0.4);
    const s3 = decayingSine(2400, 1, 10, 0.2);
    return applyFade(mix(s1, s2, s3), 0.001, 0.5);
  },
  'impacts/hit-wood.mp3': () => {
    let s = decayingSine(200, 0.4, 18, 0.8);
    s = lowpass(s, 2000);
    s = highpass(s, 100);
    return scale(s, 1.5);
  },

  // ==================== NATURE ====================
  'nature/thunder.mp3': () => {
    let s = brownNoise(3, 0.7);
    s = lowpass(s, 300);
    s = applyTremolo(s, 2, 0.8);
    s = scale(s, 1.5);
    return applyFade(s, 0.5, 1.5);
  },
  'nature/rain-loop.mp3': () => {
    let s = pinkNoise(3, 0.3);
    s = highpass(s, 1000);
    s = lowpass(s, 8000);
    s = applyTremolo(s, 0.5, 0.2);
    return applyFade(s, 0.3, 0.5);
  },
  'nature/wind.mp3': () => {
    let s = pinkNoise(3, 0.4);
    s = lowpass(s, 800);
    s = applyTremolo(s, 0.3, 0.6);
    return applyFade(s, 0.5, 1.0);
  },
  'nature/ocean-waves.mp3': () => {
    let s = pinkNoise(3, 0.5);
    s = lowpass(s, 600);
    s = applyTremolo(s, 0.15, 0.9);
    return applyFade(s, 0.5, 1.0);
  },
  'nature/birds.mp3': () => {
    let s = fmSynth(2000, 8, 500, 2, 0.3);
    const numSamples = s.length;
    // Add rhythmic pulsing like chirps
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      s[i] *= Math.exp(-3 * (t % 0.3));
    }
    s = highpass(s, 1500);
    return applyFade(s, 0.1, 0.5);
  },
  'nature/crickets.mp3': () => {
    const numSamples = Math.floor(SAMPLE_RATE * 3);
    const samples = new Float64Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      samples[i] = 0.3 * Math.sin(2 * Math.PI * 4500 * t) *
        (0.5 + 0.5 * Math.sin(2 * Math.PI * 15 * t));
    }
    let s = highpass(samples, 3000);
    return applyFade(s, 0.2, 0.5);
  },
  'nature/storm.mp3': () => {
    let s = brownNoise(3, 0.6);
    s = lowpass(s, 500);
    s = applyTremolo(s, 1, 0.7);
    s = applyVibrato(s, 0.5, 0.3);
    s = scale(s, 1.5);
    return applyFade(s, 0.3, 1.0);
  },
  'nature/waterfall.mp3': () => {
    let s = whiteNoise(3, 0.4);
    s = lowpass(s, 3000);
    s = highpass(s, 200);
    s = applyTremolo(s, 0.2, 0.3);
    return applyFade(s, 0.5, 1.0);
  },

  // ==================== TRANSITIONS ====================
  'transitions/whoosh.mp3': () => {
    let s = pinkNoise(0.6, 0.6);
    s = highpass(s, 500);
    s = lowpass(s, 6000);
    return applyFade(s, 0.05, 0.4);
  },
  'transitions/swoosh.mp3': () => {
    let s = pinkNoise(0.5, 0.5);
    s = bandpass(s, 500, 5000);
    return applyFade(s, 0.02, 0.35);
  },
  'transitions/bass-drop.mp3': () => {
    let s = sweep(200, 20, 1.5, 0.8);
    s = lowpass(s, 300);
    s = scale(s, 2);
    return applyFade(s, 0.01, 0.7);
  },
  'transitions/riser.mp3': () => {
    let s = sweep(200, 2200, 2, 0.5);
    s = scale(s, 1.5);
    return applyFade(s, 0.1, 0.3);
  },
  'transitions/reverse-cymbal.mp3': () => {
    let s = whiteNoise(2, 0.6);
    s = highpass(s, 5000);
    // Reverse envelope: fade in slowly, cut off sharply
    const result = new Float64Array(s.length);
    for (let i = 0; i < s.length; i++) {
      const t = i / s.length;
      result[i] = s[i] * Math.pow(t, 3); // cubic fade in
    }
    return applyFade(result, 0.01, 0.05);
  },
  'transitions/transition-hit.mp3': () => {
    let s = decayingSine(60, 0.8, 8, 0.9);
    s = lowpass(s, 400);
    s = scale(s, 2);
    return applyFade(s, 0.001, 0.3);
  },
  'transitions/swipe.mp3': () => {
    let s = pinkNoise(0.3, 0.5);
    s = bandpass(s, 1000, 5000);
    return applyFade(s, 0.01, 0.2);
  },
  'transitions/zip.mp3': () => {
    let s = sweep(500, 4500, 0.3, 0.5);
    s = highpass(s, 1000);
    return applyFade(s, 0.01, 0.15);
  },

  // ==================== REACTIONS ====================
  'reactions/applause.mp3': () => {
    let s = pinkNoise(2.5, 0.5);
    s = applyTremolo(s, 12, 0.6);
    s = highpass(s, 1000);
    s = lowpass(s, 8000);
    return applyFade(s, 0.3, 1.0);
  },
  'reactions/laughter.mp3': () => {
    const numSamples = Math.floor(SAMPLE_RATE * 2);
    const samples = new Float64Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      samples[i] = 0.4 * Math.sin(2 * Math.PI * 300 * t) *
        (1 + Math.sin(2 * Math.PI * 6 * t));
    }
    let s = applyTremolo(samples, 8, 0.7);
    s = lowpass(s, 3000);
    return applyFade(s, 0.1, 0.7);
  },
  'reactions/crowd-gasp.mp3': () => {
    let s = pinkNoise(1.5, 0.4);
    s = bandpass(s, 300, 1800);
    s = applyTremolo(s, 3, 0.4);
    return applyFade(s, 0.05, 1.0);
  },
  'reactions/boo.mp3': () => {
    let s = sine(180, 2, 0.5);
    s = applyVibrato(s, 3, 0.5);
    s = applyTremolo(s, 2, 0.4);
    s = lowpass(s, 800);
    return applyFade(s, 0.2, 0.8);
  },
  'reactions/cheering.mp3': () => {
    let s = pinkNoise(2.5, 0.6);
    s = applyTremolo(s, 8, 0.5);
    s = highpass(s, 800);
    s = lowpass(s, 6000);
    s = scale(s, 1.3);
    return applyFade(s, 0.2, 1.0);
  },
  'reactions/ooh.mp3': () => {
    let s = sine(400, 1.5, 0.4);
    s = applyVibrato(s, 4, 0.3);
    s = lowpass(s, 1500);
    return applyFade(s, 0.1, 0.7);
  },
  'reactions/aww.mp3': () => {
    let s = sine(350, 1.5, 0.4);
    s = applyVibrato(s, 3, 0.4);
    s = lowpass(s, 1200);
    return applyFade(s, 0.15, 0.7);
  },
  'reactions/crowd-cheer.mp3': () => {
    let s = pinkNoise(3, 0.7);
    s = applyTremolo(s, 10, 0.6);
    s = highpass(s, 600);
    s = lowpass(s, 7000);
    s = scale(s, 1.5);
    return applyFade(s, 0.1, 1.2);
  },

  // ==================== ANIMALS ====================
  'animals/dog-bark.mp3': () => {
    // Two barks
    const bark1 = applyFade(decayingSine(400, 0.15, 15, 0.7), 0.005, 0.05);
    const gap = new Float64Array(Math.floor(SAMPLE_RATE * 0.2));
    const bark2 = applyFade(decayingSine(450, 0.15, 15, 0.8), 0.005, 0.05);
    let s = concat(bark1, gap, bark2);
    s = highpass(s, 200);
    s = lowpass(s, 3000);
    return scale(s, 1.5);
  },
  'animals/cat-meow.mp3': () => {
    let s = fmSynth(600, 2, 200, 1, 0.5);
    s = lowpass(s, 4000);
    return applyFade(s, 0.05, 0.5);
  },
  'animals/roar.mp3': () => {
    let s = brownNoise(2, 0.8);
    s = lowpass(s, 500);
    s = applyTremolo(s, 5, 0.8);
    s = scale(s, 2);
    return applyFade(s, 0.1, 1.0);
  },
  'animals/horse-neigh.mp3': () => {
    let s = fmSynth(800, 5, 400, 1.5, 0.5);
    s = applyVibrato(s, 8, 0.5);
    return applyFade(s, 0.05, 0.7);
  },
  'animals/duck-quack.mp3': () => {
    // Three quick quacks
    const quacks = [];
    for (let q = 0; q < 3; q++) {
      const quack = applyFade(decayingSine(600, 0.1, 20, 0.6), 0.005, 0.03);
      const gap = new Float64Array(Math.floor(SAMPLE_RATE * 0.15));
      quacks.push(quack, gap);
    }
    let s = concat(...quacks);
    s = bandpass(s, 400, 1400);
    return scale(s, 1.5);
  },
  'animals/elephant.mp3': () => {
    let s = fmSynth(300, 3, 100, 2, 0.7);
    s = applyVibrato(s, 6, 0.7);
    s = scale(s, 1.5);
    return applyFade(s, 0.1, 1.0);
  },
  'animals/monkey.mp3': () => {
    // Chattering high-pitched calls
    const calls = [];
    for (let c = 0; c < 6; c++) {
      const call = applyFade(decayingSine(1200 + c * 100, 0.08, 20, 0.5), 0.003, 0.02);
      const gap = new Float64Array(Math.floor(SAMPLE_RATE * 0.1));
      calls.push(call, gap);
    }
    let s = concat(...calls);
    s = highpass(s, 600);
    return applyVibrato(s, 10, 0.6);
  },
  'animals/wolf-howl.mp3': () => {
    let s = fmSynth(300, 0.5, 150, 3, 0.6);
    s = applyVibrato(s, 4, 0.3);
    s = lowpass(s, 2000);
    return applyFade(s, 0.3, 1.0);
  },

  // ==================== MUSICAL ====================
  'musical/drum-roll.mp3': () => {
    let s = pinkNoise(2, 0.5);
    s = applyTremolo(s, 20, 0.8);
    s = lowpass(s, 3000);
    s = highpass(s, 100);
    s = scale(s, 1.5);
    // Crescendo envelope
    const result = new Float64Array(s.length);
    for (let i = 0; i < s.length; i++) {
      result[i] = s[i] * Math.pow(i / s.length, 0.5);
    }
    return applyFade(result, 0.1, 0.1);
  },
  'musical/rimshot.mp3': () => {
    // Ba-dum-tss: two low hits + crash
    const hit1 = decayingSine(200, 0.12, 20, 0.7);
    const gap1 = new Float64Array(Math.floor(SAMPLE_RATE * 0.08));
    const hit2 = decayingSine(180, 0.12, 20, 0.7);
    const gap2 = new Float64Array(Math.floor(SAMPLE_RATE * 0.08));
    let crash = whiteNoise(0.3, 0.4);
    crash = highpass(crash, 3000);
    crash = applyFade(crash, 0.001, 0.25);
    return concat(hit1, gap1, hit2, gap2, crash);
  },
  'musical/sad-trombone.mp3': () => {
    // Descending wah-wah-wah-wahhhh
    const note1 = applyFade(sine(370, 0.35, 0.6), 0.02, 0.05);
    const note2 = applyFade(sine(349, 0.35, 0.6), 0.02, 0.05);
    const note3 = applyFade(sine(330, 0.35, 0.6), 0.02, 0.05);
    let note4 = sine(311, 0.8, 0.6);
    note4 = applyVibrato(note4, 5, 0.5);
    note4 = applyFade(note4, 0.02, 0.5);
    let s = concat(note1, note2, note3, note4);
    s = lowpass(s, 2000);
    return s;
  },
  'musical/fanfare.mp3': () => {
    // C-E-G chord (triumphant)
    const c = sine(523, 1.5, 0.35);
    const e = sine(659, 1.5, 0.3);
    const g = sine(784, 1.5, 0.25);
    let s = mix(c, e, g);
    s = scale(s, 1.3);
    return applyFade(s, 0.05, 0.7);
  },
  'musical/piano-hit.mp3': () => {
    // A4 note with harmonics and decay
    const fund = decayingSine(440, 1.5, 3, 0.5);
    const h2 = decayingSine(880, 1.5, 4, 0.25);
    const h3 = decayingSine(1320, 1.5, 6, 0.1);
    let s = mix(fund, h2, h3);
    s = scale(s, 1.5);
    return applyFade(s, 0.001, 0.5);
  },
  'musical/guitar-strum.mp3': () => {
    // E-A-D chord with slight strum delay and decay
    const e = decayingSine(330, 1.5, 4, 0.35);
    const a = decayingSine(440, 1.5, 4, 0.35);
    const d = decayingSine(550, 1.5, 4, 0.3);
    let s = mix(e, a, d);
    s = applyTremolo(s, 6, 0.2);
    s = scale(s, 1.5);
    return applyFade(s, 0.005, 0.8);
  },
  'musical/vinyl-scratch.mp3': () => {
    let s = whiteNoise(0.5, 0.6);
    s = bandpass(s, 200, 6000);
    // Apply pitch-wobble effect
    const result = new Float64Array(s.length);
    for (let i = 0; i < s.length; i++) {
      const t = i / SAMPLE_RATE;
      const wobble = Math.sin(2 * Math.PI * 3 * t) * SAMPLE_RATE * 0.01;
      const srcIdx = Math.max(0, Math.min(s.length - 1, Math.round(i + wobble)));
      result[i] = s[srcIdx];
    }
    return applyFade(result, 0.01, 0.2);
  },

  // ==================== UI ====================
  'ui/click.mp3': () => {
    let s = sine(1000, 0.05, 0.7);
    return applyFade(s, 0.002, 0.03);
  },
  'ui/ding.mp3': () => {
    let s = decayingSine(880, 0.5, 4, 0.7);
    return applyFade(s, 0.01, 0.3);
  },
  'ui/beep.mp3': () => {
    let s = sine(440, 0.3, 0.6);
    return applyFade(s, 0.01, 0.15);
  },
  'ui/notification.mp3': () => {
    // Two ascending tones
    const tone1 = applyFade(sine(800, 0.12, 0.5), 0.01, 0.02);
    const gap = new Float64Array(Math.floor(SAMPLE_RATE * 0.05));
    const tone2 = applyFade(sine(1000, 0.12, 0.5), 0.01, 0.02);
    return concat(tone1, gap, tone2);
  },
  'ui/error-buzz.mp3': () => {
    let s = sine(150, 0.5, 0.6);
    s = applyTremolo(s, 25, 0.9);
    return applyFade(s, 0.01, 0.15);
  },
  'ui/success-chime.mp3': () => {
    // Three ascending notes: C5, E5, G5
    const c = applyFade(sine(523, 0.15, 0.5), 0.01, 0.03);
    const gap1 = new Float64Array(Math.floor(SAMPLE_RATE * 0.03));
    const e = applyFade(sine(659, 0.15, 0.5), 0.01, 0.03);
    const gap2 = new Float64Array(Math.floor(SAMPLE_RATE * 0.03));
    const g = applyFade(sine(784, 0.3, 0.5), 0.01, 0.15);
    return concat(c, gap1, e, gap2, g);
  },
  'ui/pop.mp3': () => {
    return decayingSine(600, 0.15, 30, 0.8);
  },
  'ui/type-click.mp3': () => {
    let s = whiteNoise(0.04, 0.5);
    s = highpass(s, 2000);
    return applyFade(s, 0.001, 0.02);
  },

  // ==================== AMBIENT ====================
  'ambient/crowd-murmur.mp3': () => {
    let s = pinkNoise(3, 0.3);
    s = lowpass(s, 2000);
    s = highpass(s, 200);
    s = applyTremolo(s, 0.5, 0.3);
    return applyFade(s, 0.5, 1.0);
  },
  'ambient/traffic.mp3': () => {
    let s = brownNoise(3, 0.4);
    s = lowpass(s, 1500);
    s = applyTremolo(s, 0.2, 0.4);
    s = scale(s, 1.3);
    return applyFade(s, 0.5, 1.0);
  },
  'ambient/fire-crackle.mp3': () => {
    let s = whiteNoise(3, 0.3);
    s = applyTremolo(s, 15, 0.7);
    s = highpass(s, 1000);
    s = lowpass(s, 6000);
    return applyFade(s, 0.3, 1.0);
  },
  'ambient/underwater.mp3': () => {
    let s = brownNoise(3, 0.3);
    s = lowpass(s, 400);
    s = applyTremolo(s, 0.3, 0.5);
    s = applyVibrato(s, 1, 0.3);
    return applyFade(s, 0.5, 1.0);
  },
  'ambient/spaceship-hum.mp3': () => {
    const s1 = sine(60, 3, 0.3);
    const s2 = sine(90, 3, 0.15);
    const s3 = sine(120, 3, 0.1);
    let s = mix(s1, s2, s3);
    s = applyTremolo(s, 0.5, 0.2);
    return applyFade(s, 0.5, 1.0);
  },
  'ambient/rain-on-window.mp3': () => {
    let s = pinkNoise(3, 0.25);
    s = highpass(s, 2000);
    s = lowpass(s, 10000);
    s = applyTremolo(s, 8, 0.4);
    return applyFade(s, 0.3, 1.0);
  },
};

// ============================================================
// MAIN: Check for ffmpeg, then generate all sounds
// ============================================================

// Ensure directories exist
const categories = [
  'body', 'impacts', 'nature', 'transitions',
  'reactions', 'animals', 'musical', 'ui', 'ambient'
];

for (const cat of categories) {
  const dir = path.join(SOUNDS_DIR, cat);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// Check if ffmpeg is available
let hasFFmpeg = false;
try {
  execSync('ffmpeg -version', { stdio: 'pipe' });
  hasFFmpeg = true;
} catch (e) {
  hasFFmpeg = false;
}

// ffmpeg-based sound definitions (higher quality)
const ffmpegSounds = {
  'body/fart.mp3': `-f lavfi -i "sine=frequency=80:duration=0.6" -af "vibrato=f=8:d=1,tremolo=f=12:d=0.8,afade=t=in:d=0.05,afade=t=out:st=0.3:d=0.3" -ar 44100 -b:a 128k`,
  'body/burp.mp3': `-f lavfi -i "sine=frequency=120:duration=0.5" -af "vibrato=f=15:d=1,tremolo=f=6:d=0.9,afade=t=in:d=0.02,afade=t=out:st=0.2:d=0.3" -ar 44100 -b:a 128k`,
  'body/sneeze.mp3': `-f lavfi -i "anoisesrc=d=0.4:c=white:a=0.5" -af "afade=t=in:d=0.02,afade=t=out:st=0.15:d=0.25,highpass=f=800,lowpass=f=6000" -ar 44100 -b:a 128k`,
  'body/cough.mp3': `-f lavfi -i "anoisesrc=d=0.6:c=pink:a=0.6" -af "tremolo=f=20:d=0.9,afade=t=in:d=0.01,afade=t=out:st=0.3:d=0.3,highpass=f=200,lowpass=f=4000" -ar 44100 -b:a 128k`,
  'body/hiccup.mp3': `-f lavfi -i "sine=frequency=300:duration=0.15" -af "afade=t=in:d=0.01,afade=t=out:st=0.05:d=0.1,asetrate=44100*1.5,aresample=44100" -ar 44100 -b:a 128k`,
  'body/kiss.mp3': `-f lavfi -i "sine=frequency=1200:duration=0.15" -af "afade=t=in:d=0.01,afade=t=out:st=0.05:d=0.1,lowpass=f=3000" -ar 44100 -b:a 128k`,
  'body/heartbeat.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*60*t)*exp(-10*mod(t,0.8))':d=2.4" -af "lowpass=f=200,volume=2,afade=t=out:st=1.8:d=0.6" -ar 44100 -b:a 128k`,
  'body/slap.mp3': `-f lavfi -i "anoisesrc=d=0.2:c=white:a=0.8" -af "afade=t=in:d=0.001,afade=t=out:st=0.03:d=0.17,highpass=f=500,lowpass=f=8000" -ar 44100 -b:a 128k`,
  'body/yawn.mp3': `-f lavfi -i "sine=frequency=250:duration=1.5" -af "vibrato=f=3:d=0.3,afade=t=in:d=0.3,afade=t=out:st=0.8:d=0.7,asetrate=44100*0.8,aresample=44100" -ar 44100 -b:a 128k`,
  'impacts/explosion.mp3': `-f lavfi -i "anoisesrc=d=2:c=brown:a=0.9" -af "afade=t=in:d=0.01,afade=t=out:st=0.3:d=1.7,lowpass=f=400,volume=3,tremolo=f=4:d=0.7" -ar 44100 -b:a 128k`,
  'impacts/crash.mp3': `-f lavfi -i "anoisesrc=d=1.5:c=white:a=0.8" -af "afade=t=in:d=0.005,afade=t=out:st=0.2:d=1.3,bandpass=f=3000:w=2000,tremolo=f=15:d=0.5" -ar 44100 -b:a 128k`,
  'impacts/punch.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*80*t)*exp(-15*t)':d=0.5" -af "volume=3,lowpass=f=500,afade=t=out:st=0.2:d=0.3" -ar 44100 -b:a 128k`,
  'impacts/slam.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*100*t)*exp(-12*t)':d=0.6" -af "volume=3,lowpass=f=600,afade=t=out:st=0.2:d=0.4" -ar 44100 -b:a 128k`,
  'impacts/glass-break.mp3': `-f lavfi -i "anoisesrc=d=1:c=white:a=0.7" -af "afade=t=in:d=0.002,afade=t=out:st=0.1:d=0.9,highpass=f=3000,tremolo=f=30:d=0.8" -ar 44100 -b:a 128k`,
  'impacts/thud.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*50*t)*exp(-20*t)':d=0.4" -af "volume=4,lowpass=f=300" -ar 44100 -b:a 128k`,
  'impacts/smash.mp3': `-f lavfi -i "anoisesrc=d=1.2:c=pink:a=0.9" -af "afade=t=in:d=0.003,afade=t=out:st=0.15:d=1.0,bandpass=f=1500:w=3000,tremolo=f=20:d=0.6" -ar 44100 -b:a 128k`,
  'impacts/hit-metal.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*800*t)*exp(-5*t)+sin(2*PI*1200*t)*exp(-7*t)':d=1.0" -af "volume=2,afade=t=out:st=0.3:d=0.7" -ar 44100 -b:a 128k`,
  'impacts/hit-wood.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*200*t)*exp(-18*t)':d=0.4" -af "volume=3,lowpass=f=2000,highpass=f=100" -ar 44100 -b:a 128k`,
  'nature/thunder.mp3': `-f lavfi -i "anoisesrc=d=3:c=brown:a=0.7" -af "lowpass=f=300,tremolo=f=2:d=0.8,afade=t=in:d=0.5,afade=t=out:st=1.5:d=1.5,volume=2" -ar 44100 -b:a 128k`,
  'nature/rain-loop.mp3': `-f lavfi -i "anoisesrc=d=3:c=pink:a=0.3" -af "highpass=f=1000,lowpass=f=8000,tremolo=f=0.5:d=0.2,afade=t=in:d=0.3,afade=t=out:st=2.5:d=0.5" -ar 44100 -b:a 128k`,
  'nature/wind.mp3': `-f lavfi -i "anoisesrc=d=3:c=pink:a=0.4" -af "lowpass=f=800,tremolo=f=0.3:d=0.6,afade=t=in:d=0.5,afade=t=out:st=2.0:d=1.0" -ar 44100 -b:a 128k`,
  'nature/ocean-waves.mp3': `-f lavfi -i "anoisesrc=d=3:c=pink:a=0.5" -af "lowpass=f=600,tremolo=f=0.15:d=0.9,afade=t=in:d=0.5,afade=t=out:st=2.0:d=1.0" -ar 44100 -b:a 128k`,
  'nature/birds.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*(2000+500*sin(2*PI*8*t))*t)*exp(-3*mod(t,0.3))*0.3':d=2" -af "highpass=f=1500,afade=t=in:d=0.1,afade=t=out:st=1.5:d=0.5" -ar 44100 -b:a 128k`,
  'nature/crickets.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*4500*t)*0.3*(1+sin(2*PI*15*t))*0.5':d=3" -af "highpass=f=3000,afade=t=in:d=0.2,afade=t=out:st=2.5:d=0.5" -ar 44100 -b:a 128k`,
  'nature/storm.mp3': `-f lavfi -i "anoisesrc=d=3:c=brown:a=0.6" -af "lowpass=f=500,tremolo=f=1:d=0.7,vibrato=f=0.5:d=0.3,afade=t=in:d=0.3,afade=t=out:st=2.0:d=1.0,volume=2" -ar 44100 -b:a 128k`,
  'nature/waterfall.mp3': `-f lavfi -i "anoisesrc=d=3:c=white:a=0.4" -af "lowpass=f=3000,highpass=f=200,tremolo=f=0.2:d=0.3,afade=t=in:d=0.5,afade=t=out:st=2.0:d=1.0" -ar 44100 -b:a 128k`,
  'transitions/whoosh.mp3': `-f lavfi -i "anoisesrc=d=0.6:c=pink:a=0.6" -af "afade=t=in:d=0.05,afade=t=out:st=0.2:d=0.4,highpass=f=500,lowpass=f=6000,asetrate=44100*1.5,aresample=44100" -ar 44100 -b:a 128k`,
  'transitions/swoosh.mp3': `-f lavfi -i "anoisesrc=d=0.5:c=pink:a=0.5" -af "afade=t=in:d=0.02,afade=t=out:st=0.15:d=0.35,bandpass=f=2000:w=3000" -ar 44100 -b:a 128k`,
  'transitions/bass-drop.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*(200-180*t/1.5)*t)*0.8':d=1.5" -af "lowpass=f=300,volume=3,afade=t=in:d=0.01,afade=t=out:st=0.8:d=0.7" -ar 44100 -b:a 128k`,
  'transitions/riser.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*(200+2000*t/2)*t)*0.5':d=2" -af "afade=t=in:d=0.1,afade=t=out:st=1.7:d=0.3,volume=2" -ar 44100 -b:a 128k`,
  'transitions/reverse-cymbal.mp3': `-f lavfi -i "anoisesrc=d=2:c=white:a=0.6" -af "highpass=f=5000,afade=t=in:d=1.5,afade=t=out:st=1.8:d=0.2,volume=2" -ar 44100 -b:a 128k`,
  'transitions/transition-hit.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*60*t)*exp(-8*t)':d=0.8" -af "volume=4,lowpass=f=400,afade=t=out:st=0.3:d=0.5" -ar 44100 -b:a 128k`,
  'transitions/swipe.mp3': `-f lavfi -i "anoisesrc=d=0.3:c=pink:a=0.5" -af "afade=t=in:d=0.01,afade=t=out:st=0.1:d=0.2,bandpass=f=3000:w=2000,asetrate=44100*2,aresample=44100" -ar 44100 -b:a 128k`,
  'transitions/zip.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*(500+4000*t/0.3)*t)*0.4':d=0.3" -af "afade=t=in:d=0.01,afade=t=out:st=0.1:d=0.2,highpass=f=1000" -ar 44100 -b:a 128k`,
  'reactions/applause.mp3': `-f lavfi -i "anoisesrc=d=2.5:c=pink:a=0.5" -af "tremolo=f=12:d=0.6,highpass=f=1000,lowpass=f=8000,afade=t=in:d=0.3,afade=t=out:st=1.5:d=1.0" -ar 44100 -b:a 128k`,
  'reactions/laughter.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*300*t)*0.4*(1+sin(2*PI*6*t))':d=2" -af "tremolo=f=8:d=0.7,afade=t=in:d=0.1,afade=t=out:st=1.3:d=0.7,lowpass=f=3000" -ar 44100 -b:a 128k`,
  'reactions/crowd-gasp.mp3': `-f lavfi -i "anoisesrc=d=1.5:c=pink:a=0.4" -af "afade=t=in:d=0.05,afade=t=out:st=0.5:d=1.0,bandpass=f=800:w=1000,tremolo=f=3:d=0.4" -ar 44100 -b:a 128k`,
  'reactions/boo.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*180*t)*0.5':d=2" -af "vibrato=f=3:d=0.5,tremolo=f=2:d=0.4,afade=t=in:d=0.2,afade=t=out:st=1.2:d=0.8,lowpass=f=800" -ar 44100 -b:a 128k`,
  'reactions/cheering.mp3': `-f lavfi -i "anoisesrc=d=2.5:c=pink:a=0.6" -af "tremolo=f=8:d=0.5,highpass=f=800,lowpass=f=6000,afade=t=in:d=0.2,afade=t=out:st=1.5:d=1.0,volume=1.5" -ar 44100 -b:a 128k`,
  'reactions/ooh.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*400*t)*0.4':d=1.5" -af "vibrato=f=4:d=0.3,afade=t=in:d=0.1,afade=t=out:st=0.8:d=0.7,lowpass=f=1500" -ar 44100 -b:a 128k`,
  'reactions/aww.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*350*t)*0.4':d=1.5" -af "vibrato=f=3:d=0.4,afade=t=in:d=0.15,afade=t=out:st=0.8:d=0.7,lowpass=f=1200" -ar 44100 -b:a 128k`,
  'reactions/crowd-cheer.mp3': `-f lavfi -i "anoisesrc=d=3:c=pink:a=0.7" -af "tremolo=f=10:d=0.6,highpass=f=600,lowpass=f=7000,afade=t=in:d=0.1,afade=t=out:st=1.8:d=1.2,volume=1.8" -ar 44100 -b:a 128k`,
  'animals/dog-bark.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*400*t)*exp(-8*mod(t,0.4))*0.7':d=1.2" -af "highpass=f=200,lowpass=f=3000,volume=2,afade=t=out:st=0.8:d=0.4" -ar 44100 -b:a 128k`,
  'animals/cat-meow.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*(600+200*sin(2*PI*2*t))*t)*0.5':d=1" -af "afade=t=in:d=0.05,afade=t=out:st=0.5:d=0.5,lowpass=f=4000" -ar 44100 -b:a 128k`,
  'animals/roar.mp3': `-f lavfi -i "anoisesrc=d=2:c=brown:a=0.8" -af "lowpass=f=500,tremolo=f=5:d=0.8,afade=t=in:d=0.1,afade=t=out:st=0.8:d=1.2,volume=3" -ar 44100 -b:a 128k`,
  'animals/horse-neigh.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*(800+400*sin(2*PI*5*t))*t)*0.5':d=1.5" -af "afade=t=in:d=0.05,afade=t=out:st=0.8:d=0.7,vibrato=f=8:d=0.5" -ar 44100 -b:a 128k`,
  'animals/duck-quack.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*600*t)*exp(-15*mod(t,0.35))*0.6':d=1" -af "bandpass=f=800:w=600,volume=2,afade=t=out:st=0.7:d=0.3" -ar 44100 -b:a 128k`,
  'animals/elephant.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*(300+100*sin(2*PI*3*t))*t)*0.7':d=2" -af "vibrato=f=6:d=0.7,afade=t=in:d=0.1,afade=t=out:st=1.0:d=1.0,volume=2" -ar 44100 -b:a 128k`,
  'animals/monkey.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*1200*t)*exp(-12*mod(t,0.2))*0.5':d=1.5" -af "highpass=f=600,vibrato=f=10:d=0.6,afade=t=out:st=1.0:d=0.5" -ar 44100 -b:a 128k`,
  'animals/wolf-howl.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*(300+150*sin(2*PI*0.5*t))*t)*0.6':d=3" -af "afade=t=in:d=0.3,afade=t=out:st=2.0:d=1.0,vibrato=f=4:d=0.3,lowpass=f=2000" -ar 44100 -b:a 128k`,
  'musical/drum-roll.mp3': `-f lavfi -i "anoisesrc=d=2:c=pink:a=0.5" -af "tremolo=f=20:d=0.8,lowpass=f=3000,highpass=f=100,afade=t=in:d=0.5,afade=t=out:st=1.7:d=0.3,volume=2" -ar 44100 -b:a 128k`,
  'musical/rimshot.mp3': `-f lavfi -i "aevalsrc=exprs='(sin(2*PI*200*t)*exp(-20*t)+sin(2*PI*180*(t-0.2))*exp(-20*(t-0.2))*(t>0.2))':d=0.8" -af "volume=3,afade=t=out:st=0.4:d=0.4" -ar 44100 -b:a 128k`,
  'musical/sad-trombone.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*(400-100*t/2)*t)*0.6':d=2" -af "vibrato=f=5:d=0.5,afade=t=in:d=0.05,afade=t=out:st=1.3:d=0.7,lowpass=f=2000" -ar 44100 -b:a 128k`,
  'musical/fanfare.mp3': `-f lavfi -i "aevalsrc=exprs='(sin(2*PI*523*t)+sin(2*PI*659*t)+sin(2*PI*784*t))*0.3':d=1.5" -af "afade=t=in:d=0.05,afade=t=out:st=0.8:d=0.7,volume=2" -ar 44100 -b:a 128k`,
  'musical/piano-hit.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*440*t)*exp(-3*t)*0.7':d=1.5" -af "afade=t=out:st=0.8:d=0.7,volume=2" -ar 44100 -b:a 128k`,
  'musical/guitar-strum.mp3': `-f lavfi -i "aevalsrc=exprs='(sin(2*PI*330*t)+sin(2*PI*440*t)+sin(2*PI*550*t))*exp(-4*t)*0.4':d=1.5" -af "afade=t=out:st=0.5:d=1.0,tremolo=f=6:d=0.2,volume=2" -ar 44100 -b:a 128k`,
  'musical/vinyl-scratch.mp3': `-f lavfi -i "anoisesrc=d=0.5:c=white:a=0.6" -af "afade=t=in:d=0.01,afade=t=out:st=0.15:d=0.35,bandpass=f=2000:w=4000,asetrate=44100*0.7,aresample=44100" -ar 44100 -b:a 128k`,
  'ui/click.mp3': `-f lavfi -i "sine=frequency=1000:duration=0.05" -af "afade=t=in:d=0.002,afade=t=out:st=0.02:d=0.03,volume=2" -ar 44100 -b:a 128k`,
  'ui/ding.mp3': `-f lavfi -i "sine=frequency=880:duration=0.5" -af "afade=t=in:d=0.01,afade=t=out:st=0.1:d=0.4,volume=1.5" -ar 44100 -b:a 128k`,
  'ui/beep.mp3': `-f lavfi -i "sine=frequency=440:duration=0.3" -af "afade=t=in:d=0.01,afade=t=out:st=0.15:d=0.15" -ar 44100 -b:a 128k`,
  'ui/notification.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*800*t)*(t<0.15)+sin(2*PI*1000*t)*(t>=0.2)*(t<0.35)':d=0.4" -af "afade=t=in:d=0.01,afade=t=out:st=0.3:d=0.1,volume=1.5" -ar 44100 -b:a 128k`,
  'ui/error-buzz.mp3': `-f lavfi -i "sine=frequency=150:duration=0.5" -af "tremolo=f=25:d=0.9,afade=t=in:d=0.01,afade=t=out:st=0.3:d=0.2,volume=2" -ar 44100 -b:a 128k`,
  'ui/success-chime.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*523*t)*(t<0.2)+sin(2*PI*659*t)*(t>=0.2)*(t<0.4)+sin(2*PI*784*t)*(t>=0.4)':d=0.6" -af "afade=t=in:d=0.01,afade=t=out:st=0.45:d=0.15,volume=1.5" -ar 44100 -b:a 128k`,
  'ui/pop.mp3': `-f lavfi -i "aevalsrc=exprs='sin(2*PI*600*t)*exp(-30*t)':d=0.15" -af "volume=3" -ar 44100 -b:a 128k`,
  'ui/type-click.mp3': `-f lavfi -i "anoisesrc=d=0.05:c=white:a=0.4" -af "afade=t=in:d=0.001,afade=t=out:st=0.02:d=0.03,highpass=f=2000,volume=2" -ar 44100 -b:a 128k`,
  'ambient/crowd-murmur.mp3': `-f lavfi -i "anoisesrc=d=3:c=pink:a=0.3" -af "lowpass=f=2000,highpass=f=200,tremolo=f=0.5:d=0.3,afade=t=in:d=0.5,afade=t=out:st=2.0:d=1.0" -ar 44100 -b:a 128k`,
  'ambient/traffic.mp3': `-f lavfi -i "anoisesrc=d=3:c=brown:a=0.4" -af "lowpass=f=1500,tremolo=f=0.2:d=0.4,afade=t=in:d=0.5,afade=t=out:st=2.0:d=1.0,volume=1.5" -ar 44100 -b:a 128k`,
  'ambient/fire-crackle.mp3': `-f lavfi -i "anoisesrc=d=3:c=white:a=0.3" -af "tremolo=f=15:d=0.7,highpass=f=1000,lowpass=f=6000,afade=t=in:d=0.3,afade=t=out:st=2.0:d=1.0" -ar 44100 -b:a 128k`,
  'ambient/underwater.mp3': `-f lavfi -i "anoisesrc=d=3:c=brown:a=0.3" -af "lowpass=f=400,tremolo=f=0.3:d=0.5,vibrato=f=1:d=0.3,afade=t=in:d=0.5,afade=t=out:st=2.0:d=1.0" -ar 44100 -b:a 128k`,
  'ambient/spaceship-hum.mp3': `-f lavfi -i "aevalsrc=exprs='(sin(2*PI*60*t)+sin(2*PI*90*t)*0.5+sin(2*PI*120*t)*0.3)*0.3':d=3" -af "tremolo=f=0.5:d=0.2,afade=t=in:d=0.5,afade=t=out:st=2.0:d=1.0" -ar 44100 -b:a 128k`,
  'ambient/rain-on-window.mp3': `-f lavfi -i "anoisesrc=d=3:c=pink:a=0.25" -af "highpass=f=2000,lowpass=f=10000,tremolo=f=8:d=0.4,afade=t=in:d=0.3,afade=t=out:st=2.0:d=1.0" -ar 44100 -b:a 128k`,
};

// Track results
let successCount = 0;
let failCount = 0;
const failures = [];
const allFiles = Object.keys(soundGenerators);
const totalSounds = allFiles.length;

console.log(`\n=== Sound Effect Generator ===`);
console.log(`Mode: ${hasFFmpeg ? 'ffmpeg (MP3)' : 'Pure Node.js (WAV as .mp3)'}`);
console.log(`Generating ${totalSounds} sound effects...\n`);

for (const filePath of allFiles) {
  const outputPath = path.join(SOUNDS_DIR, filePath);

  process.stdout.write(`[${successCount + failCount + 1}/${totalSounds}] ${filePath}... `);

  try {
    if (hasFFmpeg && ffmpegSounds[filePath]) {
      // Use ffmpeg for actual MP3 encoding
      const fullCmd = `ffmpeg -y ${ffmpegSounds[filePath]} "${outputPath}" 2>/dev/null`;
      execSync(fullCmd, { stdio: 'pipe', timeout: 15000 });
    } else {
      // Pure Node.js: generate WAV buffer
      const generator = soundGenerators[filePath];
      const samples = generator();
      const wavBuffer = createWav(Array.from(samples));
      fs.writeFileSync(outputPath, wavBuffer);
    }

    // Verify
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      if (stats.size > 0) {
        console.log(`OK (${(stats.size / 1024).toFixed(1)} KB)`);
        successCount++;
      } else {
        console.log('FAIL (empty file)');
        failCount++;
        failures.push(filePath);
      }
    } else {
      console.log('FAIL (not created)');
      failCount++;
      failures.push(filePath);
    }
  } catch (error) {
    // If ffmpeg failed, try pure Node.js fallback
    if (hasFFmpeg && soundGenerators[filePath]) {
      try {
        const generator = soundGenerators[filePath];
        const samples = generator();
        const wavBuffer = createWav(Array.from(samples));
        fs.writeFileSync(outputPath, wavBuffer);
        const stats = fs.statSync(outputPath);
        console.log(`OK via fallback (${(stats.size / 1024).toFixed(1)} KB)`);
        successCount++;
        continue;
      } catch (e2) {
        // fall through to failure
      }
    }
    console.log(`FAIL (${error.message.split('\n')[0].substring(0, 60)})`);
    failCount++;
    failures.push(filePath);
  }
}

console.log(`\n=== Results ===`);
console.log(`Success: ${successCount}/${totalSounds}`);
console.log(`Failed:  ${failCount}/${totalSounds}`);

if (failures.length > 0) {
  console.log(`\nFailed files:`);
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
}

console.log(`\nOutput directory: ${SOUNDS_DIR}`);
