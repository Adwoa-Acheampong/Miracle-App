// voice.js — Web Speech API wrapper for dictation.
// One controller per mic button. Falls back gracefully if unsupported.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const VOICE_SUPPORTED = !!Recognition;

/**
 * Attach mic dictation to a text input/textarea.
 * @param {HTMLButtonElement} button — the mic toggle
 * @param {HTMLInputElement|HTMLTextAreaElement} target — where transcripts go
 * @param {{ lang?: string, onInterim?: (s)=>void, onFinal?: (s)=>void }} opts
 * @returns {() => void} disposer
 */
export function attachDictation(button, target, opts = {}) {
  if (!VOICE_SUPPORTED) {
    button.classList.add('is-disabled');
    button.title = 'voice input not supported in this browser';
    button.disabled = true;
    return () => {};
  }

  const rec = new Recognition();
  rec.continuous     = true;
  rec.interimResults = true;
  rec.lang           = opts.lang || 'en-US';

  let active = false;
  let baseValue = '';     // value before this dictation session
  let interimText = '';

  rec.onresult = e => {
    let final = '';
    interimText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += transcript + ' ';
      else interimText += transcript;
    }
    if (final) {
      baseValue = (baseValue + ' ' + final.trim()).trim();
      opts.onFinal?.(final.trim());
    }
    target.value = (baseValue + (interimText ? ' ' + interimText : '')).trim();
    target.dispatchEvent(new Event('input', { bubbles: true }));
    opts.onInterim?.(interimText);
  };

  rec.onerror = e => {
    console.warn('[voice] error', e.error);
    stop();
    if (e.error === 'not-allowed') {
      button.title = 'microphone permission denied';
      button.classList.add('is-error');
    }
  };

  rec.onend = () => {
    if (active) {
      // Auto-restart on natural end while still active (Chrome stops after ~60s)
      try { rec.start(); } catch {}
    }
  };

  function start() {
    baseValue = target.value || '';
    try {
      rec.start();
      active = true;
      button.classList.add('is-recording');
      button.setAttribute('aria-pressed', 'true');
    } catch (err) {
      console.warn('[voice] start failed', err);
    }
  }

  function stop() {
    active = false;
    try { rec.stop(); } catch {}
    button.classList.remove('is-recording');
    button.setAttribute('aria-pressed', 'false');
  }

  const onClick = () => active ? stop() : start();
  button.addEventListener('click', onClick);

  return () => {
    button.removeEventListener('click', onClick);
    stop();
  };
}

/** Render a mic button element. */
export function micButton({ label = 'voice', size = 32 } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mic-btn';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', 'false');
  btn.title = VOICE_SUPPORTED ? label : 'voice not supported';
  btn.style.width  = size + 'px';
  btn.style.height = size + 'px';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="${Math.round(size * 0.55)}" height="${Math.round(size * 0.55)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3"/>
      <path d="M5 11a7 7 0 0 0 14 0"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="8"  y1="22" x2="16" y2="22"/>
    </svg>
    <span class="mic-pulse" aria-hidden="true"></span>
  `;
  return btn;
}
