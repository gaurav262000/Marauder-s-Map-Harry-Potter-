import type { Map as MapLibre } from 'maplibre-gl';

const RATIO = 2;

function draw(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w * RATIO;
  canvas.height = h * RATIO;
  const c = canvas.getContext('2d')!;
  c.scale(RATIO, RATIO);
  paint(c);
  return c.getImageData(0, 0, canvas.width, canvas.height);
}

/** A shoe print pointing north (up); rotated per step by the symbol layer. */
const foot = (color: string) =>
  draw(20, 34, (c) => {
    c.fillStyle = color;
    // sole: broad toes narrowing to the arch
    c.beginPath();
    c.moveTo(10, 1);
    c.bezierCurveTo(16, 1, 18.5, 7, 17, 13);
    c.bezierCurveTo(16, 18, 13, 19.5, 13, 22);
    c.lineTo(7, 22);
    c.bezierCurveTo(7, 19, 3, 17, 3, 12);
    c.bezierCurveTo(2.5, 6, 5, 1, 10, 1);
    c.fill();
    // heel
    c.beginPath();
    c.ellipse(10, 28.6, 4.3, 4.6, 0, 0, Math.PI * 2);
    c.fill();
  });

const PAINTERS: Record<string, () => ImageData> = {
  foot: () => foot('rgba(94, 59, 28, 0.95)'),
  'foot-you': () => foot('rgba(110, 20, 14, 0.95)'),
  // Engraver's hatching for water.
  hatch: () =>
    draw(12, 12, (c) => {
      c.strokeStyle = 'rgba(94, 59, 28, 0.42)';
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(-3, 15);
      c.lineTo(15, -3);
      c.moveTo(-3, 3);
      c.lineTo(3, -3);
      c.moveTo(9, 15);
      c.lineTo(15, 9);
      c.stroke();
    }),
  // Little scribbled trees for parks.
  trees: () =>
    draw(40, 40, (c) => {
      c.strokeStyle = 'rgba(94, 59, 28, 0.55)';
      c.lineWidth = 0.9;
      for (const [x, y] of [[9, 11], [29, 29]]) {
        c.beginPath();
        c.arc(x, y, 4, 0, Math.PI * 2);
        c.moveTo(x, y + 4);
        c.lineTo(x, y + 8);
        c.stroke();
      }
    }),
};

/** Supplies the hand-drawn images lazily, whenever the style first asks for one. */
export function provideImages(map: MapLibre) {
  map.on('styleimagemissing', ({ id }) => {
    const paint = PAINTERS[id];
    if (paint && !map.hasImage(id)) map.addImage(id, paint(), { pixelRatio: RATIO });
  });
}
