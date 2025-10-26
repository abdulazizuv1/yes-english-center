/**
 * Utilities Module
 * Helper functions and utilities
 * @module utils/helpers
 */

/**
 * Hide loader element
 */
export function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), 500);
    console.log('✅ Loader hidden');
  }
}

/**
 * Show loader element
 */
export function showLoader() {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.classList.remove("hidden");
    loader.style.display = 'flex';
    console.log('👁️ Loader shown');
  }
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit time in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Wait for a specified time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format timestamp to readable date
 * @param {number|Date} timestamp - Timestamp or Date object
 * @returns {string} Formatted date string
 */
export function formatDate(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format timestamp to readable time
 * @param {number|Date} timestamp - Timestamp or Date object
 * @returns {string} Formatted time string
 */
export function formatTime(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Check if element is in viewport
 * @param {HTMLElement} element - Element to check
 * @returns {boolean}
 */
export function isInViewport(element) {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Smooth scroll to element
 * @param {string} selector - CSS selector or element ID
 * @param {number} offset - Offset from top (default 80 for navbar)
 */
export function smoothScrollTo(selector, offset = 80) {
  const target = document.querySelector(selector);
  if (!target) {
    console.warn(`Element not found: ${selector}`);
    return;
  }

  const elementPosition = target.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - offset;

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  });
}

/**
 * Generate unique ID
 * @param {string} prefix - Prefix for ID
 * @returns {string} Unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('✅ Copied to clipboard');
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Get query parameter from URL
 * @param {string} param - Parameter name
 * @returns {string|null} Parameter value or null
 */
export function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

/**
 * Set query parameter in URL
 * @param {string} param - Parameter name
 * @param {string} value - Parameter value
 */
export function setQueryParam(param, value) {
  const url = new URL(window.location);
  url.searchParams.set(param, value);
  window.history.pushState({}, '', url);
}

/**
 * Remove query parameter from URL
 * @param {string} param - Parameter name
 */
export function removeQueryParam(param) {
  const url = new URL(window.location);
  url.searchParams.delete(param);
  window.history.pushState({}, '', url);
}

/**
 * Check if device is mobile
 * @returns {boolean}
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if device is iOS
 * @returns {boolean}
 */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Check if device is Android
 * @returns {boolean}
 */
export function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

/**
 * Get browser name
 * @returns {string}
 */
export function getBrowserName() {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Unknown';
}

/**
 * Log with timestamp
 * @param {string} message - Message to log
 * @param {string} type - Log type (info, warn, error)
 */
export function logWithTime(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}]`;
  
  switch (type) {
    case 'warn':
      console.warn(prefix, message);
      break;
    case 'error':
      console.error(prefix, message);
      break;
    default:
      console.log(prefix, message);
  }
}

/**
 * Measure function execution time
 * @param {Function} func - Function to measure
 * @param {string} label - Label for measurement
 * @returns {Function} Wrapped function
 */
export function measureTime(func, label = 'Function') {
  return async function(...args) {
    console.time(`⏱️ ${label}`);
    const result = await func(...args);
    console.timeEnd(`⏱️ ${label}`);
    return result;
  };
}

/**
 * Retry function with exponential backoff
 * @param {Function} func - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Initial delay in milliseconds
 * @returns {Promise<any>}
 */
export async function retry(func, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await func();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const waitTime = delay * Math.pow(2, i);
      console.warn(`Retry ${i + 1}/${maxRetries} after ${waitTime}ms`);
      await wait(waitTime);
    }
  }
}

export default {
  hideLoader,
  showLoader,
  debounce,
  throttle,
  wait,
  formatDate,
  formatTime,
  isInViewport,
  smoothScrollTo,
  generateId,
  copyToClipboard,
  getQueryParam,
  setQueryParam,
  removeQueryParam,
  isMobile,
  isIOS,
  isAndroid,
  getBrowserName,
  logWithTime,
  measureTime,
  retry
};

