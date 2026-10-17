// Generates MapLibre SDF glyph ranges (public/glyphs/<font>/<range>.pbf) for the
// IM Fell typefaces, so map labels render in the same antique serif as the UI.
// One-off tool; output is committed. To re-run:
//   npm i --no-save @napi-rs/canvas @mapbox/tiny-sdf pbf @expo-google-fonts/im-fell-english @expo-google-fonts/im-fell-english-sc
//   node scripts/build-glyphs.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GlobalFonts, createCanvas } from '@napi-rs/canvas';
import TinySDF from '@mapbox/tiny-sdf';
import { PbfWriter } from 'pbf';

const require = createRequire(import.meta.url);
const out = process.argv[2] ?? new URL('../public/glyphs/', import.meta.url).pathname;

const FONTS = [
  { name: 'IM Fell English Regular', file: '@expo-google-fonts/im-fell-english/400Regular/IMFellEnglish_400Regular.ttf', style: 'normal' },
  { name: 'IM Fell English Italic', file: '@expo-google-fonts/im-fell-english/400Regular_Italic/IMFellEnglish_400Regular_Italic.ttf', style: 'italic' },
  { name: 'IM Fell English SC Regular', file: '@expo-google-fonts/im-fell-english-sc/400Regular/IMFellEnglishSC_400Regular.ttf', style: 'normal' },
];
// Latin, Latin Extended A/B, combining marks, Latin Extended Additional, punctuation.
const RANGES = [0, 256, 512, 768, 7680, 8192];

class NodeSDF extends TinySDF {
  _createCanvas(size) {
    return createCanvas(size, size);
  }
}

for (const f of FONTS) {
  const family = `glyph-${f.name.replace(/\s/g, '')}`;
  GlobalFonts.registerFromPath(require.resolve(f.file), family);
  const sdf = new NodeSDF({ fontSize: 24, buffer: 3, radius: 8, cutoff: 0.25, fontFamily: family, fontStyle: f.style });
  mkdirSync(`${out}/${f.name}`, { recursive: true });
  for (const start of RANGES) {
    const end = start + 255;
    const pbf = new PbfWriter();
    pbf.writeMessage(1, (_, p) => {
      p.writeStringField(1, f.name);
      p.writeStringField(2, `${start}-${end}`);
      for (let id = Math.max(start, 32); id <= end; id++) {
        const g = sdf.draw(String.fromCodePoint(id));
        if (!g.glyphAdvance && id !== 32) continue;
        p.writeMessage(3, (__, q) => {
          q.writeVarintField(1, id);
          if (g.glyphWidth && g.glyphHeight) q.writeBytesField(2, Buffer.from(g.data));
          q.writeVarintField(3, g.glyphWidth);
          q.writeVarintField(4, g.glyphHeight);
          q.writeSVarintField(5, Math.round(g.glyphLeft));
          q.writeSVarintField(6, Math.round(g.glyphTop - 27));
          q.writeVarintField(7, Math.round(g.glyphAdvance));
        });
      }
    });
    writeFileSync(`${out}/${f.name}/${start}-${end}.pbf`, pbf.finish());
  }
  console.log('built', f.name);
}
