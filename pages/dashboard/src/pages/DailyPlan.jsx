import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStudyPlan, planProgress, todayString, daysUntil } from '../hooks/useStudyPlan';
import { useTargetScore, getTestUrl } from '../hooks/useResults';
import {
    CalendarDays, Target, Gauge, Clock, ChevronLeft, ChevronRight,
    Sparkles, RefreshCw, ExternalLink, Check, Lock, Flame
} from 'lucide-react';
import './DailyPlan.css';

const BANDS = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];

// Computed once at load — exam must be 3–200 days out
const MIN_EXAM_DATE = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const MAX_EXAM_DATE = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);

const HOURS_OPTIONS = [
    { value: 1, label: '1 hour', desc: 'Light — busy schedule' },
    { value: 1.5, label: '1.5 hours', desc: 'Steady progress' },
    { value: 2, label: '2 hours', desc: 'Balanced (recommended)' },
    { value: 3, label: '3+ hours', desc: 'Intensive preparation' },
];

const TASK_ICONS = {
    reading: '📖', listening: '🎧', writing: '✍️', fullmock: '🎓',
    vocabulary: '📚', grammar: '✏️', review: '🔄', reading_analysis: '🔍',
    listening_review: '🎵', rest: '😴',
};

const ERROR_MESSAGES = {
    limit_reached: 'You can generate a plan 3 times per week. Try again next week.',
    exam_too_soon: 'The exam date must be at least 3 days from today.',
    exam_too_far: 'The exam date must be within the next 6 months.',
    invalid_date: 'Please pick a valid exam date.',
    network: 'Network error — check your connection and try again.',
};

function fmtDay(dateStr) {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
    });
}

