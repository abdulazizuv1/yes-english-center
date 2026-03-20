/**
 * Edit paths configuration for each test type.
 * Maps dashboard test types to their external edit page URLs.
 * This is the single source of truth for all edit page redirects.
 */
const EDIT_PATHS = {
    listening: '/settings/admin/tests/edit/listening/editListening/index',
    reading:   '/settings/admin/tests/edit/reading/editReading/index',
    writing:   '/settings/admin/tests/edit/writing/editWriting/index',
};

/**
 * Build the full edit URL for a test.
 * @param {string} type - Test type (listening, reading, writing)
 * @param {string} testId - Firestore document ID (e.g. "test-1")
 * @returns {string} Full URL with testId query parameter
 */
export function getEditUrl(type, testId) {
    const basePath = EDIT_PATHS[type];
    if (!basePath) {
        console.warn(`Unknown test type: ${type}`);
        return '#';
    }
    return `${basePath}?testId=${encodeURIComponent(testId)}`;
}

/**
 * Get the dashboard route for managing tests of a given type.
 * Used by external edit pages to navigate back.
 * @param {string} type - Test type
 * @returns {string} Dashboard hash route
 */
export function getDashboardManageRoute(type) {
    return `/pages/dashboard/#/admin/tests/${type}`;
}

export default EDIT_PATHS;
