import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStudyPlan, planProgress, todayString, daysUntil } from '../hooks/useStudyPlan';
import { useTargetScore, getTestUrl } from '../hooks/useResults';
import {
    CalendarDays, Target, Gauge, Clock, ChevronLeft, ChevronRight,
    Sparkles, Check, Lock, SlidersHorizontal, Trash2, Send,
    BookOpen, Headphones, PenTool, FileText, BookMarked, SpellCheck,
    RotateCcw, ClipboardCheck, Search, Music, Mic, Moon, X, ExternalLink,
} from 'lucide-react';
import './DailyPlan.css';

const BANDS = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];
const SECTIONS = [
    { key: 'listening', label: 'Listening', icon: Headphones },
    { key: 'reading', label: 'Reading', icon: BookOpen },
    { key: 'writing', label: 'Writing', icon: PenTool },
    { key: 'speaking', label: 'Speaking', icon: Mic },
];

// Computed once at load — exam must be 3–200 days out
const MIN_EXAM_DATE = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const MAX_EXAM_DATE = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);

const HOURS_OPTIONS = [
    { value: 1, label: '1 hour', desc: 'Light — busy schedule' },
    { value: 1.5, label: '1.5 hours', desc: 'Steady progress' },
    { value: 2, label: '2 hours', desc: 'Balanced (recommended)' },
    { value: 3, label: '3+ hours', desc: 'Intensive preparation' },
];

const TASK_META = {
    reading: { label: 'Reading', icon: BookOpen },
    listening: { label: 'Listening', icon: Headphones },
    writing: { label: 'Writing', icon: PenTool },
    fullmock: { label: 'Full Mock', icon: FileText },
    vocabulary: { label: 'Vocabulary', icon: BookMarked },
    grammar: { label: 'Grammar', icon: SpellCheck },
    review: { label: 'Review', icon: RotateCcw },
    mock_review: { label: 'Mock Review', icon: ClipboardCheck },
    reading_analysis: { label: 'Analysis', icon: Search },
    listening_review: { label: 'Listening', icon: Music },
    speaking: { label: 'Speaking', icon: Mic },
    rest: { label: 'Rest', icon: Moon },
};

const ERROR_MESSAGES = {
    limit_reached: 'You can generate a plan 3 times per week. Try again next week.',
    exam_too_soon: 'The exam date must be at least 3 days from today.',
    exam_too_far: 'The exam date must be within the next 6 months.',
    invalid_date: 'Please pick a valid exam date.',
    network: 'Network error — check your connection and try again.',
};

const TG_BOT_USERNAME = 'dailyplan_yes_bot';

function fmtWeekRange(firstDate, lastDate) {
    const a = new Date(`${firstDate}T12:00:00`);
    const b = new Date(`${lastDate}T12:00:00`);
    const month = (d, form) => d.toLocaleDateString('en-US', { month: form });
    if (a.getMonth() === b.getMonth()) {
        return `${month(a, 'long')} ${a.getDate()} to ${b.getDate()}`;
    }
    return `${month(a, 'short')} ${a.getDate()} to ${month(b, 'short')} ${b.getDate()}`;
}

function dayParts(dateStr) {
    const d = new Date(`${dateStr}T12:00:00`);
    return {
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        num: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
    };
}

