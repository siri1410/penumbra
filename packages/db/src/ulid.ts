/**
 * Tiny ULID generator — 26-char Crockford base32, time-prefixed, lexicographically
 * sortable. Good enough for local app IDs without pulling in a dependency.
 *
 * Layout: 10 chars timestamp (ms since epoch) + 16 chars randomness.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(now: number, len: number): string {
  let out = '';
  for (let i = len - 1; i >= 0; i--) {
    out = ENCODING[now % 32] + out;
    now = Math.floor(now / 32);
  }
  return out;
}

function encodeRandom(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ENCODING[Math.floor(Math.random() * 32)];
  }
  return out;
}

export function ulid(now: number = Date.now()): string {
  return encodeTime(now, 10) + encodeRandom(16);
}
