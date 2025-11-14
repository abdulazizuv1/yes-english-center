/**
 * Data Loader Module
 * Handles loading data from Firebase with caching
 * @module data/data-loader
 */

import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import * as memoryCache from './data-cache.js';
import * as indexedDBCache from '../cache/indexeddb.js';

let db = null;

/**
 * Initialize Firebase Firestore
 * @param {Object} firebaseApp - Firebase app instance
 */
export function initFirestore(firebaseApp) {
  db = getFirestore(firebaseApp);
}

/**
 * Generic function to load data with multi-level caching
 * @param {string} collectionName - Firebase collection name
 * @param {string} cacheKey - Cache key
 * @returns {Promise<Array>} Array of documents
 */
async function loadDataWithCache(collectionName, cacheKey) {
  // Level 1: Check memory cache
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached) {
    return memoryCached;
  }

  // Level 2: Check IndexedDB cache
  const indexedDBCached = await indexedDBCache.getFromCache(cacheKey);
  if (indexedDBCached) {
    memoryCache.set(cacheKey, indexedDBCached);
    return indexedDBCached;
  }

  // Level 3: Load from Firebase
  const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  
  const data = [];
  snapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });

  // Save to both caches
  memoryCache.set(cacheKey, data);
  await indexedDBCache.saveToCache(cacheKey, data);

  return data;
}

/**
 * Load groups data
 * @returns {Promise<Array>}
 */
export async function loadGroups() {
  return loadDataWithCache('groups', 'groups');
}

/**
 * Load results data
 * @returns {Promise<Array>}
 */
export async function loadResults() {
  return loadDataWithCache('results', 'results');
}

/**
 * Load feedbacks data
 * @returns {Promise<Array>}
 */
export async function loadFeedbacks() {
  return loadDataWithCache('feedbacks', 'feedbacks');
}

/**
 * Load all data with priority (groups first, then others in parallel)
 * @returns {Promise<Object>} Object with groups, results, and feedbacks
 */
export async function loadAllData() {
  const result = {
    groups: null,
    results: null,
    feedbacks: null,
    errors: {}
  };

  try {
    // Priority: Load groups first (visible on page load)
    console.time('⚡ Groups loading');
    try {
      result.groups = await loadGroups();
      console.timeEnd('⚡ Groups loading');
    } catch (error) {
      console.error('Error loading groups:', error);
      result.errors.groups = error;
    }

    // Load results and feedbacks in parallel
    console.time('⚡ Results & Feedbacks loading');
    const [resultsData, feedbacksData] = await Promise.allSettled([
      loadResults(),
      loadFeedbacks()
    ]);

    if (resultsData.status === 'fulfilled') {
      result.results = resultsData.value;
    } else {
      console.error('Error loading results:', resultsData.reason);
      result.errors.results = resultsData.reason;
    }

    if (feedbacksData.status === 'fulfilled') {
      result.feedbacks = feedbacksData.value;
    } else {
      console.error('Error loading feedbacks:', feedbacksData.reason);
      result.errors.feedbacks = feedbacksData.reason;
    }

    console.timeEnd('⚡ Results & Feedbacks loading');

  } catch (error) {
    console.error('Error loading data:', error);
    result.errors.general = error;
  }

  return result;
}

/**
 * Reload data (clear cache and fetch fresh data)
 * @param {string} dataType - Type of data to reload ('groups', 'results', 'feedbacks', or 'all')
 */
export async function reloadData(dataType = 'all') {
  if (dataType === 'all') {
    memoryCache.clearAll();
    await indexedDBCache.clearAllCache();
    return await loadAllData();
  } else {
    memoryCache.clear(dataType);
    await indexedDBCache.clearCache(dataType);
    
    switch (dataType) {
      case 'groups':
        return await loadGroups();
      case 'results':
        return await loadResults();
      case 'feedbacks':
        return await loadFeedbacks();
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  }
}

export default {
  initFirestore,
  loadGroups,
  loadResults,
  loadFeedbacks,
  loadAllData,
  reloadData
};

