import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboardStats, useTargetScore, useAllResults, getTypeIcon, formatType, getScoreDisplay, getLatestBand, getResultUrl, convertToIELTS, getBandClass } from '../hooks/useResults';
import { useNavigate } from 'react-router-dom';
import { Headphones, BookOpen, PenTool, FileText, TrendingUp, Clock, Award, ArrowRight, Target, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { HomeSkeleton } from '../components/Skeleton';
import './Home.css';

const SKILL_ICONS = {
    listening: Headphones,
    reading: BookOpen,
    writing: PenTool,
    fullmock: FileText,
};

const SKILL_COLORS = {
    listening: ['#8b5cf6', '#7c3aed'],
    reading: ['#3b82f6', '#1e40af'],
    writing: ['#10b981', '#059669'],
    fullmock: ['#f59e0b', '#d97706'],
};

export default function Home() {
    const { user, userData } = useAuth();
    const { stats, loading: statsLoading } = useDashboardStats(user?.uid);
    const { target, saveTargetScore, loading: targetLoading } = useTargetScore(user?.uid, user?.email);
    const { results, loading: resultsLoading } = useAllResults(user?.uid);

    const navigate = useNavigate();

    // Calendar logic
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let offset = firstDay === 0 ? 6 : firstDay - 1;

        const days = [];
        for (let i = 0; i < offset; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            // Need to use local formatting to match the YYYY-MM-DD keys in activityMap
            const tempDate = new Date(year, month, i);
            const dateStr = tempDate.toLocaleDateString('en-CA');
            days.push({ day: i, dateStr });
        }
        return days;
    }, [currentMonth]);

    const getActivityColor = (count) => {
        if (!count) return '#f1f5f9'; // empty gray
        if (count === 1) return '#fecaca'; // very light red
        if (count === 2) return '#f7acacff'; // light red
        if (count === 3) return '#ff8080ff'; // red
        if (count === 4) return '#da6060ff'; // dark red
        return '#d92727ff'; // deep red 5+
    };

    const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

    const handlePrevMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const handleSaveTarget = (score) => {
        saveTargetScore(score);
        setIsTargetModalOpen(false);
    };

    if (statsLoading || targetLoading) {
        return (
            <div className="home-page dashboard-redesign">
                <HomeSkeleton />
            </div>
        );
    }

    const latestListening = results.find(r => r.type === 'listening');
    const latestReading = results.find(r => r.type === 'reading');
    const lBand = latestListening ? parseFloat(getLatestBand(latestListening)) || 0 : 0;
    const rBand = latestReading ? parseFloat(getLatestBand(latestReading)) || 0 : 0;
    const avgScore = (lBand + rBand) / 2;

    const lTargetMet = target ? lBand >= target : false;
    const rTargetMet = target ? rBand >= target : false;

    return (
        <div className="home-page dashboard-redesign">
            <div className="dashboard-header-top">
                <div className="title-block">
                    <h1>Dashboard</h1>
                    <p>Welcome back! Here's your IELTS progress overview.</p>
                </div>
                <div className="goal-block">
                    <span className="goal-label">Goal</span>
                    <span className="goal-value">{target || '?'}</span>
                </div>
            </div>

            {/* Stat Cards */}
            <section className="stats-section">
                <div className="stats-grid redesign">
                    {/* Total Tests */}
                    <div className="stat-card glass-card redesign-card">
                        <div className="stat-header">
                            <span className="stat-label">Total Tests</span>
                            <div className="icon-circle outline-green">✓</div>
                        </div>
                        <div className="stat-value">{statsLoading ? '...' : stats.totalTests}</div>
                        <div className="stat-sub">{statsLoading ? '...' : `${stats.totalTests} completed`}</div>
                    </div>
                    {/* Best Score */}
                    <div className="stat-card glass-card redesign-card">
                        <div className="stat-header">
                            <span className="stat-label">Best Score</span>
                            <div className="icon-circle outline-red"><Award size={16} /></div>
                        </div>
                        <div className="stat-value">{statsLoading ? '...' : (stats.bestScore?.band || '0.0')}</div>
                        <div className="stat-sub">{statsLoading ? '...' : `Band ${stats.bestScore?.band || '0.0'}`}</div>
                    </div>
                    {/* Weak Area */}
                    <div className="stat-card glass-card redesign-card">
                        <div className="stat-header">
                            <span className="stat-label">Weak Area</span>
                            <div className="icon-circle outline-orange"><AlertTriangle size={16} /></div>
                        </div>
                        <div className="stat-value">{statsLoading ? '...' : stats.weakArea?.name}</div>
                        <div className="stat-sub">{statsLoading ? '...' : `Score: ${stats.weakArea?.score}`}</div>
                    </div>
                    {/* Strong Skill */}
                    <div className="stat-card glass-card redesign-card">
                        <div className="stat-header">
                            <span className="stat-label">Strong Skill</span>
                            <div className="icon-circle outline-green"><Award size={16} /></div>
                        </div>
                        <div className="stat-value">{statsLoading ? '...' : stats.strongSkill?.name}</div>
                        <div className="stat-sub">{statsLoading ? '...' : `Score: ${stats.strongSkill?.score}`}</div>
                    </div>
                </div>
            </section>

            <div className="dashboard-bottom-grid">
                {/* My Activity */}
                <section className="activity-section glass-card redesign-card">
                    <div className="activity-header">
                        <div className="activity-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3>My Activity</h3>
                            <div className="month-nav" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button onClick={handlePrevMonth} className="nav-btn"><ChevronLeft size={16} /></button>
                                <span className="activity-subtitle" style={{ minWidth: '100px', textAlign: 'center' }}>
                                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </span>
                                <button onClick={handleNextMonth} className="nav-btn"><ChevronRight size={16} /></button>
                            </div>
                        </div>
                        <div className="activity-legend">
                            <span>Less</span>
                            <div className="legend-dots">
                                <span style={{ backgroundColor: getActivityColor(0) }}></span>
                                <span style={{ backgroundColor: getActivityColor(1) }}></span>
                                <span style={{ backgroundColor: getActivityColor(2) }}></span>
                                <span style={{ backgroundColor: getActivityColor(3) }}></span>
                                <span style={{ backgroundColor: getActivityColor(4) }}></span>
                                <span style={{ backgroundColor: getActivityColor(5) }}></span>
                            </div>
                            <span>More</span>
                        </div>
                    </div>
                    <div className="calendar-container">
                        <div className="calendar-grid">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="cal-head">{d}</div>)}
                            {calendarDays.map((d, i) => (
                                <div key={i} className={`cal-day ${!d ? 'empty' : ''} ${d && d.day === today.getDate() && currentMonth.getMonth() === today.getMonth() ? 'today' : ''}`}>
                                    {d && (
                                        <div className="cal-day-inner" style={{ backgroundColor: getActivityColor(stats.activity[d.dateStr]) }}>
                                            {d.day}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Target Score */}
                <section className="target-section glass-card redesign-card">
                    <div className="target-header">
                        <div className="target-title-area">
                            <h3>Target Score</h3>
                            {target ? (
                                <button className="target-btn active" onClick={() => setIsTargetModalOpen(true)}>
                                    {target.toFixed(1)} <span>✏️</span>
                                </button>
                            ) : (
                                <button className="target-btn" onClick={() => setIsTargetModalOpen(true)}>
                                    Set Target
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="progress-bars">
                        <div className="prog-item">
                            <div className="prog-labels">
                                <span>Listening {target && <span className={lTargetMet ? 'target-met' : 'target-miss'}>{lTargetMet ? '✅ Target' : '❌ Target'}</span>}</span>
                                <span className="prog-score"><strong>{lBand.toFixed(1)}</strong> / 9.0</span>
                            </div>
                            <div className="prog-track"><div className="prog-fill listening" style={{ width: `${(lBand / 9) * 100}%` }}></div></div>
                        </div>
                        <div className="prog-item">
                            <div className="prog-labels">
                                <span>Reading {target && <span className={rTargetMet ? 'target-met' : 'target-miss'}>{rTargetMet ? '✅ Target' : '❌ Target'}</span>}</span>
                                <span className="prog-score"><strong>{rBand.toFixed(1)}</strong> / 9.0</span>
                            </div>
                            <div className="prog-track"><div className="prog-fill reading" style={{ width: `${(rBand / 9) * 100}%` }}></div></div>
                        </div>

                        <div className="prog-overall">
                            <div className="prog-labels">
                                <span>Overall Progress</span>
                                <span className="prog-score"><strong>{avgScore.toFixed(1)}</strong> / {target || 9.0}</span>
                            </div>
                            <div className="prog-track"><div className="prog-fill overall" style={{ width: `${Math.min(100, (avgScore / (target || 9)) * 100)}%` }}></div></div>
                            <p className="achieve-text">Achieve your target IELTS score</p>

                            {target && (
                                <div className="gap-target">
                                    <span className="gap-label">Gap to Target</span>
                                    <strong className="gap-val">{Math.max(0, target - avgScore).toFixed(1)}</strong>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            {/* Target Score Modal */}
            {isTargetModalOpen && (
                <div className="target-modal-overlay" onClick={() => setIsTargetModalOpen(false)}>
                    <div className="target-modal-content glass-card redesign-card" onClick={e => e.stopPropagation()}>
                        <div className="target-modal-header">
                            <h4>Select Target Score</h4>
                            <button className="close-btn" onClick={() => setIsTargetModalOpen(false)}>×</button>
                        </div>
                        <div className="target-grid">
                            {[4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0].map(score => (
                                <button
                                    key={score}
                                    className={`target-score-btn ${target === score ? 'selected' : ''}`}
                                    onClick={() => handleSaveTarget(score)}
                                >
                                    {score.toFixed(1)}
                                </button>
                            ))}
                        </div>
                        <p className="target-modal-hint">Choose your goal IELTS band score. We save this securely to track your progress.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
