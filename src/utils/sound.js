const PREF_KEY = 'dualledger-sound'

let audioCtx = null

export function isSoundEnabled() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off'
  } catch (e) {
    return true
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off')
  } catch (e) {
    // ignore
  }
}

export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch (e) {
    // ignore
  }
}

function playTone(ctx, freq, startAt, duration, peak) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.05)
}

export function playCompletionSound() {
  if (!isSoundEnabled()) return
  try {
    unlockAudio()
    if (!audioCtx) return
    const now = audioCtx.currentTime
    playTone(audioCtx, 659.25, now, 0.18, 0.09)
    playTone(audioCtx, 880, now + 0.12, 0.22, 0.08)
  } catch (e) {
    // ignore
  }
}

export function playErrorSound() {
  if (!isSoundEnabled()) return
  try {
    unlockAudio()
    if (!audioCtx) return
    const now = audioCtx.currentTime
    playTone(audioCtx, 349.23, now, 0.2, 0.09)
    playTone(audioCtx, 261.63, now + 0.14, 0.26, 0.08)
  } catch (e) {
    // ignore
  }
}
