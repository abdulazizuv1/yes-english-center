import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { useAllReadingAnalyses, getBandClass } from '../hooks/useResults';
import { BarChart2, ArrowLeft, Search } from 'lucide-react';
import './ReadingAnalysisAdmin.css';

function getAvatarColor(name) {
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

export default function ReadingAnalysisAdmin() {
    const { isAdmin } = useAuth();
    const { analyses, loading } = useAllReadingAnalyses();
    const [search, setSearch] = useState('');
    const [modeFilter, setModeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    if (!isAdmin) return <Navigate to="/" replace />;

    const filtered = analyses.filter(a => {
        const q = search.toLowerCase();
        const matchSearch = !search
            || (a.userEmail || '').toLowerCase().includes(q)
            || (a.testTitle || '').toLowerCase().includes(q);
        const matchMode = modeFilter === 'all' || a.mode === modeFilter;
        const matchStatus = statusFilter === 'all' || a.status === statusFilter;
        return matchSearch && matchMode && matchStatus;
    });

    const formatDate = (ts) => {
        if (!ts) return '—';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getStatusBadge = (status) => {
        if (status === 'completed') return <span className="ra-admin-badge completed">Completed</span>;
        if (status === 'error') return <span className="ra-admin-badge error">Error</span>;
        return <span className="ra-admin-badge pending">Pending</span>;
    };

    const getModeBadge = (mode) => {
        if (mode === 'with_passage') return <span className="ra-admin-badge mode-with">With Passage</span>;
        return <span className="ra-admin-badge mode-without">Without Passage</span>;
    };

    return (
        <div className="ra-admin-page page-enter">
            <div className="ra-admin-header">
                <Link to="/admin" className="ra-admin-back">
                    <ArrowLeft size={16} /> Back
                </Link>
                <div className="ra-admin-title-row">
                    <BarChart2 size={26} className="ra-admin-icon" />
                    <div>
                        <h2>Reading Analysis Results</h2>
                        <p>All AI reading analysis submissions from students</p>
                    </div>
                </div>
            </div>

            <div className="ra-admin-toolbar glass-card">
                <div className="ra-admin-search">
                    <Search size={16} />
                    <input
                        placeholder="Search by email or test name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="ra-admin-filters">
                    <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} className="ra-admin-select">
                        <option value="all">All Modes</option>
                        <option value="with_passage">With Passage</option>
                        <option value="without_passage">Without Passage</option>
                    </select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="ra-admin-select">
                        <option value="all">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="error">Error</option>
                    </select>
                </div>
                <span className="ra-admin-count">{filtered.length} submission{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
                <div className="ra-admin-loading">
                    <div className="spinner" />
                    <span>Loading submissions...</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state glass-card">
                    <span className="empty-icon">📊</span>
                    <p>{search || modeFilter !== 'all' || statusFilter !== 'all' ? 'No submissions match your filters' : 'No reading analysis submissions yet'}</p>
                </div>
            ) : (
                <div className="ra-admin-list">
                    {filtered.map(a => {
                        const email = a.userEmail || a.userId || 'Unknown';
                        const testLabel = a.testTitle || 'No test';
                        const date = formatDate(a.submittedAt);
                        const score = a.aiResult ? `${a.aiResult.overallScore}/${a.aiResult.totalQuestions}` : '—';
                        const band = a.aiResult?.estimatedBand || '—';
                        const bandCls = a.aiResult?.estimatedBand ? getBandClass(a.aiResult.estimatedBand) : '';
                        const qCount = a.questionsData?.rows?.length ?? a.questionsData?.length ?? 0;

                        return (
                            <div key={a.id} className="ra-admin-row glass-card">
                                <div className="ra-admin-avatar" style={{ background: getAvatarColor(email) }}>
                                    {email[0].toUpperCase()}
                                </div>
                                <div className="ra-admin-info">
                                    <span className="ra-admin-email">{email}</span>
                                    <div className="ra-admin-meta">
                                        <span>{testLabel}</span>
                                        <span>·</span>
                                        <span>{date}</span>
                                        <span>·</span>
                                        <span>{qCount} questions</span>
                                    </div>
                                </div>
                                <div className="ra-admin-badges">
                                    {getModeBadge(a.mode)}
                                    {getStatusBadge(a.status)}
                                </div>
                                <div className="ra-admin-score">
                                    {a.status === 'completed' && (
                                        <>
                                            <span className="ra-admin-score-val">{score}</span>
                                            {band !== '—' && (
                                                <span className={`ra-admin-band band-pill ${bandCls}`}>Band {band}</span>
                                            )}
                                        </>
                                    )}
                                </div>
                                {a.status === 'completed' && (
                                    <a
                                        href={`/pages/mock/reading/analysis-check/?view=${a.id}`}
                                        className="ra-admin-view-btn"
                                    >
                                        View Details
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
