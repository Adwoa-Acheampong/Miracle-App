import { icon as baseIcon } from '../icons.js?v=__BUILD__';

const EXTRA = Object.freeze({
  'sunrise': '<path d="M4 18h16"/><path d="M6 14a6 6 0 0 1 12 0"/><path d="M12 2v3"/><path d="m4.9 6.9 2.1 2.1"/><path d="m19.1 6.9-2.1 2.1"/>',
  'hammer': '<path d="m15 12-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9"/><path d="m17.6 15 3.1-3.1"/><path d="m14 8 2.8-2.8a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L18 12"/><path d="m9 4 3 3"/>',
  'flower-2': '<path d="M12 5a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"/><path d="M17 10a3 3 0 1 0 3-3 3 3 0 0 0-3 3Z"/><path d="M12 15a3 3 0 1 0 3 3 3 3 0 0 0-3-3Z"/><path d="M7 10a3 3 0 1 0-3 3 3 3 0 0 0 3-3Z"/><circle cx="12" cy="10" r="3"/><path d="M12 13v9"/>',
  'calendar-days': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  'wand-sparkles': '<path d="m15 4-9.5 9.5a2.1 2.1 0 0 0 3 3L18 7"/><path d="m14 5 3 3"/><path d="M5 3v4M3 5h4M19 13v4M17 15h4M13 18v3M11.5 19.5h3"/>',
  'award': '<circle cx="12" cy="8" r="6"/><path d="M8.2 13 7 22l5-3 5 3-1.2-9"/>',
  'pen-line': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  'book-open-text': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/><path d="M6 8h2M6 12h2M16 8h2M16 12h2"/>',
  'moon-star': '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/><path d="m18 2 .7 1.8L21 4.5l-2.3.7L18 7l-.7-1.8L15 4.5l2.3-.7Z"/>',
  'music-2': '<circle cx="8" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M11 18V5l10-2v13M11 9l10-2"/>',
  'timer': '<circle cx="12" cy="13" r="9"/><path d="M12 9v4l2 2M9 2h6"/>',
  'route': '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 17V9a4 4 0 0 1 4-4h6M18 7v4a4 4 0 0 1-4 4h-2"/>',
  'blocks': '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  'brain': '<path d="M9.5 4A3.5 3.5 0 0 0 6 7.5c0 .4.1.8.2 1.1A3.5 3.5 0 0 0 7.5 15H9v4a2 2 0 0 0 4 0V5a3 3 0 0 0-3.5-1Z"/><path d="M14.5 4A3.5 3.5 0 0 1 18 7.5c0 .4-.1.8-.2 1.1A3.5 3.5 0 0 1 16.5 15H15"/><path d="M9 9h4M8 15h5M15 9h2"/>',
  'utensils': '<path d="M3 2v7a3 3 0 0 0 6 0V2M6 2v20M18 2v20M18 2c-3 2-4 6-4 10h4"/>',
  'wallet-cards': '<path d="M21 7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  'library': '<path d="M4 19V5M9 19V5M14 19V5M19 19V8M2 21h20"/><path d="M3 5h3M8 5h3M13 5h3M18 8h3"/>',
  'cloud-moon': '<path d="M20.5 14.5A4.5 4.5 0 0 0 16 10a6 6 0 0 0-11.6 2A4 4 0 0 0 5 20h14a3.5 3.5 0 0 0 1.5-5.5Z"/><path d="M18 3a4 4 0 0 1-5 5 5 5 0 0 0 5-5Z"/>',
  'history': '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/><path d="M12 7v5l3 2"/>',
  'waves': '<path d="M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  'play': '<polygon points="6 3 20 12 6 21 6 3"/>',
  'pause': '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  'highlighter': '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-9-9-5 5 9 9Z"/><path d="m16 8-5 5"/>',
  'sprout': '<path d="M12 22V10"/><path d="M12 13C8 13 5 10 5 6c4 0 7 3 7 7Z"/><path d="M12 16c0-4 3-7 7-7 0 4-3 7-7 7Z"/>',
  'arrow-up': '<path d="m5 12 7-7 7 7M12 19V5"/>',
  'eraser': '<path d="m7 21-4-4 12-12a2.8 2.8 0 0 1 4 4L7 21Z"/><path d="m11 9 4 4M7 21h13"/>',
  'map': '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><path d="M9 3v15M15 6v15"/>',
  'door-open': '<path d="M13 4h7v16h-7"/><path d="M3 20h10V2L3 4Z"/><path d="M10 12h.01"/>',
  'wind': '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M4 12h15a2 2 0 1 1-2 2"/><path d="M3 16h8a3 3 0 1 1-3 3"/>',
  'mail-check': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/><path d="m8 16 2 2 4-4"/>',
});

export function icon(name, { size = 14, stroke = 1.6 } = {}) {
  const base = baseIcon(name, { size, stroke });
  if (base) return base;
  const inner = EXTRA[name];
  if (!inner) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true">${inner}</svg>`;
}
