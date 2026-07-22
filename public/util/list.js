export function toList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean);
  if (value == null) return [];
  const item = String(value).trim();
  return item ? [item] : [];
}

export function formatList(value) {
  return toList(value).join(', ');
}
