// End-to-end crypto for groups. Nothing here trusts the relay:
// - each device has its own ECDH key (to receive the group key) and ECDSA key
//   (to sign its positions); both private keys are non-extractable;
// - the group key (AES-GCM) is created by the group owner and handed to each
//   approved member sealed to that member's public key;
// - the invite link carries the owner's key fingerprint, so a joiner only
//   accepts a group key that really comes from the owner.
const enc = new TextEncoder();
const dec = new TextDecoder();
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (0/o, 1/l/i)
const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIG = { name: 'ECDSA', hash: 'SHA-256' } as const;

export interface Identity {
  priv: CryptoKey;
  pub: JsonWebKey;
  signPriv: CryptoKey;
  signPub: JsonWebKey;
}

/** e.g. "k7mq-4hxa-p2vt": ~74 bits, readable aloud. */
export function newGroupCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5, 10)}-${chars.slice(10)}`;
}

export const normalizeCode = (code: string) => code.trim().toLowerCase().replace(/\s+/g, '');

export const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (data: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));

/** Only the public coordinates: never pass private or extra fields along. */
export const publicPart = (k: JsonWebKey): JsonWebKey => ({ kty: 'EC', crv: 'P-256', x: k.x, y: k.y });
export const isPub = (v: unknown): v is JsonWebKey => !!v && typeof (v as JsonWebKey).x === 'string' && typeof (v as JsonWebKey).y === 'string';
export const samePub = (a: JsonWebKey, b: JsonWebKey) => a.x === b.x && a.y === b.y;

/** Lobby: where join requests wait. Derived from the invite code. */
export async function lobbyKeys(code: string): Promise<{ key: CryptoKey; topic: string }> {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalizeCode(code)), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
  const params = (salt: string) => ({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150_000, hash: 'SHA-256' });
  const key = await crypto.subtle.deriveKey(params('enchanted-atlas/lobby-key'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(params('enchanted-atlas/lobby-topic'), base, 128));
  return { key, topic: hex(bits) };
}

/** A fresh random group key, as text so the owner can hand it out. */
export const newGroupKey = () => b64(crypto.getRandomValues(new Uint8Array(32)));

/** The group key and the relay topic it implies (the topic never reveals the key). */
export async function groupKeys(groupKey: string): Promise<{ key: CryptoKey; topic: string }> {
  const raw = unb64(groupKey);
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const topic = hex((await sha256(new Uint8Array([...enc.encode('enchanted-atlas/topic'), ...raw]))).slice(0, 16));
  return { key, topic };
}

/** Private keys are created non-extractable: page code can use them but never read or copy them out. */
export async function newIdentity(): Promise<Identity> {
  const dh = await crypto.subtle.generateKey(ECDH, false, ['deriveKey']);
  const sg = await crypto.subtle.generateKey(ECDSA, false, ['sign', 'verify']);
  return {
    priv: dh.privateKey,
    pub: publicPart(await crypto.subtle.exportKey('jwk', dh.publicKey)),
    signPriv: sg.privateKey,
    signPub: publicPart(await crypto.subtle.exportKey('jwk', sg.publicKey)),
  };
}

const pubBytes = (pub: JsonWebKey) => enc.encode(`${pub.x}.${pub.y}`);

/** Short hex fingerprint of a public key; goes in invite links. */
export const fingerprint = async (pub: JsonWebKey) => hex((await sha256(pubBytes(pub))).slice(0, 10));

/**
 * Twenty digits both people read aloud to confirm a request is genuine.
 * ~66 bits: far too many to forge by generating keys until one matches.
 */
export async function safetyNumber(pub: JsonWebKey, signPub: JsonWebKey): Promise<string> {
  const d = await sha256(new Uint8Array([...enc.encode('enchanted-atlas/safety'), ...pubBytes(pub), ...pubBytes(signPub)]));
  const view = new DataView(d.buffer);
  return [0, 4, 8, 12].map((i) => (view.getUint32(i) % 100_000).toString().padStart(5, '0')).join(' ');
}

/** AES key shared by exactly two identities (ECDH). */
async function pairKey(myPriv: CryptoKey, theirPub: JsonWebKey): Promise<CryptoKey> {
  const pub = await crypto.subtle.importKey('jwk', publicPart(theirPub), ECDH, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, myPriv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const sealTo = async (myPriv: CryptoKey, theirPub: JsonWebKey, value: unknown) => seal(await pairKey(myPriv, theirPub), value);
export const unsealFrom = async (myPriv: CryptoKey, theirPub: JsonWebKey, bytes: Uint8Array) => {
  try {
    return await unseal(await pairKey(myPriv, theirPub), bytes);
  } catch {
    return null; // malformed public key
  }
};

/** A signed statement: the exact JSON text plus a signature over it. */
export interface Signed {
  body: string;
  sig: string;
}

export async function sign(signPriv: CryptoKey, value: unknown): Promise<Signed> {
  const body = JSON.stringify(value);
  return { body, sig: b64(new Uint8Array(await crypto.subtle.sign(SIG, signPriv, enc.encode(body)))) };
}

/** The parsed value if `s` was signed by `signPub`, else null. */
export async function verify(signPub: JsonWebKey, s: unknown): Promise<unknown> {
  const v = s as Partial<Signed> | null;
  if (!v || typeof v.body !== 'string' || typeof v.sig !== 'string') return null;
  try {
    const key = await crypto.subtle.importKey('jwk', publicPart(signPub), ECDSA, false, ['verify']);
    return (await crypto.subtle.verify(SIG, key, unb64(v.sig), enc.encode(v.body))) ? JSON.parse(v.body) : null;
  } catch {
    return null;
  }
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
