import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f1f5f9',
                zIndex: 9999,
            }}>
                <img
                    src="/image/logo.png"
                    alt="YES English Center"
                    style={{ width: '180px', marginBottom: '28px', opacity: 0.85 }}
                />
                <div style={{
                    width: '44px',
                    height: '44px',
                    border: '4px solid #e2e8f0',
                    borderTop: '4px solid #1763e1',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{
                    marginTop: '18px',
                    color: '#475569',
                    fontSize: '16px',
                    fontWeight: 500,
                    fontFamily: "'Montserrat', sans-serif",
                }}>Loading dashboard...</span>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="loading-container" style={{ height: '100vh', textAlign: 'center' }}>
                <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: '400px' }}>
                    <h2 style={{ marginBottom: '12px', fontSize: '22px' }}>🔒 Login Required</h2>
                    <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '16px' }}>Please login on the main page to access the dashboard.</p>
                    <a href="/" style={{
                        display: 'inline-block',
                        padding: '12px 28px',
                        background: 'linear-gradient(135deg, #1763e1, #4a8af4)',
                        color: '#fff',
                        borderRadius: '10px',
                        fontWeight: '600',
                        fontSize: '16px',
                        textDecoration: 'none',
                    }}>Go to Home Page</a>
                </div>
            </div>
        );
    }

    return children;
}
