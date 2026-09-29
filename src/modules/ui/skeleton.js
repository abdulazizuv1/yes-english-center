/**
 * Skeleton Loader Module
 * Creates loading placeholders for better UX
 * @module ui/skeleton
 */

/**
 * Create a skeleton card element
 * @returns {HTMLElement} Skeleton card element
 */
function createSkeletonCard(className = 'swiper-slide skeleton-card') {
  const skeleton = document.createElement('div');
  skeleton.className = className;
  skeleton.innerHTML = `
    <div class="skeleton-image"></div>
    <div class="skeleton-text"></div>
    <div class="skeleton-text short"></div>
  `;
  return skeleton;
}

/**
 * Show skeleton loaders in a section
 * @param {string} selector - CSS selector for the wrapper element
 * @param {number} count - Number of skeleton cards to show
 */
export function showSkeletons(selector, count = 3, className) {
  const wrapper = document.querySelector(selector);
  if (!wrapper) {
    return;
  }

  // Clear existing content
  wrapper.innerHTML = '';

  // Add skeleton cards
  for (let i = 0; i < count; i++) {
    wrapper.appendChild(createSkeletonCard(className));
  }

}

/**
 * Show skeleton loaders for all sections
 */
export function showAllSkeletons() {
  const sections = [
    { selector: '#groups .swiper-wrapper', count: 3 },
    { selector: '#results .results-track', count: 6, className: 'result-card skeleton-card' },
    { selector: '#feedbacks .swiper-wrapper', count: 2 }
  ];

  sections.forEach(section => {
    showSkeletons(section.selector, section.count, section.className);
  });

}

/**
 * Hide skeleton loaders from a section
 * @param {string} selector - CSS selector for the wrapper element
 */
export function hideSkeletons(selector) {
  const wrapper = document.querySelector(selector);
  if (!wrapper) return;

  // Remove skeleton cards
  const skeletons = wrapper.querySelectorAll('.skeleton-card');
  skeletons.forEach(skeleton => skeleton.remove());

}

/**
 * Hide all skeleton loaders
 */
export function hideAllSkeletons() {
  const selectors = [
    '#groups .swiper-wrapper',
    '#results .results-track',
    '#feedbacks .swiper-wrapper'
  ];

  selectors.forEach(selector => hideSkeletons(selector));

}

/**
 * Replace skeletons with actual content (smooth transition)
 * @param {string} selector - CSS selector for the wrapper element
 * @param {Function} contentRenderer - Function that renders actual content
 */
export async function replaceWithContent(selector, contentRenderer) {
  const wrapper = document.querySelector(selector);
  if (!wrapper) return;

  // Clear skeletons
  wrapper.innerHTML = '';
  
  // Add loaded class for animation
  wrapper.classList.add('loaded');

  // Render actual content
  await contentRenderer(wrapper);
}

export default {
  showSkeletons,
  showAllSkeletons,
  hideSkeletons,
  hideAllSkeletons,
  replaceWithContent
};

