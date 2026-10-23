// Seeded, reproducible randomness. The same seed string always yields the same sequence,
// in the browser and in Node, so an exam can be replayed exactly.

// xmur3: turns any string into a 32-bit integer stream
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

// mulberry32: small, fast PRNG with good distribution; returns floats in [0, 1)
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  return mulberry32(xmur3(String(seed))());
}

// Fisher-Yates; returns a new array
export function shuffle(items, rng) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Human-friendly random seed (no look-alike characters), e.g. "K7P3-X9MQ"
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newSeed() {
  const bytes = new Uint8Array(8);
  const c = globalThis.crypto;
  if (c && c.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}
