// Keeps the Atlas working on a poor connection: the app itself is fetched fresh when
// possible and served from cache when not; map tiles and fonts already seen are reused.
const APP = 'atlas-app-v1';
const TILES = 'atlas-tiles-v1';
const MAX_TILES = 3000;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_TILES)).map((k) => c.delete(k)));
}

// Tiles and fonts: what was seen once is reused, and fetched only if missing.
async function cacheFirst(req) {
  const c = await caches.open(TILES);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await c.put(req, res.clone());
    if (Math.random() < 0.02) trim();
  }
  return res;
}

// The app: always the newest when online, the last one seen when not.
async function networkFirst(req) {
  const c = await caches.open(APP);
  try {
    const res = await fetch(req);
    if (res.ok) await c.put(req, res.clone());
    return res;
  } catch {
    return (await c.match(req)) ?? (req.mode === 'navigate' ? c.match('./index.html') : Response.error());
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'tiles.openfreemap.org' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') e.respondWith(cacheFirst(req));
  else if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  // search, routing, weather and the relays always go straight to the network
});
