/**
 * IndexedDB Cache Module
 * Provides persistent caching between sessions
 * @module cache/indexeddb
 */

const DB_NAME = 'YES_DATA_CACHE';
const DB_VERSION = 1;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const STORE_NAME = 'data';

/**
 * Initialize IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Get data from IndexedDB cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached data or null if not found/expired
 */
export async function getFromCache(key) {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && (Date.now() - result.timestamp < CACHE_DURATION)) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        console.error(`Error reading cache for "${key}":`, request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error('IndexedDB error:', error);
    return null;
  }
}

/**
 * Save data to IndexedDB cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @returns {Promise<void>}
 */
export async function saveToCache(key, data) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ 
        data, 
        timestamp: Date.now() 
      }, key);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        console.error(`Error saving cache for "${key}":`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB save error:', error);
  }
}

/**
 * Clear specific cache entry
 * @param {string} key - Cache key to clear
 * @returns {Promise<void>}
 */
export async function clearCache(key) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Clear all cache entries
 * @returns {Promise<void>}
 */
export async function clearAllCache() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
}

/**
 * Check if cache exists and is valid
 * @param {string} key - Cache key
 * @returns {Promise<boolean>}
 */
export async function isCacheValid(key) {
  const data = await getFromCache(key);
  return data !== null;
}

export default {
  initDB,
  getFromCache,
  saveToCache,
  clearCache,
  clearAllCache,
  isCacheValid
};

