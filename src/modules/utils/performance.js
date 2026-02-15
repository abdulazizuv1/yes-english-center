/**
 * Performance Monitoring Module
 * Tracks Web Vitals and performance metrics
 * @module utils/performance
 */

/**
 * Track Largest Contentful Paint (LCP)
 */
export function trackLCP() {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        // LCP should be under 2.5s for good performance
        const lcpValue = lastEntry.renderTime || lastEntry.loadTime;
        
        if (lcpValue) {
          // Track LCP metric
          // Can be sent to analytics service
        }
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // Performance Observer not supported
    }
  }
}

/**
 * Track First Input Delay (FID)
 */
export function trackFID() {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fid = entry.processingStart - entry.startTime;
          
          // FID should be under 100ms for good performance
          if (fid) {
            // Track FID metric
            // Can be sent to analytics service
          }
        });
      });
      
      observer.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // Performance Observer not supported
    }
  }
}

/**
 * Track Cumulative Layout Shift (CLS)
 */
export function trackCLS() {
  if ('PerformanceObserver' in window) {
    try {
      let clsValue = 0;
      let clsEntries = [];
      
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            const lastSessionEntry = clsEntries[clsEntries.length - 1];
            
            if (
              lastSessionEntry &&
              lastSessionEntry.startTime < entry.startTime &&
              lastSessionEntry.startTime + lastSessionEntry.duration > entry.startTime
            ) {
              return;
            }
            
            clsEntries.push(entry);
            clsValue += entry.value;
          }
        });
        
        // CLS should be under 0.1 for good performance
        // Can be sent to analytics service
      });
      
      observer.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // Performance Observer not supported
    }
  }
}

/**
 * Track First Contentful Paint (FCP)
 */
export function trackFCP() {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            const fcp = entry.startTime;
            
            // FCP should be under 1.8s for good performance
            if (fcp) {
              // Track FCP metric
              // Can be sent to analytics service
            }
          }
        });
      });
      
      observer.observe({ entryTypes: ['paint'] });
    } catch (e) {
      // Performance Observer not supported
    }
  }
}

/**
 * Track Time to Interactive (TTI)
 */
export function trackTTI() {
  if ('PerformanceObserver' in window && 'PerformanceTiming' in window.performance) {
    try {
      const timing = window.performance.timing;
      const tti = timing.domInteractive - timing.navigationStart;
      
      // TTI should be under 3.8s for good performance
      if (tti) {
        // Track TTI metric
        // Can be sent to analytics service
      }
    } catch (e) {
      // Performance timing not available
    }
  }
}

/**
 * Get page load performance metrics
 * @returns {Object} Performance metrics
 */
export function getPerformanceMetrics() {
  if (!window.performance || !window.performance.timing) {
    return null;
  }

  const timing = window.performance.timing;
  const navigation = window.performance.navigation;

  return {
    // DNS lookup time
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    
    // TCP connection time
    tcp: timing.connectEnd - timing.connectStart,
    
    // Request time
    request: timing.responseStart - timing.requestStart,
    
    // Response time
    response: timing.responseEnd - timing.responseStart,
    
    // DOM processing time
    domProcessing: timing.domComplete - timing.domLoading,
    
    // Page load time
    pageLoad: timing.loadEventEnd - timing.navigationStart,
    
    // Time to first byte
    ttfb: timing.responseStart - timing.navigationStart,
    
    // Navigation type
    navigationType: navigation.type
  };
}

/**
 * Initialize all performance tracking
 */
export function initPerformanceTracking() {
  // Wait for page to be fully loaded
  if (document.readyState === 'complete') {
    trackLCP();
    trackFID();
    trackCLS();
    trackFCP();
    trackTTI();
  } else {
    window.addEventListener('load', () => {
      trackLCP();
      trackFID();
      trackCLS();
      trackFCP();
      trackTTI();
    });
  }
}

export default {
  trackLCP,
  trackFID,
  trackCLS,
  trackFCP,
  trackTTI,
  getPerformanceMetrics,
  initPerformanceTracking
};
