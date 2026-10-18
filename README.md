# The Enchanted Atlas

A living, hand-inked parchment map of the **real world**, in the spirit of the magical maps of wizarding fiction. Every street on Earth is drawn as an ink corridor, buildings as rooms, water in engraver's hatching, and names in an antique quill serif. Write your name on the parchment and your footprints walk real footpaths wherever you send them, while the map's residents wander the streets around you.

All artwork and wording are original; no film or book assets are used.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run typecheck
npm run lint
npm test           # geometry checks (node:test, Node 22+)
```

## Put it online (GitHub Pages)

`.github/workflows/pages.yml` builds the site on every push to `main` (and to the development branch) and publishes it to the `gh-pages` branch. If the site does not appear at `https://<user>.github.io/<repo>/`, set **Settings → Pages → Source: Deploy from a branch → `gh-pages` / root**.

## What it does

- **The whole world** — pan, zoom, pinch and rotate anywhere; street-level detail everywhere OpenStreetMap has it.
- **Your footprints** — tap a spot, then **Walk here**: a walking route is fetched and your prints, labelled with your name, walk it. **Appear here** moves you instantly; the target button jumps to your real location.
- **Wanderers** — at street level, four residents of the parchment stroll along whichever streets are on screen, turning at junctions.
- **Friends & groups** — start a group and send the invite link. Opening the link only lets someone *ask* to join; the group owner approves or declines each request (checking a 6-digit safety number shown on both phones). Approved members see each other live: name tag, footprints, distance, and where each person is heading. The owner can remove anyone, which re-keys the group.
- **Seek any place** — search for any town, street or landmark (press Enter).
- **The oath** — the map opens only once you write your name, and folds away again from the top bar.
- Optional ambient sound (off by default), place-name toggle, compass that turns back to north, reduced-motion support.

## Data & services

No API keys are needed. Map tiles from [OpenFreeMap](https://openfreemap.org) (OpenMapTiles schema), search from [Nominatim](https://nominatim.org), walking routes from the [FOSSGIS OSRM](https://routing.openstreetmap.de) foot router. Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Please respect their usage policies (search runs only on Enter, never as you type).

### Group security

- Every device makes its own key pairs: ECDH P-256 (to receive the group key) and ECDSA P-256 (to sign its positions). Private keys are created **non-extractable** and kept in IndexedDB: the page can use them but cannot read or copy them out.
- The owner creates a random AES-256-GCM group key. It is only ever sent sealed to an approved member's public key, so the relay and anyone holding the invite link cannot read it.
- The invite link carries the owner's key fingerprint; a device accepts a group key (or a "declined" notice) only if it is sealed by that exact key.
- Join requests show a **20-digit safety number** on both phones, derived from the requester's keys (~66 bits, too many to forge by generating keys). If a request's keys change after it first arrived, it is flagged and cannot be approved.
- The owner publishes a **signed roster** (who may post, under which name). Every position is signed by its sender and accepted only if the signature matches that member's key in the roster and the current key epoch, so members can't fake each other's positions or names, and old messages can't be replayed after a re-key.
- Removing a member rotates the group key and re-sends it to everyone else; the removed device can no longer read new positions.
- Production builds ship a **Content-Security-Policy** that only allows scripts from the site itself and network connections to the map, search, routing and relay hosts.
- Positions travel through free public MQTT relays (HiveMQ and EMQX, override with `VITE_MQTT_BROKERS`). Topics are derived from hashes and payloads are encrypted, so the relay sees neither names nor places.

Known limits: the public relays have no access control, so anyone can delete or flood messages (disrupting the group, not reading it), and relay operators see IP addresses and message timing. There are no accounts: identity is per browser, so clearing site data means asking to join again, and if the owner clears theirs the group can no longer approve anyone.

## Structure

```
src/
  map/style.ts        parchment MapLibre style (ink corridors, hatched water, serif labels)
  map/images.ts       footprint, hatching and tree images drawn on canvas
  map/footprints.ts   walker engine: your walk, wandering residents, planted prints
  lib/geo.ts          distances, bearings, walking along a track (+ geo.test.ts)
  lib/services.ts     Nominatim search / reverse lookup, OSRM walking routes
  lib/group.ts        group relay (MQTT) and member validation
  lib/groupCrypto.ts  group code, key/topic derivation, AES-GCM (+ groupCrypto.test.ts)
  components/         Intro, SearchBox, PlaceNote, GroupPanel, HelpDialog
  hooks/              useAmbientAudio
  styles/parchment.css
```
