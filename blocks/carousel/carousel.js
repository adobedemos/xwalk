import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const AUTOPLAY_INTERVAL = 5000;

/**
 * Creates an SVG arrow icon element.
 * @param {string} direction 'prev' or 'next'
 * @returns {HTMLElement}
 */
function createArrowButton(direction) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `carousel-nav-btn carousel-nav-${direction}`;
  button.setAttribute('aria-label', direction === 'prev' ? 'Previous slide' : 'Next slide');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    direction === 'prev'
      ? 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z'
      : 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  );
  svg.append(path);
  button.append(svg);
  return button;
}

/**
 * Builds the dots indicator list.
 * @param {number} count total slide count
 * @returns {HTMLElement}
 */
function createDots(count) {
  const nav = document.createElement('div');
  nav.className = 'carousel-dots';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Slide indicators');

  for (let i = 0; i < count; i += 1) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.dataset.index = String(i);
    nav.append(dot);
  }
  return nav;
}

/**
 * Updates the active state of slides and dots.
 * @param {HTMLElement} track the slides track element
 * @param {HTMLElement} dotsEl the dots container
 * @param {number} index target slide index
 */
function goToSlide(track, dotsEl, index) {
  const slides = [...track.children];
  const total = slides.length;
  const safeIndex = ((index % total) + total) % total;

  slides.forEach((slide, i) => {
    const active = i === safeIndex;
    slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    slide.classList.toggle('is-active', active);
  });

  track.style.transform = `translateX(-${safeIndex * 100}%)`;

  if (dotsEl) {
    [...dotsEl.querySelectorAll('.carousel-dot')].forEach((dot, i) => {
      const active = i === safeIndex;
      dot.setAttribute('aria-selected', active ? 'true' : 'false');
      dot.classList.toggle('is-active', active);
    });
  }

  track.dataset.current = String(safeIndex);
}

/**
 * Initialises autoplay and returns a controller object.
 * @param {Function} advance function that advances to the next slide
 * @param {HTMLElement} container outer carousel element
 */
function initAutoplay(advance, container) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return null;

  let timer = null;

  const start = () => {
    if (timer) return;
    timer = setInterval(advance, AUTOPLAY_INTERVAL);
  };

  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  container.addEventListener('mouseenter', stop);
  container.addEventListener('mouseleave', start);
  container.addEventListener('focusin', stop);
  container.addEventListener('focusout', start);

  start();
  return { start, stop };
}

/**
 * Adds touch/swipe support.
 * @param {HTMLElement} track slides track element
 * @param {Function} prev go-to-previous callback
 * @param {Function} next go-to-next callback
 */
function initTouch(track, prev, next) {
  let startX = 0;
  let startY = 0;
  let dragging = false;

  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true;
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
  }, { passive: true });
}

/**
 * Decorates the carousel block.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const hasAutoplay = block.classList.contains('autoplay');

  /* ── Build slide list ──────────────────────────────────────────── */
  const track = document.createElement('ul');
  track.className = 'carousel-track';
  track.setAttribute('role', 'list');
  track.dataset.current = '0';

  [...block.children].forEach((row, i) => {
    const slide = document.createElement('li');
    slide.className = 'carousel-slide';
    slide.setAttribute('role', 'listitem');
    slide.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    if (i === 0) slide.classList.add('is-active');
    moveInstrumentation(row, slide);

    /* Split children into image vs content */
    [...row.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'carousel-slide-image';
      } else {
        div.className = 'carousel-slide-content';
      }
      slide.append(div);
    });

    track.append(slide);
  });

  /* ── Optimise images ───────────────────────────────────────────── */
  track.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '1200' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });

  const total = track.children.length;

  /* ── Wrapper ───────────────────────────────────────────────────── */
  const wrapper = document.createElement('div');
  wrapper.className = 'carousel-wrapper';
  block.style.setProperty('--carousel-slide-count', total);

  /* ── Navigation buttons ────────────────────────────────────────── */
  const prevBtn = createArrowButton('prev');
  const nextBtn = createArrowButton('next');

  /* ── Dots ──────────────────────────────────────────────────────── */
  const dotsEl = total > 1 ? createDots(total) : null;

  /* ── Navigation helpers ────────────────────────────────────────── */
  const current = () => parseInt(track.dataset.current, 10);
  const advance = () => goToSlide(track, dotsEl, current() + 1);
  const retreat = () => goToSlide(track, dotsEl, current() - 1);

  prevBtn.addEventListener('click', retreat);
  nextBtn.addEventListener('click', advance);

  if (dotsEl) {
    dotsEl.querySelectorAll('.carousel-dot').forEach((dot) => {
      dot.addEventListener('click', () => goToSlide(track, dotsEl, parseInt(dot.dataset.index, 10)));
    });
  }

  /* ── Keyboard ──────────────────────────────────────────────────── */
  wrapper.setAttribute('tabindex', '0');
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); retreat(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); advance(); }
  });

  /* ── Touch ─────────────────────────────────────────────────────── */
  initTouch(track, retreat, advance);

  /* ── Autoplay ──────────────────────────────────────────────────── */
  if (hasAutoplay && total > 1) {
    initAutoplay(advance, wrapper);
  }

  /* ── Assemble ──────────────────────────────────────────────────── */
  wrapper.append(prevBtn, track, nextBtn);
  block.replaceChildren(wrapper);
  if (dotsEl) block.append(dotsEl);
}
