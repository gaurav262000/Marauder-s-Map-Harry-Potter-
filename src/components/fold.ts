// The opening parchment folds like a map along its middle crease. Both effects work on
// copies of the sheet laid over it, so the real form underneath stays untouched.

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function stage(sheet: HTMLElement, settled: boolean) {
  const r = sheet.getBoundingClientRect();
  const box = document.createElement('div');
  box.className = 'fold-stage';
  box.setAttribute('aria-hidden', 'true');
  Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  document.body.append(box);
  const copy = () => {
    const c = sheet.cloneNode(true) as HTMLElement;
    c.classList.add('fold-face');
    if (settled) {
      // a sheet that has finished inking: freeze the copy in its final state
      c.classList.add('settled');
      c.querySelectorAll('animate').forEach((a) => a.remove());
      c.querySelectorAll('textPath').forEach((t) => t.setAttribute('startOffset', '0%'));
    }
    // typed text lives in properties, which cloning does not copy
    const typed = sheet.querySelectorAll('input');
    c.querySelectorAll('input').forEach((input, i) => {
      input.value = typed[i]?.value ?? '';
      input.checked = typed[i]?.checked ?? false;
    });
    return c;
  };
  const half = (side: 'left' | 'right') => {
    const h = document.createElement('div');
    h.className = `fold-half ${side}`;
    h.append(copy());
    const shade = document.createElement('div');
    shade.className = 'fold-shade';
    h.append(shade);
    box.append(h);
    return h;
  };
  return { box, left: half('left'), right: half('right') };
}

/** On first sight the right half lies folded over the left, and opens out across the crease. */
export function unfold(sheet: HTMLElement) {
  if (still()) return;
  const { box, right } = stage(sheet, false);
  const back = document.createElement('div');
  back.className = 'fold-back';
  right.append(back);
  sheet.style.visibility = 'hidden';
  right.style.transformOrigin = '50% 50%'; // the middle crease
  const a = right.animate([{ transform: 'rotateY(-178deg)' }, { transform: 'rotateY(0deg)' }], { duration: 950, delay: 150, easing: 'cubic-bezier(0.35, 0.1, 0.25, 1)', fill: 'both' });
  right.querySelector<HTMLElement>('.fold-shade')!.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 950, delay: 150, fill: 'both' });
  const done = () => {
    sheet.style.visibility = '';
    box.remove();
  };
  a.finished.then(done, done);
}

/** Opening the map: the sheet parts down its crease and both halves swing away. */
export function splitOpen(sheet: HTMLElement) {
  if (still()) return;
  const { box, left, right } = stage(sheet, true);
  left.style.transformOrigin = '0% 50%'; // each half swings on its outer edge, like a gate
  right.style.transformOrigin = '100% 50%';
  const timing = { duration: 1700, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'forwards' } as const;
  left.animate([{ transform: 'rotateY(0deg)', opacity: 1 }, { opacity: 1, offset: 0.7 }, { transform: 'rotateY(-105deg)', opacity: 0 }], timing);
  right.animate([{ transform: 'rotateY(0deg)', opacity: 1 }, { opacity: 1, offset: 0.7 }, { transform: 'rotateY(105deg)', opacity: 0 }], timing);
  for (const s of box.querySelectorAll<HTMLElement>('.fold-shade')) s.animate([{ opacity: 0 }, { opacity: 0.6 }], timing);
  setTimeout(() => box.remove(), timing.duration + 100);
}
