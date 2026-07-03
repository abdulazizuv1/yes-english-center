import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import Home from './pages/Home';
import './App.css';

// Route-level code splitting: only Home loads eagerly
const TestSection = lazy(() => import('./pages/TestSection'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const ManageUsers = lazy(() => import('./pages/ManageUsers'));
const ManageTests = lazy(() => import('./pages/ManageTests'));
const Feedback = lazy(() => import('./pages/Feedback'));
const UsersTestResults = lazy(() => import('./pages/UsersTestResults'));

export default function App() {
    return (
        <AuthProvider>
            <HashRouter>
                <Suspense fallback={<div className="route-loading" />}>
                    <Routes>
                        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                            <Route index element={<Home />} />
                            <Route path="settings" element={<Settings />} />
                            <Route path="feedback" element={<Feedback />} />
                            <Route path="admin" element={<AdminSettings />} />
                            <Route path="admin/users" element={<ManageUsers />} />
                            <Route path="admin/tests/:type" element={<ManageTests />} />
                            <Route path="admin/results" element={<UsersTestResults />} />
                            <Route path=":type" element={<TestSection />} />
                        </Route>
                    </Routes>
                </Suspense>
            </HashRouter>
        </AuthProvider>
    );
}
