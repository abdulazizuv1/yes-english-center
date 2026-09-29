/**
 * Swiper Configuration Module
 * Manages Swiper slider initialization and updates
 * @module swiper/swiper-config
 */

/**
 * Storage for Swiper instances
 * @type {Object.<string, Swiper>}
 */
const swiperInstances = {};

/**
 * Default responsive breakpoints
 */
const defaultBreakpoints = {
  0: { slidesPerView: 1.08, spaceBetween: 16 },
  640: { slidesPerView: 2, spaceBetween: 20 },
  1024: { slidesPerView: 3, spaceBetween: 24 },
};

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The arrows and progress bar that sit under a slider
 * (the .slider-controls block right after it in index.html).
 */
function controlsFor(container) {
  const controls = container.nextElementSibling;
  if (!controls || !controls.classList.contains('slider-controls')) return {};
  return {
    navigation: {
      prevEl: controls.querySelector('.slider-prev'),
      nextEl: controls.querySelector('.slider-next'),
    },
    pagination: {
      el: controls.querySelector('.slider-progress'),
      type: 'progressbar',
    },
  };
}

/**
 * Create and initialize a Swiper instance
 * @param {string} selector - CSS selector for Swiper container
 * @param {Object} customOptions - Custom Swiper options
 * @returns {Swiper|null} Swiper instance or null if container not found
 */
export function createSwiper(selector, customOptions = {}) {
  const container = document.querySelector(selector);
  if (!container) {
    return null;
  }

  // Snaps to whole cards (free-mode used to stop mid-card), rewinds at the
  // end, and waits while the visitor is reading or hovering.
  const defaultOptions = {
    speed: 650,
    spaceBetween: 24,
    grabCursor: true,
    rewind: true,
    watchOverflow: true,
    centerInsufficientSlides: true,
    keyboard: { enabled: true, onlyInViewport: true },
    a11y: { enabled: true, prevSlideMessage: 'Previous', nextSlideMessage: 'Next' },
    autoplay: reduceMotion()
      ? false
      : { delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true },
    breakpoints: defaultBreakpoints,
    ...controlsFor(container),
  };

  const options = { ...defaultOptions, ...customOptions };

  try {
    const swiper = new Swiper(selector, options);
    swiperInstances[selector] = swiper;
    return swiper;
  } catch (error) {
    return null;
  }
}

/**
 * Initialize Groups Swiper
 * @returns {Swiper|null}
 */
export function initGroupsSwiper() {
  return createSwiper(".mySwiper");
}

/**
 * The results no longer use a slider: they scroll continuously (ui/marquee.js).
 * @returns {null}
 */
export function initResultsSwiper() {
  return null;
}

/**
 * Initialize Feedbacks Swiper
 * @returns {Swiper|null}
 */
export function initFeedbacksSwiper() {
  return createSwiper(".mySwiper2", {
    autoplay: reduceMotion()
      ? false
      : { delay: 7000, disableOnInteraction: false, pauseOnMouseEnter: true },
    breakpoints: {
      0: { slidesPerView: 1, spaceBetween: 16 },
      769: { slidesPerView: 2, spaceBetween: 24 },
    },
  });
}

/**
 * Initialize all Swipers
 * @returns {Object} Object containing all Swiper instances
 */
export function initAllSwipers() {
  const swipers = {
    groups: initGroupsSwiper(),
    feedbacks: initFeedbacksSwiper(),
  };

  return swipers;
}

/**
 * Update a specific Swiper instance
 * @param {string} selector - CSS selector for Swiper container
 */
export function updateSwiper(selector) {
  const swiper = swiperInstances[selector];
  if (swiper && swiper.update) {
    swiper.update();
  }
}

/**
 * Update all Swiper instances
 */
export function updateAllSwipers() {
  Object.keys(swiperInstances).forEach(selector => {
    updateSwiper(selector);
  });
}

/**
 * Destroy a specific Swiper instance
 * @param {string} selector - CSS selector for Swiper container
 */
export function destroySwiper(selector) {
  const swiper = swiperInstances[selector];
  if (swiper && swiper.destroy) {
    swiper.destroy(true, true);
    delete swiperInstances[selector];
  }
}

/**
 * Destroy all Swiper instances
 */
export function destroyAllSwipers() {
  Object.keys(swiperInstances).forEach(selector => {
    destroySwiper(selector);
  });
}

/**
 * Get Swiper instance by selector
 * @param {string} selector - CSS selector for Swiper container
 * @returns {Swiper|null}
 */
export function getSwiperInstance(selector) {
  return swiperInstances[selector] || null;
}

/**
 * Get all Swiper instances
 * @returns {Object.<string, Swiper>}
 */
export function getAllSwiperInstances() {
  return swiperInstances;
}

/**
 * Pause autoplay for a specific Swiper
 * @param {string} selector - CSS selector for Swiper container
 */
export function pauseAutoplay(selector) {
  const swiper = swiperInstances[selector];
  if (swiper && swiper.autoplay) {
    swiper.autoplay.stop();
  }
}

/**
 * Resume autoplay for a specific Swiper
 * @param {string} selector - CSS selector for Swiper container
 */
export function resumeAutoplay(selector) {
  const swiper = swiperInstances[selector];
  if (swiper && swiper.autoplay) {
    swiper.autoplay.start();
  }
}

export default {
  createSwiper,
  initGroupsSwiper,
  initResultsSwiper,
  initFeedbacksSwiper,
  initAllSwipers,
  updateSwiper,
  updateAllSwipers,
  destroySwiper,
  destroyAllSwipers,
  getSwiperInstance,
  getAllSwiperInstances,
  pauseAutoplay,
  resumeAutoplay
};

