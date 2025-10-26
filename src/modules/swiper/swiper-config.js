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
  0: { slidesPerView: 1, spaceBetween: 20 },
  769: { slidesPerView: 2, spaceBetween: 25 },
  1024: { slidesPerView: 3, spaceBetween: 30 },
};

/**
 * Create and initialize a Swiper instance
 * @param {string} selector - CSS selector for Swiper container
 * @param {Object} customOptions - Custom Swiper options
 * @returns {Swiper|null} Swiper instance or null if container not found
 */
export function createSwiper(selector, customOptions = {}) {
  const container = document.querySelector(selector);
  if (!container) {
    console.warn(`Swiper container not found: ${selector}`);
    return null;
  }

  // Default options
  const defaultOptions = {
    slidesPerView: 3,
    spaceBetween: 30,
    freeMode: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    breakpoints: defaultBreakpoints
  };

  // Merge custom options with defaults
  const options = { ...defaultOptions, ...customOptions };

  try {
    const swiper = new Swiper(selector, options);
    swiperInstances[selector] = swiper;
    console.log(`✅ Swiper initialized: ${selector}`);
    return swiper;
  } catch (error) {
    console.error(`Error creating Swiper for ${selector}:`, error);
    return null;
  }
}

/**
 * Initialize Groups Swiper
 * @returns {Swiper|null}
 */
export function initGroupsSwiper() {
  return createSwiper(".mySwiper", {
    slidesPerView: 3,
    spaceBetween: 30,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
  });
}

/**
 * Initialize Results Swiper
 * @returns {Swiper|null}
 */
export function initResultsSwiper() {
  return createSwiper(".mySwiper3", {
    slidesPerView: 3,
    spaceBetween: 30,
    autoplay: {
      delay: 6000,
      disableOnInteraction: false,
    },
  });
}

/**
 * Initialize Feedbacks Swiper
 * @returns {Swiper|null}
 */
export function initFeedbacksSwiper() {
  return createSwiper(".mySwiper2", {
    slidesPerView: 2,
    spaceBetween: 30,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    breakpoints: {
      0: { slidesPerView: 1, spaceBetween: 20 },
      769: { slidesPerView: 2, spaceBetween: 30 },
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
    results: initResultsSwiper(),
    feedbacks: initFeedbacksSwiper(),
  };

  console.log('✅ All Swipers initialized');
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
    console.log(`🔄 Swiper updated: ${selector}`);
  } else {
    console.warn(`Swiper not found or cannot be updated: ${selector}`);
  }
}

/**
 * Update all Swiper instances
 */
export function updateAllSwipers() {
  Object.keys(swiperInstances).forEach(selector => {
    updateSwiper(selector);
  });
  console.log('🔄 All Swipers updated');
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
    console.log(`🗑️ Swiper destroyed: ${selector}`);
  }
}

/**
 * Destroy all Swiper instances
 */
export function destroyAllSwipers() {
  Object.keys(swiperInstances).forEach(selector => {
    destroySwiper(selector);
  });
  console.log('🗑️ All Swipers destroyed');
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
    console.log(`⏸️ Autoplay paused: ${selector}`);
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
    console.log(`▶️ Autoplay resumed: ${selector}`);
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

