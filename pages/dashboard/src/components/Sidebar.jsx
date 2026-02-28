import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Home, Headphones, BookOpen, PenTool, FileText,
    Settings, Shield, LogOut, X, MessageSquare
} from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/listening', icon: Headphones, label: 'Listening' },
    { to: '/reading', icon: BookOpen, label: 'Reading' },
    { to: '/writing', icon: PenTool, label: 'Writing' },
    { to: '/fullmock', icon: FileText, label: 'Full Mock' },
];

export default function Sidebar({ isOpen, onClose }) {
    const { userData, isAdmin, logout } = useAuth();
    const location = useLocation();

    return (
        <>
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                {/* Header */}
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <div className="brand-icon" style={{ width: '150px', height: '56px', background: 'transparent', padding: '0 8px' }}>
                           <a href="/"> <img src="/image/logo.png" alt="YES English Center" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></a>
                        </div>
                    </div>
                    <button className="sidebar-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    <div className="nav-label">Main</div>
                    {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            onClick={onClose}
                        >
                            <Icon size={20} />
                            <span>{label}</span>
                        </NavLink>
                    ))}

                    <div className="nav-divider" />
                    <div className="nav-label">Other</div>

                    <NavLink
                        to="/feedback"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        onClick={onClose}
                    >
                        <MessageSquare size={20} />
                        <span>Feedback</span>
                    </NavLink>

                    <div className="nav-divider" />
                    <div className="nav-label">Account</div>

                    <NavLink
                        to="/settings"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        onClick={onClose}
                    >
                        <Settings size={20} />
                        <span>My Settings</span>
                    </NavLink>

                    {isAdmin && (
                        <NavLink
                            to="/admin"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            onClick={onClose}
                        >
                            <Shield size={20} />
                            <span>Admin Settings</span>
                        </NavLink>
                    )}
                </nav>

                {/* Footer */}
                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="user-avatar">
                            {(userData?.name || 'U')[0].toUpperCase()}
                        </div>
                        <div className="user-info">
                            <span className="user-name">{userData?.name || 'User'}</span>
                            <span className="user-role">{userData?.role || 'student'}</span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={logout}>
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
