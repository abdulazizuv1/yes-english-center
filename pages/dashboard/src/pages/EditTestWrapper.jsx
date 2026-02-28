import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getEditUrl } from '../config/editPaths';

/**
 * EditTestWrapper — dashboard route component that redirects
 * to the correct external edit page with testId in the URL.
 *
 * Route: /admin/tests/edit/:type/:testId
 *
 * Example:
 *   /admin/tests/edit/reading/test-1
 *   → redirects to /settings/admin/tests/edit/reading/editReading/index.html?testId=test-1
 */
export default function EditTestWrapper() {
    const { type, testId } = useParams();

    useEffect(() => {
        if (type && testId) {
            const editUrl = getEditUrl(type, testId);
            // Navigate to the external edit page (full page reload)
            window.location.href = editUrl;
        }
    }, [type, testId]);

    return (
        <div className="loading-container" style={{ height: '60vh' }}>
            <div className="spinner" />
            <span>Opening {type} test editor...</span>
        </div>
    );
}