/* ═══════════════ Setup wizard ═══════════════ */
function PlanWizard({ defaults, onSubmit, generating, error, onCancel }) {
    const [step, setStep] = useState(0);
    const [bands, setBands] = useState(defaults.currentBands ?? {
        listening: null, reading: null, writing: null, speaking: null,
    });
    const [examDate, setExamDate] = useState(defaults.examDate ?? '');
    const [targetBand, setTargetBand] = useState(defaults.targetBand ?? null);
    const [hoursPerDay, setHoursPerDay] = useState(defaults.hoursPerDay ?? 2);

    const setSection = (key, value) =>
        setBands((prev) => ({ ...prev, [key]: value === '' ? null : parseFloat(value) }));

    const bandsComplete = SECTIONS.every((s) => bands[s.key] !== null && bands[s.key] !== undefined);
    const avgBand = bandsComplete
        ? Math.round((SECTIONS.reduce((sum, s) => sum + bands[s.key], 0) / 4) * 2) / 2
        : null;

    const steps = [
        {
            icon: Gauge,
            title: 'Your current level',
            subtitle: 'Set your band for each section — this makes the plan much more accurate',
            valid: bandsComplete,
            body: (
                <div className="sections-grid">
                    {SECTIONS.map((s) => (
                        <div key={s.key} className="section-row">
                            <span className="section-label">
                                <s.icon size={17} />
                                {s.label}
                            </span>
                            <select
                                className="band-select"
                                value={bands[s.key] ?? ''}
                                onChange={(e) => setSection(s.key, e.target.value)}
                            >
                                <option value="" disabled>Band…</option>
                                {BANDS.map((b) => (
                                    <option key={b} value={b}>{b.toFixed(1)}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                    {avgBand !== null && (
                        <p className="sections-avg">Overall level: <strong>{avgBand.toFixed(1)}</strong></p>
                    )}
                </div>
            ),
        },
        {
            icon: CalendarDays,
            title: 'When is your IELTS exam?',
            subtitle: 'The plan covers every day from today until your exam',
            valid: !!examDate,
            body: (
                <input
                    type="date"
                    className="date-input"
                    value={examDate}
                    min={MIN_EXAM_DATE}
                    max={MAX_EXAM_DATE}
                    onChange={(e) => setExamDate(e.target.value)}
                />
            ),
        },
        {
            icon: Target,
            title: 'Your target band',
            subtitle: 'Be ambitious but realistic — you can adjust it later',
            valid: targetBand !== null,
            body: (
                <>
                    <div className="band-grid">
                        {BANDS.map((b) => (
                            <button
                                key={b}
                                className={`band-chip ${targetBand === b ? 'selected' : ''}`}
                                onClick={() => setTargetBand(b)}
                            >
                                {b.toFixed(1)}
                            </button>
                        ))}
                    </div>
                    {targetBand !== null && avgBand !== null && targetBand <= avgBand && (
                        <p className="wizard-hint">
                            Your target is not higher than your current level — consider aiming higher.
                        </p>
                    )}
                </>
            ),
        },
        {
            icon: Clock,
            title: 'Daily study time',
            subtitle: 'How much time can you realistically spend per day?',
            valid: !!hoursPerDay,
            body: (
                <div className="hours-grid">
                    {HOURS_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            className={`hours-card ${hoursPerDay === opt.value ? 'selected' : ''}`}
                            onClick={() => setHoursPerDay(opt.value)}
                        >
                            <span className="hours-value">{opt.label}</span>
                            <span className="hours-desc">{opt.desc}</span>
                        </button>
                    ))}
                </div>
            ),
        },
    ];

    const current = steps[step];
    const StepIcon = current.icon;
    const isLast = step === steps.length - 1;

    const submit = () => onSubmit({
        currentBands: bands, targetBand, examDate, hoursPerDay, startDate: todayString(),
    });

    return (
        <div className="plan-wizard card">
            <div className="wizard-progress">
                {steps.map((_, i) => (
                    <div key={i} className={`wizard-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
                ))}
            </div>

            <div className="wizard-icon"><StepIcon size={28} /></div>
            <h2 className="wizard-title">{current.title}</h2>
            <p className="wizard-subtitle">{current.subtitle}</p>

            <div className="wizard-body">{current.body}</div>

            {error && <div className="wizard-error">{ERROR_MESSAGES[error] || 'Something went wrong. Please try again.'}</div>}

            <div className="wizard-nav">
                {step > 0 ? (
                    <button className="btn-ghost" onClick={() => setStep(step - 1)} disabled={generating}>
                        <ChevronLeft size={18} /> Back
                    </button>
                ) : onCancel ? (
                    <button className="btn-ghost" onClick={onCancel} disabled={generating}>Cancel</button>
                ) : <span />}

                {isLast ? (
                    <button className="btn-primary" onClick={submit} disabled={!current.valid || generating}>
                        {generating ? (<><span className="spinner" /> Building your plan…</>) : (<><Sparkles size={18} /> Generate my plan</>)}
                    </button>
                ) : (
                    <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={!current.valid}>
                        Next <ChevronRight size={18} />
                    </button>
                )}
            </div>
        </div>
    );
}

/* ═══════════════ Task row (OnePrep style) ═══════════════ */
function TaskRow({ task, isOverdue, isPrimary, onToggle }) {
    const auto = task.status === 'auto';
    const done = task.status === 'done' || auto;
    const meta = TASK_META[task.type] || { label: task.type, icon: FileText };
    const MetaIcon = meta.icon;

    return (
        <div className={`task-row ${done ? 'completed' : ''}`}>
            <button
                className={`task-check ${auto ? 'auto' : done ? 'manual' : ''}`}
                onClick={onToggle}
                disabled={auto || task.type === 'rest'}
                title={auto ? 'Completed on the site' : done ? 'Mark as not done' : 'Mark as done'}
            >
                {done && <Check size={13} strokeWidth={3.5} />}
            </button>

            <div className="task-body">
                <div className="task-line">
                    <span className="task-title">{task.title}</span>
                    <span className="task-cat">({meta.label})</span>
                    {isOverdue && <span className="badge-overdue">Overdue</span>}
                    {auto && <Lock size={12} className="task-lock" />}
                </div>
                <div className="task-meta">
                    <MetaIcon size={13} />
                    <span>IELTS</span>
                    {task.minutes > 0 && (<><span className="meta-sep">/</span><span>~{task.minutes} min</span></>)}
                </div>
            </div>

            {task.kind === 'site' && !done && (
                <a
                    className={`btn-start ${isPrimary ? 'primary' : ''}`}
                    href={getTestUrl(task.type, task.testId)}
                    target="_blank"
                    rel="noreferrer"
                >
                    Start <ChevronRight size={15} />
                </a>
            )}
        </div>
    );
}

/* ═══════════════ Options dropdown ═══════════════ */
function OptionsMenu({ onAdjust, onDelete }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    return (
        <div className="options-wrap" ref={ref}>
            <button className="btn-ghost" onClick={() => setOpen(!open)}>Options</button>
            {open && (
                <div className="options-menu">
                    <button onClick={() => { setOpen(false); onAdjust(); }}>
                        <SlidersHorizontal size={15} /> Adjust plan
                    </button>
                    <button className="danger" onClick={() => { setOpen(false); onDelete(); }}>
                        <Trash2 size={15} /> Delete plan
                    </button>
                </div>
            )}
        </div>
    );
}

/* ═══════════════ Telegram instructions modal ═══════════════ */
function TelegramModal({ onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal card" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}><X size={18} /></button>
                <div className="modal-icon"><Send size={26} /></div>
                <h3>Daily reminders in Telegram</h3>
                <p className="modal-sub">Tasks every morning at 7:00 — and a reminder at 20:00 if something is unfinished</p>
                <ol className="tg-steps">
                    <li>Open <a href={`https://t.me/${TG_BOT_USERNAME}`} target="_blank" rel="noreferrer">@{TG_BOT_USERNAME} <ExternalLink size={12} /></a> in Telegram</li>
                    <li>Press <strong>Start</strong></li>
                    <li>Send the bot the <strong>email you log in with</strong> on this site</li>
                    <li>Done — at 7:00 the bot sends today\u2019s tasks, at 20:00 it checks your progress</li>
                </ol>
                <p className="tg-note">To turn reminders off, send <code>/stop</code> to the bot.</p>
                <a className="btn-primary tg-open" href={`https://t.me/${TG_BOT_USERNAME}`} target="_blank" rel="noreferrer">
                    <Send size={16} /> Open the bot
                </a>
            </div>
        </div>
    );
}

/* ═══════════════ Plan view ═══════════════ */
function PlanView({ plan, onToggle, onAdjust, onDelete }) {
    const today = todayString();
    const progress = planProgress(plan);
    const daysLeft = daysUntil(plan.examDate);
    const [showTelegram, setShowTelegram] = useState(false);

    const weeks = useMemo(() => {
        const map = new Map();
        plan.days.forEach((day, dayIndex) => {
            if (!map.has(day.weekIndex)) map.set(day.weekIndex, []);
            map.get(day.weekIndex).push({ ...day, dayIndex });
        });
        return [...map.values()];
    }, [plan.days]);

    const currentWeekPos = useMemo(() => {
        const idx = weeks.findIndex((days) => days.some((d) => d.date >= today));
        return idx === -1 ? weeks.length - 1 : idx;
    }, [weeks, today]);

    const [viewWeek, setViewWeek] = useState(currentWeekPos);
    const week = weeks[viewWeek] || [];

    // The single highlighted "Start" — first pending site task of today
    const primaryTaskId = useMemo(() => {
        const todayDay = plan.days.find((d) => d.date === today);
        return todayDay?.tasks.find((t) => t.kind === 'site' && t.status === 'pending')?.id ?? null;
    }, [plan.days, today]);

    const weekFocus = week[0]?.focus;

    return (
        <div className="plan-view">
            {/* Title row */}
            <div className="plan-titlebar">
                <h1><CalendarDays size={24} /> My Study Plan</h1>
                <div className="titlebar-actions">
                    <button className="btn-ghost btn-telegram" onClick={() => setShowTelegram(true)}>
                        <Send size={15} /> Telegram
                    </button>
                    <OptionsMenu onAdjust={onAdjust} onDelete={onDelete} />
                </div>
            </div>

            {/* Stats */}
            <div className="plan-header card">
                <div className="plan-header-main">
                    <div className="plan-stat">
                        <span className="stat-value">{daysLeft > 0 ? daysLeft : 0}</span>
                        <span className="stat-label">days to exam</span>
                    </div>
                    <div className="plan-stat">
                        <span className="stat-value">{plan.currentBand.toFixed(1)} → <em>{plan.targetBand.toFixed(1)}</em></span>
                        <span className="stat-label">current → target</span>
                    </div>
                    <div className="plan-stat">
                        <span className="stat-value">{progress.done}<small>/{progress.total}</small></span>
                        <span className="stat-label">tasks completed</span>
                    </div>
                    <div className="plan-stat right">
                        <span className="stat-value">{progress.pct}%</span>
                        <span className="stat-label">
                            {plan.generatedWith === 'ai'
                                ? (<span className="ai-badge"><Sparkles size={11} /> AI-personalized</span>)
                                : 'complete'}
                        </span>
                    </div>
                </div>
                <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
                </div>
            </div>

            {/* Week navigation */}
            <div className="week-nav">
                <div>
                    <div className="week-count">Week {viewWeek + 1} of {weeks.length}</div>
                    <h2 className="week-range">{week.length ? fmtWeekRange(week[0].date, week[week.length - 1].date) : ''}</h2>
                    {weekFocus && <div className="week-focus-label">Focus: {weekFocus}</div>}
                </div>
                <div className="week-arrows">
                    <button className="week-arrow" onClick={() => setViewWeek(viewWeek - 1)} disabled={viewWeek === 0}>
                        <ChevronLeft size={18} />
                    </button>
                    <button className="week-arrow" onClick={() => setViewWeek(viewWeek + 1)} disabled={viewWeek >= weeks.length - 1}>
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Days of the visible week */}
            <div className="week-card card">
                {week.map((day, i) => {
                    const parts = dayParts(day.date);
                    const isToday = day.date === today;
                    const dayMinutes = day.tasks.reduce((sum, t) => sum + (t.minutes || 0), 0);
                    return (
                        <div key={day.date} className={`day-row ${isToday ? 'is-today' : ''} ${i > 0 ? 'bordered' : ''}`}>
                            <div className="day-col">
                                <span className="day-weekday">{parts.weekday}</span>
                                <span className="day-num">{parts.num}</span>
                                <span className="day-month">{parts.month}</span>
                                {dayMinutes > 0 && <span className="day-total">~{Math.round(dayMinutes / 60 * 10) / 10}h</span>}
                                {isToday && <span className="day-today-pill">Today</span>}
                            </div>
                            <div className="day-tasks">
                                {day.tasks.map((t) => (
                                    <TaskRow
                                        key={t.id}
                                        task={t}
                                        isOverdue={day.date < today && t.status === 'pending' && t.type !== 'rest'}
                                        isPrimary={t.id === primaryTaskId}
                                        onToggle={() => onToggle(day.dayIndex, t.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {showTelegram && <TelegramModal onClose={() => setShowTelegram(false)} />}
        </div>
    );
}

/* ═══════════════ Page ═══════════════ */
export default function DailyPlan() {
    const { user, userData } = useAuth();
    const { plan, loading, generating, error, generatePlan, toggleTask, deletePlan } = useStudyPlan(user?.uid);
    const { target } = useTargetScore(user?.uid, userData?.email || user?.email);
    const [editing, setEditing] = useState(false);

    if (loading) {
        return (
            <div className="daily-plan-page">
                <div className="plan-loading card"><span className="spinner dark" /> Loading your plan…</div>
            </div>
        );
    }

    const showWizard = !plan || editing;

    const handleDelete = async () => {
        if (window.confirm('Delete your study plan? Your task history will be lost.')) {
            await deletePlan();
        }
    };

    return (
        <div className="daily-plan-page">
            {showWizard ? (
                <>
                    <div className="page-head">
                        <h1>Daily Plan</h1>
                        <p>Your personal road map to exam day</p>
                    </div>
                    <PlanWizard
                        defaults={plan
                            ? { currentBands: plan.currentBands, targetBand: plan.targetBand, examDate: plan.examDate, hoursPerDay: plan.hoursPerDay }
                            : { targetBand: target ?? null }}
                        generating={generating}
                        error={error}
                        onCancel={plan ? () => setEditing(false) : null}
                        onSubmit={async (input) => {
                            const ok = await generatePlan(input);
                            if (ok) setEditing(false);
                        }}
                    />
                </>
            ) : (
                <PlanView
                    plan={plan}
                    onToggle={toggleTask}
                    onAdjust={() => setEditing(true)}
                    onDelete={handleDelete}
                />
            )}
        </div>
    );
}
