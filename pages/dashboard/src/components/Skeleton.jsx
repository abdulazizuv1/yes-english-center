import './Skeleton.css';

/**
 * Skeleton pulse block — used during loading states
 * @param {'text'|'title'|'card'|'circle'|'stat'|'row'|'image'} variant
 */
export function Skeleton({ variant = 'text', width, height, style, className = '' }) {
    return (
        <div
            className={`skeleton skeleton-${variant} ${className}`}
            style={{ width, height, ...style }}
        />
    );
}

/** Skeleton for Home page (Dashboard Redesign) */
export function HomeSkeleton() {
    return (
        <div className="skeleton-home">
            <div className="skeleton-header-top">
                <Skeleton variant="title" width={180} height={32} />
                <Skeleton variant="text" width={240} height={16} style={{ marginTop: 8 }} />
            </div>

            {/* Stats row */}
            <div className="skeleton-stats-grid">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton-stat-card redesign-skeleton glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <Skeleton variant="text" width={80} height={16} />
                            <Skeleton variant="circle" width={32} height={32} />
                        </div>
                        <Skeleton variant="title" width={60} height={32} />
                        <Skeleton variant="text" width={100} height={14} style={{ marginTop: 8 }} />
                    </div>
                ))}
            </div>

            {/* Bottom Grid */}
            <div className="skeleton-bottom-grid">
                <div className="skeleton-activity-section glass-card redesign-skeleton">
                    <Skeleton variant="title" width={120} height={24} />
                    <Skeleton variant="card" height={200} style={{ marginTop: 24 }} />
                </div>
                <div className="skeleton-target-section glass-card redesign-skeleton">
                    <Skeleton variant="title" width={140} height={24} />
                    <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <Skeleton variant="text" width="100%" height={24} />
                        <Skeleton variant="text" width="100%" height={24} />
                        <Skeleton variant="text" width="100%" height={32} style={{ marginTop: 16 }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Skeleton for Test Section page */
export function TestListSkeleton() {
    return (
        <div className="skeleton-test-list">
            {[...Array(16)].map((_, i) => (
                <div key={i} className="skeleton-test-card glass-card">
                    <div className="skeleton-test-header">
                        <Skeleton variant="circle" width={40} height={40} />
                        <div style={{ flex: 1 }}>
                            <Skeleton variant="text" width="60%" height={16} />
                            <Skeleton variant="text" width="40%" height={12} style={{ marginTop: 6 }} />
                        </div>
                        <Skeleton variant="text" width={18} height={18} />
                    </div>
                    <Skeleton variant="text" width="80%" height={13} style={{ marginTop: 12 }} />
                    <div style={{ marginTop: 12 }}>
                        <Skeleton variant="text" width="50%" height={14} />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Skeleton for Manage Tests page */
export function ManageTestsSkeleton() {
    return (
        <div className="skeleton-manage-tests">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton-manage-card glass-card">
                    <div className="skeleton-manage-header">
                        <Skeleton variant="circle" width={36} height={36} />
                        <div style={{ flex: 1 }}>
                            <Skeleton variant="text" width="55%" height={16} />
                            <Skeleton variant="text" width="35%" height={12} style={{ marginTop: 6 }} />
                        </div>
                    </div>
                    <div className="skeleton-manage-meta">
                        <Skeleton variant="text" width={80} height={22} style={{ borderRadius: 8 }} />
                        <Skeleton variant="text" width={80} height={22} style={{ borderRadius: 8 }} />
                    </div>
                    <div className="skeleton-manage-actions">
                        <Skeleton variant="text" width={80} height={32} style={{ borderRadius: 8 }} />
                        <Skeleton variant="text" width={80} height={32} style={{ borderRadius: 8 }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Skeleton for Manage Users page */
export function ManageUsersSkeleton() {
    return (
        <div className="skeleton-manage-users">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton-user-row glass-card">
                    <Skeleton variant="circle" width={40} height={40} />
                    <div style={{ flex: 1 }}>
                        <Skeleton variant="text" width="45%" height={15} />
                        <Skeleton variant="text" width="60%" height={12} style={{ marginTop: 6 }} />
                    </div>
                    <Skeleton variant="text" width={60} height={24} style={{ borderRadius: 12 }} />
                    <Skeleton variant="text" width={32} height={32} style={{ borderRadius: 8 }} />
                </div>
            ))}
        </div>
    );
}
