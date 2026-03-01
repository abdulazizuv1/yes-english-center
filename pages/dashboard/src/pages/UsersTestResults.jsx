import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { useAllUsersResults, getResultUrl, getScoreDisplay, convertToIELTS, getBandClass, formatType } from '../hooks/useResults';
import { ClipboardList, Headphones, BookOpen, PenTool, FileText, ArrowLeft, Search, ArrowRight } from 'lucide-react';
import './UsersTestResults.css';

const TEST_TYPES = [
    { type: 'listening', icon: Headphones, color: '#8b5cf6', desc: 'All student listening results' },
    { type: 'reading', icon: BookOpen, color: '#3b82f6', desc: 'All student reading results' },
    { type: 'writing', icon: PenTool, color: '#10b981', desc: 'All student writing results' },
    { type: 'fullmock', icon: FileText, color: '#f59e0b', desc: 'All student full mock results' },
];

const AVATAR_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

function getAvatarColor(name) {
    const idx = (name || '').charCodeAt(0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
}

function formatDate(result) {
    const d = result.createdAt?.toDate ? result.createdAt.toDate() : (result.submittedAt?.toDate ? result.submittedAt.toDate() : null);
    if (!d) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getScoreBadge(result) {
    if (result.type === 'fullmock') {
        const band = result.overallBand || 'N/A';
        return { text: `Band ${band}`, cls: getBandClass(band) };
    }
    if (result.type === 'writing') {
        return { text: `${result.totalWordCount || 0} words`, cls: 'band-writing' };
    }
    const band = convertToIELTS(result.score || 0, result.total || 40, result.type);
    return { text: `${result.score || 0}/${result.total || 40} • Band ${band}`, cls: getBandClass(band) };
}

function ResultsList({ type }) {
    const { results, loading } = useAllUsersResults(type);
    const [search, setSearch] = useState('');

    const filtered = results.filter(r => {
        const q = search.toLowerCase();
        return (r.name || '').toLowerCase().includes(q)
            || (r.email || '').toLowerCase().includes(q)
            || (r.displayTitle || '').toLowerCase().includes(q);
    });

    if (loading) {
        return (
            <div className="utr-loading">
                <div className="spinner-sm" />
                Loading results...
            </div>
        );
    }

    return (
        <>
            <div className="utr-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <span className="utr-result-count">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {filtered.length === 0 ? (
                <div className="utr-empty glass-card">
                    <span className="utr-empty-icon">📭</span>
                    <p>{search ? 'No results match your search' : 'No test results yet'}</p>
                </div>
            ) : (
                <div className="utr-results-list">
                    {filtered.map(r => {
                        const badge = getScoreBadge(r);
                        const studentName = r.name || r.email || 'Unknown';
                        return (
                            <a
                                key={r.id}
                                href={getResultUrl(type, r.id)}
                                className="utr-result-item glass-card"
                            >
                                <div className="utr-result-avatar" style={{ background: getAvatarColor(studentName) }}>
                                    {studentName[0].toUpperCase()}
                                </div>
                                <div className="utr-result-info">
                                    <span className="utr-result-name">{studentName}</span>
                                    {r.email && r.name && <span className="utr-result-email">{r.email}</span>}
                                </div>
                                <span className="utr-result-test">{r.displayTitle || formatType(type)}</span>
                                <span className={`utr-result-score ${badge.cls}`}>{badge.text}</span>
                                <span className="utr-result-date">{formatDate(r)}</span>
                                <ArrowRight size={16} className="utr-result-arrow" />
                            </a>
                        );
                    })}
                </div>
            )}
        </>
    );
}

export default function UsersTestResults() {
    const { isAdmin } = useAuth();
    const [selectedType, setSelectedType] = useState(null);

    if (!isAdmin) return <Navigate to="/" replace />;

    return (
        <div className="utr-page page-enter">
            <div className="utr-header">
                <ClipboardList size={28} className="utr-icon" />
                <div>
                    <h2>Users Test Results</h2>
                    <p>{selectedType ? `All ${formatType(selectedType)} results` : 'View all student test results'}</p>
                </div>
            </div>

            {!selectedType ? (
                <>
                    <h3 className="utr-section-title">📋 Select Test Type</h3>
                    <div className="utr-type-grid">
                        {TEST_TYPES.map(({ type, icon: Icon, color, desc }) => (
                            <div
                                key={type}
                                className="utr-type-card glass-card"
                                onClick={() => setSelectedType(type)}
                            >
                                <div className="utr-type-card-icon" style={{ background: color }}>
                                    <Icon size={24} color="#fff" />
                                </div>
                                <h4>{formatType(type)}</h4>
                                <p>{desc}</p>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <button className="utr-back-btn" onClick={() => setSelectedType(null)}>
                        <ArrowLeft size={16} /> Back to test types
                    </button>
                    <ResultsList type={selectedType} />
                </>
            )}
        </div>
    );
}
