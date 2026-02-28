import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="dashboard-layout">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="dashboard-main">
                <TopBar onMenuToggle={() => setSidebarOpen(prev => !prev)} />
                <main className="dashboard-content page-enter">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
