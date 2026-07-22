// Canonical HTML-escape. Use everywhere we interpolate untrusted input into HTML.
// Escapes the five chars that matter in HTML body OR attribute context.
// One source of truth — local copies in pages/* are deprecated and should import this.

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => MAP[c]);
}
