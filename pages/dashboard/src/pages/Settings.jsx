import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAllResults, useSkillResults, useAIFeedbackResults, useReadingAnalyses, convertToIELTS, getTypeIcon, formatType, getScoreDisplay, getResultUrl, getBandClass } from '../hooks/useResults';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { User, BarChart3, FileText, Camera, BookOpen } from 'lucide-react';
import './Settings.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function Settings() {
    const { user, userData } = useAuth();
    const [tab, setTab] = useState('results');
    const { results, loading: resultsLoading } = useAllResults(user?.uid);
    const { results: aiResults, loading: aiLoading } = useAIFeedbackResults(user?.uid);
    const [filter, setFilter] = useState('all');

    const filteredResults = filter === 'all'
        ? [...results, ...aiResults].sort((a, b) => {
            const da = a.createdAt?.toDate ? a.createdAt.toDate() : (a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(0));
            const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : (b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(0));
            return db2 - da;
          })
        : filter === 'aifeedback'
        ? aiResults
        : results.filter(r => r.type === filter);

    return (
        <div className="settings-page page-enter">
            {/* Profile Card */}
            <div className="profile-card glass-card">
                <div className="profile-avatar">
                    {userData?.photoURL ? (
                        <img src={userData.photoURL} alt="Profile" />
                    ) : (
                        <span>{(userData?.name || 'U')[0].toUpperCase()}</span>
                    )}
                </div>
                <div className="profile-info">
                    <h2>{userData?.name || 'User'}</h2>
                    <p>{userData?.email || user?.email}</p>
                    <span className={`role-badge ${userData?.role === 'admin' ? 'admin' : 'student'}`}>
                        {(userData?.role || 'student').charAt(0).toUpperCase() + (userData?.role || 'student').slice(1)}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="settings-tabs">
                <button className={`tab-btn ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')}>
                    <FileText size={16} /> Results
                </button>
                <button className={`tab-btn ${tab === 'statistics' ? 'active' : ''}`} onClick={() => setTab('statistics')}>
                    <BarChart3 size={16} /> Statistics
                </button>
                <button className={`tab-btn ${tab === 'analysis' ? 'active' : ''}`} onClick={() => setTab('analysis')}>
                    <BookOpen size={16} /> Reading Analysis
                </button>
                <button className={`tab-btn ${tab === 'personal' ? 'active' : ''}`} onClick={() => setTab('personal')}>
                    <User size={16} /> Personal
                </button>
            </div>

            {/* Results Tab */}
            {tab === 'results' && (
                <div className="tab-content">
                    <div className="filter-row">
                        {['all', 'listening', 'reading', 'writing', 'fullmock', 'aifeedback'].map(f => (
                            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                                {f === 'all' ? 'All' : f === 'aifeedback' ? '🤖 AI Feedback' : formatType(f)}
                            </button>
                        ))}
                    </div>
                    <div className="results-list">
                        {(resultsLoading || (filter === 'aifeedback' && aiLoading)) ? (
                            <div className="loading-container"><div className="spinner" /><span>Loading...</span></div>
                        ) : filteredResults.length === 0 ? (
                            <div className="empty-state glass-card"><span className="empty-icon">📝</span><p>No results found.</p></div>
                        ) : (
                            filteredResults.map((r, i) => {
                                if (r.type === 'aifeedback') {
                                    const date = r.createdAt?.toDate
                                        ? r.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                        : '—';
                                    const overall = r.feedback?.overall ?? '—';
                                    const bandCls = overall !== '—' ? getBandClass(overall) : '';
                                    return (
                                        <a key={r.id || i} href={`/pages/ai-feedback/?id=${r.submissionId}`} className="result-row glass-card">
                                            <span className="result-row-icon">🤖</span>
                                            <div className="result-row-info">
                                                <span className="result-row-type" style={{ fontWeight: 500 }}>AI Writing Feedback</span>
                                                <span className="result-row-date">{date}</span>
                                            </div>
                                            <span className={`result-row-score ${bandCls}`}>Band {overall}</span>
                                        </a>
                                    );
                                }

                                let date = '—';
                                if (r.type === 'writing' && r.submittedAt) {
                                    if (r.submittedAt.toDate) {
                                        date = r.submittedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    } else if (typeof r.submittedAt === 'string') {
                                        date = r.submittedAt.split(' at ')[0];
                                    }
                                } else if (r.createdAt?.toDate) {
                                    date = r.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                }

                                const testName = r.displayTitle || formatType(r.type);

                                return (
                                    <a key={r.id || i} href={getResultUrl(r.type, r.id)} className="result-row glass-card">
                                        <span className="result-row-icon">{getTypeIcon(r.type)}</span>
                                        <div className="result-row-info">
                                            <span className="result-row-type" style={{ fontWeight: 500 }}>{testName}</span>
                                            <span className="result-row-date">{date}</span>
                                        </div>
                                        <span className="result-row-score">{getScoreDisplay(r)}</span>
                                    </a>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Reading Analysis Tab */}
            {tab === 'analysis' && <ReadingAnalysisTab userId={user?.uid} />}

            {/* Statistics Tab */}
            {tab === 'statistics' && <StatsTab userId={user?.uid} />}

            {/* Personal Tab */}
            {tab === 'personal' && <PersonalTab />}
        </div>
    );
}

/* ─── Reading Analysis Tab ─── */
// function ReadingAnalysisTab({ userId }) {
//     const { analyses, loading } = useReadingAnalyses(userId);

//     const formatDate = (ts) => {
//         if (!ts) return '—';
//         const d = ts.toDate ? ts.toDate() : new Date(ts);
//         return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
//     };

//     const getStatusBadge = (status) => {
//         if (status === 'completed') return <span className="ra-badge ra-completed">Completed</span>;
//         if (status === 'error') return <span className="ra-badge ra-error">Error</span>;
//         return <span className="ra-badge ra-pending">Pending</span>;
//     };

//     const getModeBadge = (mode) => {
//         if (mode === 'with_passage') return <span className="ra-badge ra-mode-with">With Passage</span>;
//         return <span className="ra-badge ra-mode-without">Without Passage</span>;
//     };

//     return (
//         <div className="tab-content">
//             <div className="ra-header-row">
//                 <p className="ra-desc">Your reading analysis submissions and AI feedback history.</p>
//                 <a
//                     href="/pages/mock/reading/analysis-check/"
//                     className="ra-new-btn"
//                 >
//                     + New Analysis
//                 </a>
//             </div>
//             {loading ? (
//                 <div className="loading-container"><div className="spinner" /><span>Loading...</span></div>
//             ) : analyses.length === 0 ? (
//                 <div className="empty-state glass-card">
//                     <span className="empty-icon">📊</span>
//                     <p>No reading analyses yet.</p>
//                     <a href="/pages/mock/reading/analysis-check/" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>
//                         Try the Reading Analysis Check →
//                     </a>
//                 </div>
//             ) : (
//                 <div className="results-list">
//                     {analyses.map((a) => {
//                         const date = formatDate(a.submittedAt);
//                         const testLabel = a.testTitle || 'No test selected';
//                         const score = a.aiResult ? `${a.aiResult.overallScore}/${a.aiResult.totalQuestions}` : '—';
//                         const band = a.aiResult?.estimatedBand || '—';
//                         const bandCls = a.aiResult?.estimatedBand ? getBandClass(a.aiResult.estimatedBand) : '';
//                         return (
//                             <div key={a.id} className="result-row glass-card ra-row">
//                                 <span className="result-row-icon">📊</span>
//                                 <div className="result-row-info">
//                                     <span className="result-row-type">{testLabel}</span>
//                                     <span className="result-row-date">{date} · {getModeBadge(a.mode)}</span>
//                                 </div>
//                                 <div className="ra-row-right">
//                                     {a.status === 'completed' && (
//                                         <span className={`result-row-score ${bandCls}`}>Band {band}</span>
//                                     )}
//                                     {getStatusBadge(a.status)}
//                                     {a.status === 'completed' && (
//                                         <a
//                                             href={`/pages/mock/reading/analysis-check/?view=${a.id}`}
//                                             className="ra-view-btn"
//                                         >
//                                             View
//                                         </a>
//                                     )}
//                                 </div>
//                             </div>
//                         );
//                     })}
//                 </div>
//             )}
//         </div>
//     );
// }

/* ─── Statistics Tab ─── */
function StatsTab({ userId }) {
    const [skill, setSkill] = useState('listening');
    const { results, loading } = useSkillResults(userId, skill);

    const sorted = [...results].sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return da - db2;
    });

    const labels = sorted.map(r => {
        const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const data = sorted.map(r => {
        if (skill === 'fullmock') return r.overallBand || 0;
        if (skill === 'writing') return r.totalWordCount || 0;
        return convertToIELTS(r.score || 0, r.total || 40, skill);
    });

    const chartData = {
        labels,
        datasets: [{
            label: `${formatType(skill)} Progress`,
            data,
            borderColor: '#1763e1',
            backgroundColor: 'rgba(23, 99, 225, 0.08)',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#1763e1',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
        }],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { position: 'top', labels: { font: { size: 13, weight: '600' } } },
            tooltip: {
                backgroundColor: 'rgba(255,255,255,0.95)',
                titleColor: '#0f172a',
                bodyColor: '#475569',
                borderColor: '#1763e1',
                borderWidth: 1,
                padding: 12,
            },
        },
        scales: {
            y: {
                beginAtZero: skill === 'writing',
                title: { display: true, text: skill === 'writing' ? 'Word Count' : 'IELTS Band', font: { size: 13, weight: '600' } },
            },
            x: {
                title: { display: true, text: 'Test Date', font: { size: 13, weight: '600' } },
            },
        },
    };

    // Trend feedback
    let trend = null;
    if (data.length >= 2) {
        const diff = data[data.length - 1] - data[0];
        if (diff > 0.5 || (skill === 'writing' && diff > 50)) trend = { icon: '📈', label: 'Improving', color: '#10b981' };
        else if (diff < -0.5 || (skill === 'writing' && diff < -50)) trend = { icon: '📉', label: 'Needs Attention', color: '#ef4444' };
        else trend = { icon: '➡️', label: 'Consistent', color: '#f59e0b' };
    }

    return (
        <div className="tab-content">
            <div className="stats-controls">
                <select value={skill} onChange={e => setSkill(e.target.value)} className="skill-select">
                    <option value="listening">Listening</option>
                    <option value="reading">Reading</option>
                    <option value="writing">Writing</option>
                    <option value="fullmock">Full Mock</option>
                </select>
            </div>
            {loading ? (
                <div className="loading-container"><div className="spinner" /><span>Loading stats...</span></div>
            ) : data.length === 0 ? (
                <div className="empty-state glass-card"><span className="empty-icon">📊</span><p>No data yet for {formatType(skill)}.</p></div>
            ) : (
                <>
                    <div className="chart-container glass-card">
                        <Line data={chartData} options={chartOptions} />
                    </div>
                    {trend && (
                        <div className="trend-card glass-card" style={{ borderLeft: `4px solid ${trend.color}` }}>
                            <span className="trend-icon">{trend.icon}</span>
                            <div>
                                <strong>{trend.label}</strong>
                                <p>{data.length} tests completed • Latest: {data[data.length - 1]}{skill !== 'writing' ? ' band' : ' words'}</p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ─── Personal Tab ─── */
function PersonalTab() {
    const { user, userData } = useAuth();
    const [name, setName] = useState(userData?.name || '');
    const [username, setUsername] = useState(userData?.username || '');
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [msg, setMsg] = useState(null);
    const [saving, setSaving] = useState('');
    const fileRef = useRef();

    const showMsg = (text, type = 'success') => {
        setMsg({ text, type });
        setTimeout(() => setMsg(null), 4000);
    };

    const saveName = async () => {
        if (!name.trim()) return showMsg('Please enter a valid name', 'error');
        setSaving('name');
        try {
            await updateDoc(doc(db, 'users', user.uid), { name: name.trim() });
            showMsg('Name updated!');
        } catch (e) { showMsg('Failed: ' + e.message, 'error'); }
        setSaving('');
    };

    const saveUsername = async () => {
        if (!username.trim()) return showMsg('Please enter a username', 'error');
        setSaving('username');
        try {
            const q = query(collection(db, 'users'), where('username', '==', username.trim()));
            const snap = await getDocs(q);
            if (!snap.empty && snap.docs[0].id !== user.uid) {
                showMsg('Username already taken', 'error');
                setSaving('');
                return;
            }
            await updateDoc(doc(db, 'users', user.uid), { username: username.trim() });
            showMsg('Username updated!');
        } catch (e) { showMsg('Failed: ' + e.message, 'error'); }
        setSaving('');
    };

    const changePw = async () => {
        if (!currentPw || !newPw || !confirmPw) return showMsg('Fill all password fields', 'error');
        if (newPw.length < 6) return showMsg('Password must be at least 6 characters', 'error');
        if (newPw !== confirmPw) return showMsg('Passwords do not match', 'error');
        setSaving('password');
        try {
            const cred = EmailAuthProvider.credential(user.email, currentPw);
            await reauthenticateWithCredential(user, cred);
            await updatePassword(user, newPw);
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
            showMsg('Password changed!');
        } catch (e) {
            const msgs = { 'auth/wrong-password': 'Current password incorrect', 'auth/weak-password': 'Password too weak' };
            showMsg(msgs[e.code] || 'Failed: ' + e.message, 'error');
        }
        setSaving('');
    };

    const uploadPfp = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSaving('pfp');
        try {
            const sRef = storageRef(storage, `profilePictures/${user.uid}`);
            await uploadBytes(sRef, file);
            const url = await getDownloadURL(sRef);
            await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
            showMsg('Profile picture updated!');
        } catch (e) { showMsg('Upload failed: ' + e.message, 'error'); }
        setSaving('');
    };

    return (
        <div className="tab-content personal-tab">
            {msg && <div className={`flash-msg ${msg.type}`}>{msg.text}</div>}

            {/* Profile Picture */}
            <div className="personal-section glass-card">
                <h4>Profile Picture</h4>
                <div className="pfp-section">
                    <div className="pfp-preview">
                        {userData?.photoURL ? <img src={userData.photoURL} alt="Profile" /> : <span>{(userData?.name || 'U')[0]}</span>}
                    </div>
                    <button className="upload-btn" onClick={() => fileRef.current?.click()} disabled={saving === 'pfp'}>
                        <Camera size={16} /> {saving === 'pfp' ? 'Uploading...' : 'Change Photo'}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadPfp} />
                </div>
            </div>

            {/* Name */}
            <div className="personal-section glass-card">
                <h4>Full Name</h4>
                <div className="input-row">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
                    <button onClick={saveName} disabled={saving === 'name'}>{saving === 'name' ? 'Saving...' : 'Save'}</button>
                </div>
            </div>

            {/* Username */}
            <div className="personal-section glass-card">
                <h4>Username</h4>
                <div className="input-row">
                    <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" />
                    <button onClick={saveUsername} disabled={saving === 'username'}>{saving === 'username' ? 'Saving...' : 'Save'}</button>
                </div>
            </div>

            {/* Password */}
            <div className="personal-section glass-card">
                <h4>Change Password</h4>
                <div className="pw-fields">
                    <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" />
                    <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" />
                    <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password" />
                </div>
                <button className="pw-btn" onClick={changePw} disabled={saving === 'password'}>
                    {saving === 'password' ? 'Changing...' : 'Change Password'}
                </button>
            </div>
        </div>
    );
}
