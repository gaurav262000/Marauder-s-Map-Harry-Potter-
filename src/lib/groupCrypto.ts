// End-to-end encryption for group presence. The group code is the only
// secret: it derives both the AES key and the relay topic, so the relay
// sees neither who is in a group nor where they are.
const enc = new TextEncoder();
const dec = new TextDecoder();
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (0/o, 1/l/i)

/** e.g. "k7mq-4hxa-p2vt": ~74 bits, readable aloud. */
export function newGroupCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5, 10)}-${chars.slice(10)}`;
}

export const normalizeCode = (code: string) => code.trim().toLowerCase().replace(/\s+/g, '');

export async function groupKeys(code: string): Promise<{ key: CryptoKey; topic: string }> {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalizeCode(code)), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
  const params = (salt: string) => ({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150_000, hash: 'SHA-256' });
  const key = await crypto.subtle.deriveKey(params('enchanted-atlas/key'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(params('enchanted-atlas/topic'), base, 128));
  return { key, topic: [...bits].map((b) => b.toString(16).padStart(2, '0')).join('') };
}

export async function seal(key: CryptoKey, value: unknown): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return out;
}

/** Returns null for anything not sealed with this key (other groups, tampering, junk). */
export async function unseal(key: CryptoKey, bytes: Uint8Array): Promise<unknown> {
  if (bytes.length < 13) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    return JSON.parse(dec.decode(plain));
  } catch {
    return null;
  }
}
