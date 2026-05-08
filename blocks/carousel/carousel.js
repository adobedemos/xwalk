import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const DEFAULT_AUTOPLAY_INTERVAL = 5000;

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
 * @param {number} interval milliseconds between transitions
 * @param {boolean} pauseOnHover whether to pause when hovered/focused
 */
function initAutoplay(advance, container, interval = DEFAULT_AUTOPLAY_INTERVAL, pauseOnHover = true) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return null;

  let timer = null;

  const start = () => {
    if (timer) return;
    timer = setInterval(advance, interval);
  };

  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  if (pauseOnHover) {
    container.addEventListener('mouseenter', stop);
    container.addEventListener('mouseleave', start);
    container.addEventListener('focusin', stop);
    container.addEventListener('focusout', start);
  }

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
 * Reads block-level config authored via the Universal Editor model.
 * AEM Edge Delivery Services serialises model fields as data-* attributes on the block element.
 * @param {HTMLElement} block
 * @returns {{ autoplay: boolean, autoplayInterval: number, loop: boolean, showArrows: boolean, showDots: boolean, pauseOnHover: boolean }}
 */
function readConfig(block) {
  const bool = (attr, fallback) => {
    const val = block.dataset[attr];
    if (val === undefined || val === '') return fallback;
    return val !== 'false' && val !== '0';
  };
  const num = (attr, fallback) => {
    const val = parseInt(block.dataset[attr], 10);
    return Number.isFinite(val) && val > 0 ? val : fallback;
  };

  return {
    /* Also respect the legacy CSS-class-based approach ("autoplay" modifier class) */
    autoplay: bool('autoplay', block.classList.contains('autoplay')),
    autoplayInterval: num('autoplayInterval', DEFAULT_AUTOPLAY_INTERVAL),
    loop: bool('loop', true),
    showArrows: bool('showArrows', true),
    showDots: bool('showDots', true),
    pauseOnHover: bool('pauseOnHover', true),
  };
}

/**
 * Decorates the carousel block.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const config = readConfig(block);

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

    /* Separate image div(s) from content div(s) */
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'carousel-slide-content';

    [...row.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'carousel-slide-image';
        slide.append(div);
      } else {
        /* Move all children of this div into the shared content wrapper */
        while (div.firstChild) {
          contentWrapper.append(div.firstChild);
        }
      }
    });

    /* Wrap any CTA anchors (button-decorated links) in a cta container */
    const ctaLinks = [
      ...contentWrapper.querySelectorAll('a.button'),
      ...([...contentWrapper.querySelectorAll('p')].filter((p) => {
        const links = p.querySelectorAll('a');
        return links.length === 1 && p.textContent.trim() === links[0].textContent.trim();
      }).map((p) => p.querySelector('a'))),
    ];
    /* deduplicate */
    const uniqueCtas = [...new Set(ctaLinks)];
    if (uniqueCtas.length) {
      const ctaEl = document.createElement('div');
      ctaEl.className = 'carousel-slide-cta';
      uniqueCtas.forEach((a) => {
        const parent = a.parentElement;
        if (parent && parent.tagName === 'P' && parent.textContent.trim() === a.textContent.trim()) {
          ctaEl.append(a);
          parent.remove();
        } else {
          ctaEl.append(a);
        }
      });
      contentWrapper.append(ctaEl);
    }

    slide.append(contentWrapper);

    track.append(slide);
  });

  /* ── Optimise images ───────────────────────────────────────────── */
  track.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '1200' }], {
      width: img.getAttribute('width'),
      height: img.getAttribute('height'),
    });
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });

  const total = track.children.length;

  /* ── Wrapper ───────────────────────────────────────────────────── */
  const wrapper = document.createElement('div');
  wrapper.className = 'carousel-wrapper';
  block.style.setProperty('--carousel-slide-count', total);

  /* ── Navigation buttons ────────────────────────────────────────── */
  const prevBtn = config.showArrows ? createArrowButton('prev') : null;
  const nextBtn = config.showArrows ? createArrowButton('next') : null;

  /* ── Dots ──────────────────────────────────────────────────────── */
  const dotsEl = (total > 1 && config.showDots) ? createDots(total) : null;

  /* ── Navigation helpers ────────────────────────────────────────── */
  const current = () => parseInt(track.dataset.current, 10);
  const advance = () => goToSlide(track, dotsEl, current() + 1);
  const retreat = () => goToSlide(track, dotsEl, current() - 1);

  if (prevBtn) prevBtn.addEventListener('click', retreat);
  if (nextBtn) nextBtn.addEventListener('click', advance);

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
  if (config.autoplay && total > 1) {
    initAutoplay(advance, wrapper, config.autoplayInterval, config.pauseOnHover);
  }

  /* ── Assemble ──────────────────────────────────────────────────── */
  const wrapperChildren = [track];
  if (prevBtn) wrapperChildren.unshift(prevBtn);
  if (nextBtn) wrapperChildren.push(nextBtn);
  wrapper.append(...wrapperChildren);
  block.replaceChildren(wrapper);
  if (dotsEl) block.append(dotsEl);
}
