// attach.js — image attachments (camera + folder) for any entry.
// Saves resized JPEG data URLs onto entry.attachments[] so the entry stays
// self-contained in IndexedDB. Max 6 per entry, max ~250KB per image.

import { icon } from './icons.js';

const MAX_ATTACHMENTS = 6;
const MAX_DIMENSION   = 1280;   // px — long edge
const JPEG_QUALITY    = 0.78;

/**
 * Open a file picker. `capture` = true → opens rear camera on mobile.
 * Returns array of data-URL strings.
 */
export async function pickImages({ capture = false, multiple = true } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    if (multiple) input.multiple = true;
    if (capture)  input.capture  = 'environment';

    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      const compressed = [];
      for (const file of files) {
        try { compressed.push(await compressImage(file)); }
        catch (e) { console.warn('[attach] compress failed', e); }
      }
      resolve(compressed);
    }, { once: true });

    input.click();
  });
}

/** Read + resize + JPEG-encode a File. */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = fit(img.width, img.height, MAX_DIMENSION);
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fit(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

/**
 * Render an attachment strip into a host element.
 * Pass the entry's attachments array; mutations call onChange(nextArray).
 */
export function renderAttachmentStrip(host, attachments = [], { onChange, readOnly = false } = {}) {
  const list = Array.isArray(attachments) ? attachments.slice() : [];
  host.classList.add('attach-strip');
  host.innerHTML = `
    <div class="attach-thumbs">
      ${list.map((src, i) => `
        <div class="attach-thumb" data-i="${i}">
          <img src="${src}" alt="attachment ${i + 1}" loading="lazy">
          ${readOnly ? '' : `<button type="button" class="attach-remove" aria-label="remove">×</button>`}
        </div>
      `).join('')}
      ${readOnly || list.length >= MAX_ATTACHMENTS ? '' : `
        <button type="button" class="attach-add attach-cam"    aria-label="take photo" title="take photo">${icon('camera', { size: 22 })}<span class="attach-label">camera</span></button>
        <button type="button" class="attach-add attach-folder" aria-label="choose image" title="choose from device">${icon('image', { size: 22 })}<span class="attach-label">browse</span></button>
      `}
    </div>
  `;

  host.querySelectorAll('.attach-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const i = Number(btn.closest('.attach-thumb').dataset.i);
      const next = list.filter((_, idx) => idx !== i);
      onChange?.(next);
      renderAttachmentStrip(host, next, { onChange, readOnly });
    });
  });

  host.querySelector('.attach-cam')?.addEventListener('click', async e => {
    e.preventDefault();
    const imgs = await pickImages({ capture: true });
    commit(host, list, imgs, onChange, readOnly);
  });
  host.querySelector('.attach-folder')?.addEventListener('click', async e => {
    e.preventDefault();
    const imgs = await pickImages({ capture: false });
    commit(host, list, imgs, onChange, readOnly);
  });

  // Tap a thumb → fullscreen preview
  host.querySelectorAll('.attach-thumb img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
}

function commit(host, list, newOnes, onChange, readOnly) {
  if (!newOnes.length) return;
  const next = [...list, ...newOnes].slice(0, MAX_ATTACHMENTS);
  onChange?.(next);
  renderAttachmentStrip(host, next, { onChange, readOnly });
}

function openLightbox(src) {
  document.querySelectorAll('.attach-lightbox').forEach(el => el.remove());
  const box = document.createElement('div');
  box.className = 'attach-lightbox';
  box.innerHTML = `<img src="${src}" alt="" /><button class="attach-lightbox-close" aria-label="close">×</button>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.attach-lightbox-close').addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });
}
