import { useAuth } from '../context/AuthContext';
import { Menu, Bell } from 'lucide-react';
import './TopBar.css';

export default function TopBar({ onMenuToggle }) {
    const { userData } = useAuth();

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <header className="topbar">
            <div className="topbar-left">
                <button className="menu-toggle" onClick={onMenuToggle}>
                    <Menu size={22} />
                </button>
                <div className="greeting">
                    <h2>{getGreeting()}, <span className="greeting-name">{userData?.name || 'Student'}</span> 👋</h2>
                    <p>Track your IELTS progress and practice tests</p>
                </div>
            </div>
            <div className="topbar-right">
                <div className="topbar-avatar">
                    {(userData?.name || 'U')[0].toUpperCase()}
                </div>
            </div>
        </header>
    );
}
