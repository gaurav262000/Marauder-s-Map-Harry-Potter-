// The secret words that open the map. Only a salted PBKDF2 hash is kept, in this
// browser. It keeps casual eyes off the map; it is not encryption of the data.
import { b64, unb64 } from './groupCrypto.ts';

export const LOCK_KEY = 'atlas-lock';
const ROUNDS = 120_000;
const enc = new TextEncoder();

async function hash(words: string, salt: Uint8Array): Promise<string> {
  const base = await crypto.subtle.importKey('raw', enc.encode(words.trim().toLowerCase()), 'PBKDF2', false, ['deriveBits']);
  return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ROUNDS }, base, 256)));
}

export interface Lock {
  salt: string;
  hash: string;
}

export async function makeLock(words: string): Promise<Lock> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: await hash(words, salt) };
}

export const opens = async (lock: Lock, words: string) => (await hash(words, unb64(lock.salt))) === lock.hash;
