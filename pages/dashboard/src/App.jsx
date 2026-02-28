import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import Home from './pages/Home';
import TestSection from './pages/TestSection';
import Settings from './pages/Settings';
import AdminSettings from './pages/AdminSettings';
import ManageUsers from './pages/ManageUsers';
import ManageTests from './pages/ManageTests';
import Feedback from './pages/Feedback';
import './App.css';

export default function App() {
    return (
        <AuthProvider>
            <HashRouter>
                <Routes>
                    <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                        <Route index element={<Home />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="feedback" element={<Feedback />} />
                        <Route path="admin" element={<AdminSettings />} />
                        <Route path="admin/users" element={<ManageUsers />} />
                        <Route path="admin/tests/:type" element={<ManageTests />} />
                        <Route path=":type" element={<TestSection />} />
                    </Route>
                </Routes>
            </HashRouter>
        </AuthProvider>
    );
}