/* ═══════════════ Setup wizard ═══════════════ */
function PlanWizard({ defaults, onSubmit, generating, error, onCancel }) {
    const [step, setStep] = useState(0);
    const [currentBand, setCurrentBand] = useState(defaults.currentBand ?? null);
    const [examDate, setExamDate] = useState(defaults.examDate ?? '');
    const [targetBand, setTargetBand] = useState(defaults.targetBand ?? null);
    const [hoursPerDay, setHoursPerDay] = useState(defaults.hoursPerDay ?? 2);

    const steps = [
        {
            icon: Gauge,
            title: 'Your current level',
            subtitle: 'Rough estimate is fine — recent mock results help too',
            valid: currentBand !== null,
            body: (
                <div className="band-grid">
                    {BANDS.map((b) => (
                        <button
                            key={b}
                            className={`band-chip ${currentBand === b ? 'selected' : ''}`}
                            onClick={() => setCurrentBand(b)}
                        >
                            {b.toFixed(1)}
                        </button>
                    ))}
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
                                className={`band-chip target ${targetBand === b ? 'selected' : ''}`}
                                onClick={() => setTargetBand(b)}
                            >
                                {b.toFixed(1)}
                            </button>
                        ))}
                    </div>
                    {targetBand !== null && currentBand !== null && targetBand <= currentBand && (
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
        currentBand, targetBand, examDate, hoursPerDay, startDate: todayString(),
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

/* ═══════════════ Task row ═══════════════ */
function TaskRow({ task, onToggle }) {
    const auto = task.status === 'auto';
    const done = task.status === 'done' || auto;
    return (
        <div className={`task-row ${done ? 'completed' : ''}`}>
            <button
                className={`task-check ${auto ? 'auto' : done ? 'manual' : ''}`}
                onClick={onToggle}
                disabled={auto}
                title={auto ? 'Completed on the site' : done ? 'Mark as not done' : 'Mark as done'}
            >
                {done && <Check size={14} strokeWidth={3} />}
            </button>
            <span className="task-icon">{TASK_ICONS[task.type] || '📝'}</span>
            <span className="task-title">{task.title}</span>
            {auto && <Lock size={13} className="task-lock" />}
            {task.kind === 'site' && !done && (
                <a className="task-link" href={getTestUrl(task.type, task.testId)} target="_blank" rel="noreferrer">
                    Start <ExternalLink size={13} />
                </a>
            )}
        </div>
    );
}

/* ═══════════════ Plan view ═══════════════ */
function PlanView({ plan, onToggle, onRegenerate }) {
    const today = todayString();
    const progress = planProgress(plan);
    const daysLeft = daysUntil(plan.examDate);

    const weeks = useMemo(() => {
        const map = new Map();
        plan.days.forEach((day, dayIndex) => {
            if (!map.has(day.weekIndex)) map.set(day.weekIndex, { focus: day.focus, days: [] });
            map.get(day.weekIndex).days.push({ ...day, dayIndex });
        });
        return [...map.entries()];
    }, [plan.days]);

    const currentWeekIndex = useMemo(() => {
        const d = plan.days.find((day) => day.date >= today);
        return d ? d.weekIndex : plan.days[plan.days.length - 1]?.weekIndex ?? 0;
    }, [plan.days, today]);

    const [openWeeks, setOpenWeeks] = useState(() => new Set([currentWeekIndex]));
    const toggleWeek = (w) => setOpenWeeks((prev) => {
        const next = new Set(prev);
        if (next.has(w)) next.delete(w); else next.add(w);
        return next;
    });

    const todayPlan = plan.days.find((d) => d.date === today);
    const todayIndex = plan.days.findIndex((d) => d.date === today);

    return (
        <div className="plan-view">
            {/* Header */}
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
                    <button className="btn-ghost regen" onClick={onRegenerate} title="Regenerate plan">
                        <RefreshCw size={16} /> Adjust plan
                    </button>
                </div>
                <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
                </div>
                <div className="progress-caption">
                    <span>{progress.pct}% complete</span>
                    {plan.generatedWith === 'ai' && <span className="ai-badge"><Sparkles size={12} /> AI-personalized</span>}
                </div>
            </div>

            {/* Advice */}
            {plan.advice && (
                <div className="plan-advice card">
                    <Sparkles size={18} />
                    <p>{plan.advice}</p>
                </div>
            )}

            {/* Today */}
            {todayPlan && (
                <div className="today-card card">
                    <div className="today-head">
                        <Flame size={18} />
                        <h3>Today — {fmtDay(todayPlan.date)}</h3>
                        <span className="today-focus">{todayPlan.focus}</span>
                    </div>
                    {todayPlan.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} onToggle={() => onToggle(todayIndex, t.id)} />
                    ))}
                </div>
            )}

            {/* Full schedule by week */}
            <div className="plan-weeks">
                {weeks.map(([weekIndex, week]) => {
                    const open = openWeeks.has(weekIndex);
                    const weekDone = week.days.every((d) =>
                        d.tasks.every((t) => t.status === 'done' || t.status === 'auto'));
                    const isPastWeek = week.days[week.days.length - 1].date < today;
                    return (
                        <div key={weekIndex} className={`week-block card ${isPastWeek ? 'past' : ''}`}>
                            <button className="week-head" onClick={() => toggleWeek(weekIndex)}>
                                <span className="week-name">
                                    Week {weekIndex + 1}
                                    {weekIndex === currentWeekIndex && <span className="week-now">current</span>}
                                    {weekDone && <Check size={15} className="week-done" />}
                                </span>
                                <span className="week-focus">{week.focus}</span>
                                <ChevronRight size={17} className={`week-chevron ${open ? 'open' : ''}`} />
                            </button>
                            {open && week.days.map((day) => (
                                <div key={day.date} className={`day-block ${day.date === today ? 'is-today' : ''} ${day.date < today ? 'is-past' : ''}`}>
                                    <div className="day-date">{fmtDay(day.date)}</div>
                                    {day.tasks.map((t) => (
                                        <TaskRow key={t.id} task={t} onToggle={() => onToggle(day.dayIndex, t.id)} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ═══════════════ Page ═══════════════ */
export default function DailyPlan() {
    const { user, userData } = useAuth();
    const { plan, loading, generating, error, generatePlan, toggleTask } = useStudyPlan(user?.uid);
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

    return (
        <div className="daily-plan-page">
            <div className="page-head">
                <h1>Daily Plan</h1>
                <p>Your personal road map to exam day</p>
            </div>

            {showWizard ? (
                <PlanWizard
                    defaults={plan
                        ? { currentBand: plan.currentBand, targetBand: plan.targetBand, examDate: plan.examDate, hoursPerDay: plan.hoursPerDay }
                        : { targetBand: target ?? null }}
                    generating={generating}
                    error={error}
                    onCancel={plan ? () => setEditing(false) : null}
                    onSubmit={async (input) => {
                        const ok = await generatePlan(input);
                        if (ok) setEditing(false);
                    }}
                />
            ) : (
                <PlanView plan={plan} onToggle={toggleTask} onRegenerate={() => setEditing(true)} />
            )}
        </div>
    );
}
