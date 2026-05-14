// https://onlinelibrary.wiley.com/doi/10.1155/2014/865967

import FFT from 'fft.js'

export interface CPRFeedback {
  displacement: number[] // Reconstructed chest displacement signal s(t) in mm
  rate: number // Estimated CPR rate in compressions per minute (cpm)
  depth: number // Estimated average compression depth in millimeters (mm)
}

/**
 * Reconstructs the Chest Displacement (CD) signal s(t) from a
 * single-axis accelerometer signal a(t) using fft.js.
 *
 * @param acceleration - 1D array of raw acceleration signals (m/s^2)
 * @param samplingRate - Sampling frequency in Hz
 * @param numHarmonics - Number of harmonics (N) to use (default: 5)
 * @returns 1D array representing the displacement signal s(t) in mm
 */
export function computeCPRFeedback(
  acceleration: number[],
  fftSize: number = 2048,
  samplingRate: number = 60,
  numHarmonics: number = 5,
): CPRFeedback {
  const originalLength = acceleration.length

  // fft.js requires power-of-two size
  const fft = new FFT(fftSize)

  // Prepare input (padded with zeros)
  const input = new Array(fftSize).fill(0)
  for (let i = 0; i < originalLength; i++) input[i] = acceleration[i]

  // Hamming window to reduce spectral leakage
  for (let i = 0; i < originalLength; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (originalLength - 1))
    input[i] = acceleration[i] * w
  }

  // Output array for real-to-complex transform
  const out = fft.createComplexArray()
  fft.realTransform(out, input)

  // 1. Find Fundamental Frequency (fcc)
  // We look for the peak within the typical CPR range (approx 1Hz to 3Hz)
  // After computing FFT magnitudes, build a magnitude array first
  const mags = new Float32Array(fftSize / 2)
  for (let k = 0; k < fftSize / 2; k++) {
    const re = out[2 * k],
      im = out[2 * k + 1]
    mags[k] = Math.sqrt(re * re + im * im)
  }

  // HPS: multiply spectrum by downsampled versions of itself
  // This reinforces the fundamental and suppresses harmonics
  const hpsSize = Math.floor(fftSize / 2 / 3) // limit to 3 harmonics
  const hps = new Float32Array(hpsSize)
  for (let k = 0; k < hpsSize; k++) {
    hps[k] = mags[k] * mags[k * 2] * mags[k * 3]
  }

  // Find peak in HPS within CPR range
  let maxHPS = -1
  let fccIdx = 1
  for (let k = 0; k < hpsSize; k++) {
    if (hps[k] > maxHPS) {
      maxHPS = hps[k]
      fccIdx = k
    }
  }

  const f_cc = (fccIdx * samplingRate) / fftSize
  const s_t = new Array(originalLength).fill(0)
  const dt = 1 / samplingRate

  // 2. Reconstruct s(t) using Equation 2 and Equation 4
  for (let k = 1; k <= numHarmonics; k++) {
    const k_idx = fccIdx * k
    if (k_idx >= fftSize / 2) break

    // Extract Ak and theta_k from acceleration spectrum (Eq 1)
    const re = out[2 * k_idx]
    const im = out[2 * k_idx + 1]

    // Magnitude normalization for Real FFT
    const HAMMING_COHERENT_GAIN = 0.54
    const Ak =
      (2 * Math.sqrt(re * re + im * im)) /
      (originalLength * HAMMING_COHERENT_GAIN)
    const theta_k = Math.atan2(im, re)

    // Apply Transfer Function (Eq 4)
    // Sk = (1000 * Ak) / (2 * PI * k * f_cc)^2
    const omega_k = 2 * Math.PI * k * f_cc
    const Sk = (1000 * Ak) / Math.pow(omega_k, 2)

    // phi_k = theta_k + PI
    const phi_k = theta_k + Math.PI

    // 3. Synthesize s(t) by summing harmonics (Eq 2)
    for (let i = 0; i < originalLength; i++) {
      const time = i * dt
      s_t[i] += Sk * Math.cos(omega_k * time + phi_k)
    }
  }

  // 4. Estimate CPR Rate and Depth
  // Rate (cpm) = f_cc * 60
  const rate = f_cc * 60

  // Depth (mm) can be approximated as the peak-to-peak amplitude of s(t)
  const maxDepth = Math.max(...s_t)
  const minDepth = Math.min(...s_t)
  const depth = maxDepth - minDepth

  return { rate, depth, displacement: s_t }
}

export function computeActualSamplingRate(timestamps: number[]): number {
  // timestamps in ms
  const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i])
  const medianInterval = intervals.sort((a, b) => a - b)[
    Math.floor(intervals.length / 2)
  ]
  return 1000 / medianInterval
}
