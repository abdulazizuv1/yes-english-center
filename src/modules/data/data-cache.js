/**
 * Data Cache Module
 * In-memory cache for fast data access
 * @module data/data-cache
 */

/**
 * In-memory cache storage
 * @type {Object.<string, any>}
 */
const cache = {
  groups: null,
  results: null,
  feedbacks: null
};

/**
 * Get data from memory cache
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null
 */
export function get(key) {
  return cache[key] || null;
}

/**
 * Set data in memory cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
export function set(key, data) {
  cache[key] = data;
  console.log(`💾 Memory cached: ${key}`);
}

/**
 * Check if key exists in cache
 * @param {string} key - Cache key
 * @returns {boolean}
 */
export function has(key) {
  return cache[key] !== null && cache[key] !== undefined;
}

/**
 * Clear specific cache entry
 * @param {string} key - Cache key
 */
export function clear(key) {
  cache[key] = null;
  console.log(`🗑️ Cleared memory cache: ${key}`);
}

/**
 * Clear all cache
 */
export function clearAll() {
  Object.keys(cache).forEach(key => {
    cache[key] = null;
  });
  console.log('🗑️ Cleared all memory cache');
}

/**
 * Get all cache keys
 * @returns {string[]}
 */
export function keys() {
  return Object.keys(cache);
}

/**
 * Get cache size
 * @returns {number}
 */
export function size() {
  return Object.keys(cache).filter(key => cache[key] !== null).length;
}

export default {
  get,
  set,
  has,
  clear,
  clearAll,
  keys,
  size
};

