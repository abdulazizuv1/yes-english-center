/**
 * Results marquee
 *
 * The student results scroll by in one continuous strip. Hovering a
 * certificate stops the strip and shows a round lens that magnifies the spot
 * under the cursor; a click, a tap or Enter opens the certificate large.
 *
 * The strip loops without a seam: the cards are repeated until one set is
 * wider than the screen, a copy of that set follows it, and the strip slides
 * left by exactly one set's width before starting over. The copies are there
 * only for the eye — screen readers and the Tab key skip them.
 *
 * @module ui/marquee
 */

const SPEED = 45;          // px per second
const ZOOM = 2.6;          // lens magnification

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const originals = new WeakMap();   // track -> the cards it was given

/** A copy of a card for the eye only. */
function cloneCard(card) {
  const copy = card.cloneNode(true);
  copy.querySelectorAll('.zoom-lens').forEach((lens) => lens.remove());   // only one lens, and it moves
  copy.setAttribute('aria-hidden', 'true');
  copy.dataset.copy = '';
  copy.querySelectorAll('button, a, [tabindex]').forEach((el) => el.setAttribute('tabindex', '-1'));
  return copy;
}

function layout(track) {
  const cards = originals.get(track) || [];
  const marquee = track.closest('.results-marquee');
  track.replaceChildren(...cards);
  track.style.removeProperty('--marquee-shift');
  track.style.removeProperty('--marquee-duration');
  marquee.classList.remove('is-running');
  if (!cards.length) return;

  if (reduceMotion()) {
    marquee.classList.add('is-static');   // a strip the visitor scrolls themselves
    return;
  }
  marquee.classList.remove('is-static');

  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  const setWidth = () => track.getBoundingClientRect().width + gap;

  // one set must outrun the screen, or the end of the loop shows empty space
  const set = [...cards];
  let width = setWidth();
  for (let round = 0; width < marquee.clientWidth + 1 && round < 20; round++) {
    cards.forEach((card) => {
      const copy = cloneCard(card);
      track.appendChild(copy);
      set.push(copy);
    });
    width = setWidth();
  }
  set.forEach((card) => track.appendChild(cloneCard(card)));

  track.style.setProperty('--marquee-shift', `${width}px`);
  track.style.setProperty('--marquee-duration', `${Math.max(20, Math.round(width / SPEED))}s`);
  marquee.classList.add('is-running');
}

/**
 * Shows the given cards as an endless strip inside `track`.
 * @param {HTMLElement} track - the .results-track element
 * @param {HTMLElement[]} cards - freshly built cards
 */
export function mountMarquee(track, cards) {
  if (!track) return;
  originals.set(track, cards);
  layout(track);
  setupOnce(track);
}

/* ─────────────────────────── behaviour ─────────────────────────── */

function setupOnce(track) {
  const marquee = track.closest('.results-marquee');
  if (!marquee || marquee.dataset.ready) return;
  marquee.dataset.ready = '1';

  // card widths follow the screen: measure again after a resize
  let resizeTimer = null;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;   // mobile toolbars change the height only
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => layout(track), 200);
  });
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => layout(track));

  // no work while nobody can see it
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      marquee.classList.toggle('is-offscreen', !entry.isIntersecting);
    }).observe(marquee);
  }

  // an image that will not load: try Firebase's media form once, then a placeholder
  track.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (!img.dataset.retried && !img.src.includes('alt=media')) {
      img.dataset.retried = '1';
      img.src = img.src + (img.src.includes('?') ? '&' : '?') + 'alt=media';
    } else if (!img.src.endsWith('placeholder.svg')) {
      img.src = './image/placeholder.svg';
    }
  }, true);

  setupLens(marquee);
  setupLightbox(marquee);
}

/* The lens: a circle showing the picture ZOOM times larger around the cursor.
   Mouse only — a finger has no hover, so on touch screens a tap opens the
   certificate instead. */
function setupLens(marquee) {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const lens = document.createElement('span');
  lens.className = 'zoom-lens';
  lens.setAttribute('aria-hidden', 'true');
  let photo = null;
  let pointer = null;
  let frame = 0;
  let shownSrc = '';

  const hide = () => {
    lens.classList.remove('on');
    photo = null;
  };

  const draw = () => {
    frame = 0;
    if (!photo || !pointer) return;
    const img = photo.querySelector('img');
    if (!img || !img.naturalWidth || img.src.endsWith('placeholder.svg')) { lens.classList.remove('on'); return; }

    // where the picture really is inside its frame (object-fit: contain)
    const box = img.getBoundingClientRect();
    const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const ix = pointer.x - box.left - (box.width - w) / 2;
    const iy = pointer.y - box.top - (box.height - h) / 2;
    if (ix < 0 || iy < 0 || ix > w || iy > h) { lens.classList.remove('on'); return; }

    const frameBox = photo.getBoundingClientRect();
    const size = lens.offsetWidth || 170;
    const src = img.currentSrc || img.src;
    if (src !== shownSrc) {
      lens.style.backgroundImage = `url("${src.replace(/"/g, '%22')}")`;
      shownSrc = src;
    }
    lens.style.backgroundSize = `${w * ZOOM}px ${h * ZOOM}px`;
    lens.style.backgroundPosition = `${size / 2 - ix * ZOOM}px ${size / 2 - iy * ZOOM}px`;
    lens.style.transform = `translate3d(${pointer.x - frameBox.left - size / 2}px, ${pointer.y - frameBox.top - size / 2}px, 0)`;
    lens.classList.add('on');
  };

  marquee.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    const hit = e.target.closest?.('.result-photo');
    if (!hit) { hide(); return; }
    if (hit !== photo) {
      photo = hit;
      photo.appendChild(lens);
    }
    pointer = { x: e.clientX, y: e.clientY };
    if (!frame) frame = requestAnimationFrame(draw);
  });
  marquee.addEventListener('pointerleave', hide);
}

/* The certificate, large. A native <dialog>: focus and Esc work by themselves.
   Clicking the picture toggles a closer look at that spot. */
function setupLightbox(marquee) {
  const dialog = document.getElementById('resultLightbox');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const img = dialog.querySelector('img');
  const name = dialog.querySelector('#resultLightboxName');
  const meta = dialog.querySelector('.result-lightbox-meta');

  marquee.addEventListener('click', (e) => {
    const button = e.target.closest('.result-photo');
    if (!button) return;
    const card = button.closest('.result-card');
    const source = button.querySelector('img');
    img.classList.remove('zoomed');
    img.src = source.currentSrc || source.src;
    img.alt = card.dataset.name ? `IELTS result of ${card.dataset.name}` : 'IELTS result';
    name.textContent = card.dataset.name || '';
    // the card's own group line, already in the visitor's language
    const groupLine = card.querySelector('.result-group')?.textContent.trim();
    meta.textContent = [card.dataset.band && `IELTS ${card.dataset.band}`, card.dataset.group && groupLine].filter(Boolean).join(' · ');
    dialog.showModal();
  });

  dialog.querySelector('.result-lightbox-close').addEventListener('click', () => dialog.close());
  // a click on the dark backdrop (the dialog itself, outside its content) closes it
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  img.addEventListener('click', (e) => {
    const r = img.getBoundingClientRect();
    img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    img.classList.toggle('zoomed');
  });
  dialog.addEventListener('close', () => img.classList.remove('zoomed'));
}
