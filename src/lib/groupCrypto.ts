// End-to-end crypto for groups. Nothing here trusts the relay:
// - each device has its own ECDH identity key pair;
// - the group key (AES-GCM) is created by the group owner and handed to each
//   approved member sealed to that member's public key;
// - the invite link carries the owner's key fingerprint, so a joiner only
//   accepts a group key that really comes from the owner.
const enc = new TextEncoder();
const dec = new TextDecoder();
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (0/o, 1/l/i)
const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;

export interface Identity {
  priv: JsonWebKey;
  pub: JsonWebKey;
}

/** e.g. "k7mq-4hxa-p2vt": ~74 bits, readable aloud. */
export function newGroupCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5, 10)}-${chars.slice(10)}`;
}

export const normalizeCode = (code: string) => code.trim().toLowerCase().replace(/\s+/g, '');

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (data: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));

/** Lobby: where join requests wait. Derived from the invite code. */
export async function lobbyKeys(code: string): Promise<{ key: CryptoKey; topic: string }> {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalizeCode(code)), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
  const params = (salt: string) => ({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150_000, hash: 'SHA-256' });
  const key = await crypto.subtle.deriveKey(params('enchanted-atlas/lobby-key'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(params('enchanted-atlas/lobby-topic'), base, 128));
  return { key, topic: hex(bits) };
}

/** A fresh random group key, as text so it can be stored and sent. */
export const newGroupKey = () => b64(crypto.getRandomValues(new Uint8Array(32)));

/** The group key and the relay topic it implies (the topic never reveals the key). */
export async function groupKeys(groupKey: string): Promise<{ key: CryptoKey; topic: string }> {
  const raw = unb64(groupKey);
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const topic = hex((await sha256(new Uint8Array([...enc.encode('enchanted-atlas/topic'), ...raw]))).slice(0, 16));
  return { key, topic };
}

export async function newIdentity(): Promise<Identity> {
  const pair = await crypto.subtle.generateKey(ECDH, true, ['deriveKey']);
  return { priv: await crypto.subtle.exportKey('jwk', pair.privateKey), pub: await crypto.subtle.exportKey('jwk', pair.publicKey) };
}

const pubBytes = (pub: JsonWebKey) => enc.encode(`${pub.x}.${pub.y}`);

/** Short hex fingerprint of a public key; goes in invite links. */
export const fingerprint = async (pub: JsonWebKey) => hex((await sha256(pubBytes(pub))).slice(0, 10));

/** Six digits both people can read aloud to confirm they hold the same key. */
export async function safetyNumber(pub: JsonWebKey): Promise<string> {
  const d = await sha256(new Uint8Array([...enc.encode('safety'), ...pubBytes(pub)]));
  const n = (((d[0] << 16) | (d[1] << 8) | d[2]) % 1_000_000).toString().padStart(6, '0');
  return `${n.slice(0, 3)} ${n.slice(3)}`;
}

/** AES key shared by exactly two identities (ECDH). */
async function pairKey(myPriv: JsonWebKey, theirPub: JsonWebKey): Promise<CryptoKey> {
  const priv = await crypto.subtle.importKey('jwk', myPriv, ECDH, false, ['deriveKey']);
  const pub = await crypto.subtle.importKey('jwk', { kty: theirPub.kty, crv: theirPub.crv, x: theirPub.x, y: theirPub.y }, ECDH, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const sealTo = async (myPriv: JsonWebKey, theirPub: JsonWebKey, value: unknown) => seal(await pairKey(myPriv, theirPub), value);
export const unsealFrom = async (myPriv: JsonWebKey, theirPub: JsonWebKey, bytes: Uint8Array) => {
  try {
    return await unseal(await pairKey(myPriv, theirPub), bytes);
  } catch {
    return null; // malformed public key
  }
};

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
