// Tiny ULID-ish id generator (Node).
import crypto from 'node:crypto';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;
const RAND_LEN = 16;

function encodeTime(now, len) {
  let str = '';
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    str = ENCODING[mod] + str;
    now = (now - mod) / 32;
  }
  return str;
}

function encodeRandom(len) {
  const bytes = crypto.randomBytes(len);
  let str = '';
  for (let i = 0; i < len; i++) str += ENCODING[bytes[i] % 32];
  return str;
}

export function ulid() {
  return encodeTime(Date.now(), TIME_LEN) + encodeRandom(RAND_LEN);
}
