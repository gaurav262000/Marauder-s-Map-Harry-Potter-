// Engraved decorations for the opening parchment, drawn in SVG so they can ink themselves in.
// Original art: a ribbon banner with flourishes, a compass-rose emblem over a globe, an ink blot.

/** An Archimedean spiral from the outside in, for text to wind along. */
function spiral(cx: number, cy: number, r0: number, r1: number, turns: number) {
  const pts: string[] = [];
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = -Math.PI / 2 + t * turns * 2 * Math.PI;
    const r = r0 + (r1 - r0) * t;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

/** The banner across the top, with curling flourishes that draw themselves. */
export function IntroBanner() {
  return (
    <svg className="intro-banner" viewBox="0 0 400 120" aria-hidden>
      <g className="draw">
        <path pathLength={1} d="M200 104 C150 112 92 96 70 70 C50 46 66 18 92 24 C112 29 108 56 88 56 C72 56 74 38 86 40" />
        <path pathLength={1} d="M200 104 C250 112 308 96 330 70 C350 46 334 18 308 24 C288 29 292 56 312 56 C328 56 326 38 314 40" />
        <path pathLength={1} d="M70 70 C40 80 22 60 8 64 M330 70 C360 80 378 60 392 64" />
        <path pathLength={1} d="M118 30 C130 6 160 8 168 22 M282 30 C270 6 240 8 232 22" />
      </g>
      <g className="ribbon">
        <path className="ribbon-end" d="M88 66 L62 58 L72 76 L60 92 L96 86Z" />
        <path className="ribbon-end" d="M312 66 L338 58 L328 76 L340 92 L304 86Z" />
        <path id="banner-arc" className="ribbon-band" d="M90 62 Q200 22 310 62 L310 88 Q200 48 90 88Z" />
        <path id="banner-text" d="M96 82 Q200 42 304 82" fill="none" />
        <text className="ribbon-text">
          <textPath href="#banner-text" startOffset="50%" textAnchor="middle">
            ITINERARIVM · MVNDI
          </textPath>
        </text>
      </g>
    </svg>
  );
}

/** A compass rose over a globe, with an ink blot in the middle for the title to sit in. */
export function IntroEmblem() {
  const ticks = Array.from({ length: 32 }, (_, i) => i * 11.25);
  const point = (deg: number, long: number, wide: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    const p = (r: number, off: number) => {
      const b = a + off;
      return `${(200 + r * Math.cos(b)).toFixed(1)},${(140 + r * Math.sin(b)).toFixed(1)}`;
    };
    return { dark: `M200,140 L${p(long, 0)} L${p(wide, 0.5)}Z`, light: `M200,140 L${p(long, 0)} L${p(wide, -0.5)}Z` };
  };
  const points = [0, 90, 180, 270].map((d) => point(d, 128, 22)).concat([45, 135, 225, 315].map((d) => point(d, 84, 16)));
  return (
    <svg className="intro-emblem" viewBox="0 0 400 280" aria-hidden>
      <defs>
        <filter id="blot-edge" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="18" />
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <path id="spiral-left" d={spiral(58, 214, 54, 8, 2.3)} />
        <path id="spiral-right" d={spiral(342, 214, 54, 8, -2.3)} />
      </defs>
      <g className="draw globe">
        <circle pathLength={1} cx="200" cy="140" r="118" />
        <circle pathLength={1} cx="200" cy="140" r="110" />
        <ellipse pathLength={1} cx="200" cy="140" rx="74" ry="110" />
        <ellipse pathLength={1} cx="200" cy="140" rx="36" ry="110" />
        <path pathLength={1} d="M92 104 Q200 92 308 104 M90 176 Q200 188 310 176 M200 30 V250" />
      </g>
      <g className="ticks">
        {ticks.map((d) => (
          <line key={d} x1="200" y1={d % 45 ? 25 : 18} x2="200" y2="30" transform={`rotate(${d} 200 140)`} />
        ))}
      </g>
      <g className="rose">
        {points.map((p, i) => (
          <g key={i}>
            <path className="rose-dark" d={p.dark} />
            <path className="rose-light" d={p.light} />
          </g>
        ))}
      </g>
      <path
        className="blot"
        filter="url(#blot-edge)"
        d="M120 112 C128 84 172 88 196 92 C232 96 270 82 286 104 C300 124 292 150 296 168 C300 190 268 198 236 192 C206 186 176 200 148 192 C118 184 106 160 112 140 C116 128 114 120 120 112Z"
      />
      <text className="spiral-text">
        <textPath href="#spiral-left" startOffset="100%">
          QVI VAGATVR NON PERDITVR · QVI VAGATVR NON PERDITVR ·
          <animate attributeName="startOffset" from="100%" to="0%" dur="2.6s" begin="1.9s" fill="freeze" />
        </textPath>
      </text>
      <text className="spiral-text">
        <textPath href="#spiral-right" startOffset="100%">
          VESTIGIA NOSTRA MEMINIT · VESTIGIA NOSTRA MEMINIT ·
          <animate attributeName="startOffset" from="100%" to="0%" dur="2.6s" begin="2.1s" fill="freeze" />
        </textPath>
      </text>
    </svg>
  );
}
