import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Shield, BookOpen, Headphones, PenTool, Users, Database, Layers, ExternalLink, Plus, Edit3 } from 'lucide-react';
import './AdminSettings.css';

const TEST_SECTIONS = [
    {
        type: 'listening',
        icon: Headphones,
        color: '#8b5cf6',
        addUrl: '/settings/admin/tests/add/listening/index.html',
        manageRoute: '/admin/tests/listening',
    },
    {
        type: 'reading',
        icon: BookOpen,
        color: '#3b82f6',
        addUrl: '/settings/admin/tests/add/reading/index.html',
        manageRoute: '/admin/tests/reading',
    },
    {
        type: 'writing',
        icon: PenTool,
        color: '#10b981',
        addUrl: '/settings/admin/tests/add/writing/index.html',
        manageRoute: '/admin/tests/writing',
    },
];

export default function AdminSettings() {
    const { isAdmin } = useAuth();

    if (!isAdmin) return <Navigate to="/" replace />;

    return (
        <div className="admin-page page-enter">
            <div className="admin-header">
                <Shield size={28} className="admin-icon" />
                <div>
                    <h2>Admin Settings</h2>
                    <p>Manage tests, users, and system settings</p>
                </div>
            </div>

            {/* Test Management */}
            <section className="admin-section">
                <h3 className="admin-section-title">📝 Test Management</h3>
                <div className="admin-grid">
                    {TEST_SECTIONS.map(({ type, icon: Icon, color, addUrl, manageRoute }) => (
                        <div key={type} className="admin-card glass-card">
                            <div className="admin-card-header">
                                <div className="admin-card-icon" style={{ background: color }}>
                                    <Icon size={20} color="#fff" />
                                </div>
                                <h4>{type.charAt(0).toUpperCase() + type.slice(1)} Tests</h4>
                            </div>
                            <div className="admin-card-actions">
                                <a href={addUrl} className="admin-action-btn add">
                                    <Plus size={16} /> Add New
                                </a>
                                <Link to={manageRoute} className="admin-action-btn edit">
                                    <Edit3 size={16} /> Manage
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Management Links */}
            <section className="admin-section">
                <h3 className="admin-section-title">⚙️ System Management</h3>
                <div className="management-list">
                    <Link to="/admin/users" className="management-item glass-card">
                        <div className="management-icon"><Users size={22} /></div>
                        <div className="management-info">
                            <span className="management-label">Manage Users & Data</span>
                            <span className="management-desc">Create, delete users, groups, results, feedback</span>
                        </div>
                        <ExternalLink size={16} className="management-arrow" />
                    </Link>
                </div>
            </section>
        </div>
    );
}
